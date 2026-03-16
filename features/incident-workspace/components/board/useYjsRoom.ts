"use client"

import type {
  IncidentRoleAssignments,
  IncidentSummary,
  PresenceState,
  PresenceUser,
} from "@/features/incident-workspace/lib/board/types"
import {
  createIncidentRoleAssignments,
  createIncidentSummary,
  createTypedIncidentLogEntry,
  getCollabServerUrl,
  isPresenceState,
  parseIncidentRoleAssignments,
  parseIncidentSummary,
  readBoardConnections,
  readEntities,
  readIncidentActionItems,
  readIncidentLog,
  serializeIncidentLogEntry,
  serializeIncidentRoleAssignments,
  serializeIncidentSummary,
} from "@/features/incident-workspace/components/board/boardCore"
import type { ConnectionStatus } from "@/features/incident-workspace/components/board/boardCore"
import { useEffect, useRef, useState } from "react"
import type React from "react"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

type RoomAccessPayload = {
  collabToken: string
}

type UseYjsRoomCallbacks = {
  onConnectionsChange: (connections: ReturnType<typeof readBoardConnections>) => void
  onEntitiesChange: (entities: ReturnType<typeof readEntities>) => void
  onIncidentActionsChange: (actions: ReturnType<typeof readIncidentActionItems>) => void
  onIncidentLogChange: (log: ReturnType<typeof readIncidentLog>) => void
  onMetaChange: (summary: IncidentSummary, roles: IncidentRoleAssignments) => void
}

type UseYjsRoomArgs = {
  callbacks: UseYjsRoomCallbacks
  connectionsRef: React.MutableRefObject<Y.Array<string> | null>
  entityMapRef: React.MutableRefObject<Y.Map<string> | null>
  incidentActionsRef: React.MutableRefObject<Y.Array<string> | null>
  incidentLogRef: React.MutableRefObject<Y.Array<string> | null>
  metaMapRef: React.MutableRefObject<Y.Map<string> | null>
  providerRef: React.MutableRefObject<WebsocketProvider | null>
  roomId: string
  user: PresenceUser
}

