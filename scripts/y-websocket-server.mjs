import http from "node:http"
import { createHmac, timingSafeEqual } from "node:crypto"
import nextEnv from "@next/env"
import WebSocket, { WebSocketServer } from "ws"
import { Pool } from "pg"
import * as Y from "yjs"
import * as syncProtocol from "y-protocols/sync"
import * as awarenessProtocol from "y-protocols/awareness"
import * as encoding from "lib0/encoding"
import * as decoding from "lib0/decoding"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

const host = process.env.HOST || "localhost"
const port = Number(process.env.PORT || 1234)
const docs = new Map()
const databaseUrl = process.env.DATABASE_URL?.trim() || null
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null

const messageSync = 0
const messageAwareness = 1
const pingTimeoutMs = 30_000
const persistenceDebounceMs = 500
let roomSchemaReadyPromise = null

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || null
}

function encodeBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, "base64")
}

function createSignature(payload, secret) {
  return encodeBase64Url(createHmac("sha256", secret).update(payload).digest())
}

function verifyCollabToken(token, roomName) {
  const secret = getAuthSecret()

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured.")
  }

  const [encodedPayload, signature] = token.split(".")

  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = createSignature(encodedPayload, secret)
  const isValid =
    signature.length === expectedSignature.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

  if (!isValid) {
    return null
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"))
  const baseRoomId = roomName.startsWith("hunt:") ? roomName.slice(5) : roomName

  if (payload.roomId !== baseRoomId || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null
  }

  return payload
}