export function useYjsRoom({
  callbacks,
  connectionsRef,
  entityMapRef,
  incidentActionsRef,
  incidentLogRef,
  metaMapRef,
  providerRef,
  roomId,
  user,
}: UseYjsRoomArgs) {
  const hasConnectedRef = useRef(false)
  const callbacksRef = useRef(callbacks)
  const userRef = useRef(user)

  useEffect(() => {
    callbacksRef.current = callbacks
    userRef.current = user
  })

  const [isSynced, setIsSynced] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting")
  const [presence, setPresence] = useState<PresenceState[]>([])
  const [collabToken, setCollabToken] = useState<string | null>(null)

  useEffect(() => {
    hasConnectedRef.current = false

    let cancelled = false

    void fetch(`/api/rooms/${roomId}/access`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as Partial<RoomAccessPayload> & {
          error?: string
        }

        if (!response.ok || !payload.collabToken) {
          throw new Error(payload.error || "Unable to join this room.")
        }

        if (!cancelled) {
          setCollabToken(payload.collabToken)
        }
      })
      .catch(() => {
        if (!cancelled) {
          hasConnectedRef.current = false
          setConnectionStatus("disconnected")
        }
      })

    return () => {
      cancelled = true
    }
  }, [roomId])

  useEffect(() => {
    if (!collabToken) {
      return
    }

    const doc = new Y.Doc()
    const provider = new WebsocketProvider(getCollabServerUrl(), roomId, doc, {
      params: { token: collabToken },
    })
    const entityMap = doc.getMap<string>("entities")
    const connectionsList = doc.getArray<string>("connections")
    const incidentLogEntries = doc.getArray<string>("incident-log")
    const incidentActionsList = doc.getArray<string>("incident-actions")
    const metaMap = doc.getMap<string>("meta")

    entityMapRef.current = entityMap
    connectionsRef.current = connectionsList
    incidentLogRef.current = incidentLogEntries
    incidentActionsRef.current = incidentActionsList
    metaMapRef.current = metaMap
    providerRef.current = provider

    const syncEntities = () => {
      callbacksRef.current.onEntitiesChange(
        readEntities(entityMap).filter((entity) => entity.type !== "screenTile"),
      )
    }

    const syncConnections = () => {
      callbacksRef.current.onConnectionsChange(readBoardConnections(connectionsList))
    }

    const syncIncidentLog = () => {
      callbacksRef.current.onIncidentLogChange(readIncidentLog(incidentLogEntries))
    }

    const syncIncidentActions = () => {
      callbacksRef.current.onIncidentActionsChange(readIncidentActionItems(incidentActionsList))
    }

    const syncIncidentMeta = () => {
      callbacksRef.current.onMetaChange(
        parseIncidentSummary(metaMap.get("incidentSummary")) ?? createIncidentSummary(),
        parseIncidentRoleAssignments(metaMap.get("incidentRoles")) ??
          createIncidentRoleAssignments(),
      )
    }

    let pendingPresenceFrame: number | null = null

    const syncPresence = () => {
      if (pendingPresenceFrame !== null) {
        return
      }

      pendingPresenceFrame = requestAnimationFrame(() => {
        pendingPresenceFrame = null

        const nextPresence = Array.from(provider.awareness.getStates().values())
          .filter(isPresenceState)
          .filter((item) => item.roomId === roomId && item.user.id !== userRef.current.id)

        setPresence(nextPresence)
      })
    }

    const clearLegacyScreenTiles = () => {
      const legacyTileIds = readEntities(entityMap)
        .filter((entity) => entity.type === "screenTile")
        .map((entity) => entity.id)

      if (legacyTileIds.length === 0) {
        return
      }

      doc.transact(() => {
        legacyTileIds.forEach((entityId) => {
          entityMap.delete(entityId)
        })
      })
    }

    const seedRoom = () => {
      if (metaMap.get("seedVersion") === "3") {
        return
      }

      doc.transact(() => {
        if (metaMap.get("seedVersion") === "3") {
          return
        }

        metaMap.set("seedVersion", "3")
        if (!metaMap.get("incidentSummary")) {
          metaMap.set("incidentSummary", serializeIncidentSummary(createIncidentSummary()))
        }
        if (!metaMap.get("incidentRoles")) {
          metaMap.set(
            "incidentRoles",
            serializeIncidentRoleAssignments(createIncidentRoleAssignments()),
          )
        }
      })
    }

    const ensureIncidentLog = () => {
      if (incidentLogEntries.length > 0) {
        return
      }

      incidentLogEntries.push([
        serializeIncidentLogEntry(
          createTypedIncidentLogEntry(
            { color: "#94a3b8", id: "system", name: "System" },
            {
              body: "Incident timeline initialized. Confirm impact, assign roles, and capture the next mitigation step.",
              type: "update",
            },
          ),
        ),
      ])
    }

    const handleStatus = ({ status }: { status: ConnectionStatus }) => {
      if (status === "connected") {
        hasConnectedRef.current = true
        setConnectionStatus("connected")
        return
      }

      if (hasConnectedRef.current) {
        return
      }

      setConnectionStatus(status)
    }

    const handleSync = (synced: boolean) => {
      if (synced) {
        hasConnectedRef.current = true
        setConnectionStatus("connected")
        setIsSynced(true)
        seedRoom()
        clearLegacyScreenTiles()
        ensureIncidentLog()
        syncEntities()
        syncIncidentActions()
        syncIncidentLog()
        syncIncidentMeta()
      }
    }

    provider.on("status", handleStatus)
    provider.on("sync", handleSync)
    provider.awareness.on("change", syncPresence)

    provider.awareness.setLocalState({
      cursor: null,
      roomId,
      selectedEntityId: null,
      user: userRef.current,
    } satisfies PresenceState)

    entityMap.observe(syncEntities)
    connectionsList.observe(syncConnections)
    incidentActionsList.observe(syncIncidentActions)
    incidentLogEntries.observe(syncIncidentLog)
    metaMap.observe(syncIncidentMeta)
    syncEntities()
    syncConnections()
    syncIncidentActions()
    syncIncidentLog()
    syncIncidentMeta()
    syncPresence()

    return () => {
      if (pendingPresenceFrame !== null) {
        cancelAnimationFrame(pendingPresenceFrame)
      }

      entityMap.unobserve(syncEntities)
      connectionsList.unobserve(syncConnections)
      incidentActionsList.unobserve(syncIncidentActions)
      incidentLogEntries.unobserve(syncIncidentLog)
      metaMap.unobserve(syncIncidentMeta)
      provider.awareness.off("change", syncPresence)
      provider.off("status", handleStatus)
      provider.off("sync", handleSync)
      provider.awareness.setLocalState(null)
      provider.destroy()
      doc.destroy()
      entityMapRef.current = null
      connectionsRef.current = null
      incidentActionsRef.current = null
      incidentLogRef.current = null
      metaMapRef.current = null
      providerRef.current = null
    }
  }, [
    collabToken,
    connectionsRef,
    entityMapRef,
    incidentActionsRef,
    incidentLogRef,
    metaMapRef,
    providerRef,
    roomId,
  ])

  return {
    connectionStatus,
    isSynced,
    presence,
  }
}