async function ensureRoomDocumentSchema() {
  if (!pool) {
    return
  }

  if (roomSchemaReadyPromise) {
    return roomSchemaReadyPromise
  }

  roomSchemaReadyPromise = pool
    .query(`
      CREATE TABLE IF NOT EXISTS room_documents (
        room_id TEXT PRIMARY KEY,
        yjs_state BYTEA NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    .catch((error) => {
      roomSchemaReadyPromise = null
      throw error
    })

  return roomSchemaReadyPromise
}

async function isPersistentRoomName(name) {
  if (!pool) {
    return false
  }

  const baseRoomId = name.startsWith("hunt:") ? name.slice(5) : name
  const result = await pool.query(
    `
      SELECT 1
      FROM investigations
      WHERE room_id = $1
      LIMIT 1
    `,
    [baseRoomId],
  )

  return result.rowCount > 0
}

async function loadPersistedDocState(name) {
  if (!pool) {
    return null
  }

  if (!(await isPersistentRoomName(name))) {
    return null
  }

  await ensureRoomDocumentSchema()

  const result = await pool.query(
    `
      SELECT yjs_state
      FROM room_documents
      WHERE room_id = $1
      LIMIT 1
    `,
    [name],
  )

  return result.rows[0]?.yjs_state ?? null
}

async function persistDocState(docState) {
  if (!pool) {
    return
  }

  if (!(await isPersistentRoomName(docState.name))) {
    return
  }

  await ensureRoomDocumentSchema()

  const update = Y.encodeStateAsUpdate(docState.doc)

  await pool.query(
    `
      INSERT INTO room_documents (room_id, yjs_state, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (room_id) DO UPDATE SET
        yjs_state = EXCLUDED.yjs_state,
        updated_at = NOW()
    `,
    [docState.name, Buffer.from(update)],
  )
}

function queuePersist(docState) {
  if (!pool) {
    return
  }

  if (docState.persistenceTimer) {
    clearTimeout(docState.persistenceTimer)
  }

  docState.persistenceTimer = setTimeout(() => {
    docState.persistenceTimer = null
    docState.flushPromise = persistDocState(docState)
      .catch((error) => {
      console.error(`failed to persist room document ${docState.name}`, error)
      })
      .finally(() => {
        docState.flushPromise = null
      })
  }, persistenceDebounceMs)
}

async function getDoc(name) {
  let entry = docs.get(name)

  if (entry) {
    return entry
  }

  const doc = new Y.Doc()
  const persistedState = await loadPersistedDocState(name)

  if (persistedState) {
    Y.applyUpdate(doc, new Uint8Array(persistedState))
  }

  const awareness = new awarenessProtocol.Awareness(doc)
  const conns = new Map()

  const updateHandler = (update) => {
    queuePersist(docState)
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeUpdate(encoder, update)
    const payload = encoding.toUint8Array(encoder)

    for (const conn of conns.keys()) {
      send(docState, conn, payload)
    }
  }

  const awarenessHandler = ({ added, removed, updated }, conn) => {
    const changed = added.concat(removed, updated)

    if (conn) {
      const controlledIds = conns.get(conn)

      if (controlledIds) {
        added.forEach((id) => controlledIds.add(id))
        removed.forEach((id) => controlledIds.delete(id))
      }
    }

    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changed),
    )

    const payload = encoding.toUint8Array(encoder)

    for (const socket of conns.keys()) {
      send(docState, socket, payload)
    }
  }

  awareness.on("update", awarenessHandler)
  doc.on("update", updateHandler)

  const docState = {
    awareness,
    conns,
    doc,
    flushPromise: null,
    name,
    persistenceTimer: null,
  }
  docs.set(name, docState)

  return docState
}

function destroyDocState(docState) {
  if (docState.conns.size > 0 || docState.flushPromise) {
    return
  }

  docs.delete(docState.name)
  docState.doc.destroy()
}

function closeConnection(docState, conn) {
  const controlledIds = docState.conns.get(conn)

  if (controlledIds) {
    docState.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(
      docState.awareness,
      Array.from(controlledIds),
      null,
    )
  }

  if (docState.conns.size === 0) {
    if (docState.persistenceTimer) {
      clearTimeout(docState.persistenceTimer)
      docState.persistenceTimer = null
    }

    docState.flushPromise = persistDocState(docState)
      .catch((error) => {
        console.error(`failed to flush room document ${docState.name}`, error)
      })
      .finally(() => {
        docState.flushPromise = null
        destroyDocState(docState)
      })
  }

  conn.close()
}

function send(docState, conn, payload) {
  if (
    conn.readyState !== WebSocket.OPEN &&
    conn.readyState !== WebSocket.CONNECTING
  ) {
    closeConnection(docState, conn)
    return
  }

  conn.send(payload, (error) => {
    if (error) {
      closeConnection(docState, conn)
    }
  })
}

function onMessage(conn, docState, message) {
  const decoder = decoding.createDecoder(new Uint8Array(message))
  const encoder = encoding.createEncoder()
  const messageType = decoding.readVarUint(decoder)

  if (messageType === messageSync) {
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.readSyncMessage(decoder, encoder, docState.doc, conn)

    if (encoding.length(encoder) > 1) {
      send(docState, conn, encoding.toUint8Array(encoder))
    }

    return
  }

  if (messageType === messageAwareness) {
    const update = decoding.readVarUint8Array(decoder)
    awarenessProtocol.applyAwarenessUpdate(docState.awareness, update, conn)
  }
}

async function setupConnection(conn, request) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`)
  const roomName = requestUrl.pathname.slice(1) || "default"
  const token = requestUrl.searchParams.get("token") || ""

  if (!verifyCollabToken(token, roomName)) {
    conn.close(4001, "Unauthorized room token")
    return
  }

  // Buffer messages that arrive during the async DB load so SYNC_STEP1 isn't dropped.
  const messageQueue = []
  const bufferMessage = (msg) => messageQueue.push(msg)
  conn.on("message", bufferMessage)

  const docState = await getDoc(roomName)
  let pongReceived = true

  docState.conns.set(conn, new Set())

  conn.off("message", bufferMessage)
  conn.on("message", (message) => {
    onMessage(conn, docState, message)
  })

  // Replay any messages received before the handler was ready.
  for (const msg of messageQueue) {
    onMessage(conn, docState, msg)
  }

  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      clearInterval(pingInterval)
      closeConnection(docState, conn)
      return
    }

    pongReceived = false
    conn.ping()
  }, pingTimeoutMs)

  conn.on("pong", () => {
    pongReceived = true
  })

  conn.on("close", () => {
    clearInterval(pingInterval)
    closeConnection(docState, conn)
  })

  const syncEncoder = encoding.createEncoder()
  encoding.writeVarUint(syncEncoder, messageSync)
  syncProtocol.writeSyncStep1(syncEncoder, docState.doc)
  send(docState, conn, encoding.toUint8Array(syncEncoder))

  const awarenessStates = docState.awareness.getStates()

  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder()
    encoding.writeVarUint(awarenessEncoder, messageAwareness)
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        docState.awareness,
        Array.from(awarenessStates.keys()),
      ),
    )
    send(docState, conn, encoding.toUint8Array(awarenessEncoder))
  }
}

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain" })
  response.end("incident-workspace collab server")
})

const wss = new WebSocketServer({ noServer: true })

wss.on("connection", setupConnection)

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request)
  })
})

server.listen(port, host, () => {
  console.log(
    `incident-workspace collab server listening on ws://${host}:${port}${
      pool ? " with Postgres-backed room persistence" : ""
    }`,
  )
})
