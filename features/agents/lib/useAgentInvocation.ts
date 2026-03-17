"use client"

import { useCallback, useRef, useState } from "react"
import type React from "react"
import * as Y from "yjs"

import type { BoardEntity, BoardConnection, GhostEntity } from "@/features/incident-workspace/lib/board/types"
import { createReasoningEntity, nextZIndex } from "@/features/incident-workspace/components/board/boardCore"

const REASONING_ENTITY_X_OFFSET = 280
const GHOST_Y_OFFSET = 60


type InvocationStatus = "idle" | "running" | "complete" | "error" | "cancelled"

type UseAgentInvocationArgs = {
  caseId: string
  createEntity: (entity: BoardEntity) => void
  createConnection: (
    sourceEntityId: string,
    targetEntityId: string,
    type: BoardConnection["type"],
    customLabel?: string,
  ) => BoardConnection | undefined
  updateConnection: (
    connectionId: string,
    updater: (connection: BoardConnection) => BoardConnection,
  ) => void
  entities: BoardEntity[]
  userId: string
  yDoc: React.MutableRefObject<Y.Doc | null>
}

type GhostAction = {
  label: string
  summary: string
  type: string
}

export function useAgentInvocation({
  caseId,
  createEntity,
  createConnection,
  updateConnection,
  entities,
  userId,
  yDoc,
}: UseAgentInvocationArgs) {
  const [status, setStatus] = useState<InvocationStatus>("idle")
  const [ghostEntities, setGhostEntities] = useState<GhostEntity[]>([])
  const [reasoningEntityId, setReasoningEntityId] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const bufferRef = useRef("") // narrative buffer for action parsing
  const sseBufferRef = useRef("") // raw SSE byte buffer for cross-chunk reassembly
  const agentConnectionIdRef = useRef<string | null>(null)

  const parseActionsFromBuffer = useCallback(
    (buffer: string, reasoningId: string, baseX: number, baseY: number): string => {
      const pattern = /```actions\s*([\s\S]*?)```/g
      let remaining = buffer
      let match: RegExpExecArray | null

      while ((match = pattern.exec(buffer)) !== null) {
        const jsonText = match[1].trim()

        try {
          const actions = JSON.parse(jsonText) as GhostAction[]

          if (Array.isArray(actions)) {
            const newGhosts: GhostEntity[] = actions.map((action, index) => ({
              invokingUserId: userId,
              label: typeof action.label === "string" ? action.label : "Proposed entity",
              proposedKind: typeof action.type === "string" ? (action.type as GhostEntity["proposedKind"]) : "note",
              reasoningEntityId: reasoningId,
              summary: typeof action.summary === "string" ? action.summary : "",
              x: baseX,
              y: baseY + (index + 1) * GHOST_Y_OFFSET,
            }))

            setGhostEntities((prev) => [...prev, ...newGhosts])
          }
        } catch {
          // Malformed JSON — treat as narrative by not removing from remaining
          remaining = remaining.replace(match[0], match[1])
          continue
        }

        remaining = remaining.replace(match[0], "")
      }

      return remaining
    },
    [userId],
  )

  const invoke = useCallback(
    async (agentId: string, focusEntity: BoardEntity, agentName = agentId) => {
      if (status === "running") {
        return
      }

      abortRef.current = new AbortController()
      bufferRef.current = ""
      sseBufferRef.current = ""
      setGhostEntities([])
      setStatus("running")

      // Create reasoning entity offset to the right of the focus entity
      const zIndex = nextZIndex(entities)
      const reasoningEntity = createReasoningEntity(
        agentId,
        agentName,
        userId,
        focusEntity.id,
        {
          x: focusEntity.x + focusEntity.width + REASONING_ENTITY_X_OFFSET,
          y: focusEntity.y,
        },
        zIndex,
      )

      createEntity(reasoningEntity)
      setReasoningEntityId(reasoningEntity.id)

      const connection = createConnection(
        focusEntity.id,
        reasoningEntity.id,
        "custom",
        `${agentName} · running`,
      )
      agentConnectionIdRef.current = connection?.id ?? null

      const entityMap = yDoc.current?.getMap<string>("entities")

      const ghostBaseX = reasoningEntity.x
      const ghostBaseY = reasoningEntity.y + reasoningEntity.height

      try {
        const invokeUrl = caseId
          ? `/api/cases/${caseId}/agents/${agentId}/invoke`
          : `/api/agents/${agentId}/invoke`

        const response = await fetch(
          invokeUrl,
          {
            body: JSON.stringify({ focusEntity }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
            signal: abortRef.current.signal,
          },
        )

        if (response.status === 409) {
          updateReasoningStatus(entityMap, reasoningEntity.id, "error")
          setStatus("error")
          return
        }

        if (!response.ok) {
          updateReasoningStatus(entityMap, reasoningEntity.id, "error")
          setStatus("error")
          return
        }

        if (!response.body) {
          updateReasoningStatus(entityMap, reasoningEntity.id, "error")
          setStatus("error")
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          sseBufferRef.current += decoder.decode(value, { stream: true })

          // SSE events are separated by double newlines
          const events = sseBufferRef.current.split("\n\n")
          // Last entry may be an incomplete event — keep it in the buffer
          sseBufferRef.current = events.pop() ?? ""

          for (const event of events) {
            if (!event.trim()) continue

            let eventType = ""
            let eventData = ""

            for (const line of event.split("\n")) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6)
              }
            }

            // All data values are JSON-encoded on the server to preserve newlines
            let decodedData = eventData
            try {
              decodedData = JSON.parse(eventData) as string
            } catch {
              // fall back to raw value for non-JSON payloads
            }

            if (eventType === "token") {
              bufferRef.current += decodedData
              const parsed = parseActionsFromBuffer(
                bufferRef.current,
                reasoningEntity.id,
                ghostBaseX,
                ghostBaseY,
              )
              bufferRef.current = parsed
              appendNarrative(entityMap, reasoningEntity.id, decodedData)
            } else if (eventType === "tool_result") {
              try {
                const result = JSON.parse(eventData) as { name?: string; verdict?: string }
                const summary = `${result.name ?? "tool"}: ${result.verdict ?? "done"}`
                appendToolCallSummary(entityMap, reasoningEntity.id, summary)
              } catch {
                // ignore malformed tool_result
              }
            } else if (eventType === "done") {
              updateReasoningStatus(entityMap, reasoningEntity.id, "complete")
              updateConnectionLabel(updateConnection, agentConnectionIdRef.current, agentName, "complete")
              setStatus("complete")
            } else if (eventType === "error") {
              updateReasoningStatus(entityMap, reasoningEntity.id, "error")
              updateConnectionLabel(updateConnection, agentConnectionIdRef.current, agentName, "error")
              setStatus("error")
            }
          }
        }

        updateReasoningStatus(entityMap, reasoningEntity.id, "complete")
        updateConnectionLabel(updateConnection, agentConnectionIdRef.current, agentName, "complete")
        setStatus("complete")
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          updateReasoningStatus(entityMap, reasoningEntity.id, "cancelled")
          updateConnectionLabel(updateConnection, agentConnectionIdRef.current, agentName, "cancelled")
          setStatus("cancelled")
        } else {
          updateReasoningStatus(entityMap, reasoningEntity.id, "error")
          updateConnectionLabel(updateConnection, agentConnectionIdRef.current, agentName, "error")
          setStatus("error")
        }
      }
    },
    [caseId, createConnection, createEntity, entities, parseActionsFromBuffer, status, updateConnection, userId, yDoc],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setGhostEntities([])
  }, [])

  const accept = useCallback(
    (ghost: GhostEntity) => {
      const newEntity: BoardEntity = {
        body: ghost.summary,
        color: "#bfdbfe",
        createdAt: Date.now(),
        height: 300,
        id: `note-${crypto.randomUUID()}`,
        title: ghost.label,
        type: "note",
        updatedAt: Date.now(),
        width: 360,
        x: ghost.x,
        y: ghost.y,
        zIndex: nextZIndex(entities),
      }

      createEntity(newEntity)
      createConnection(newEntity.id, ghost.reasoningEntityId, "derived_from")
      setGhostEntities((prev) => prev.filter((g) => g !== ghost))
    },
    [createConnection, createEntity, entities],
  )

  const dismiss = useCallback(
    (ghost: GhostEntity) => {
      if (reasoningEntityId) {
        const entityMap = yDoc.current?.getMap<string>("entities")
        const stored = entityMap?.get(reasoningEntityId)

        if (stored && entityMap) {
          try {
            const entity = JSON.parse(stored) as BoardEntity & { narrative?: string }
            const updated = {
              ...entity,
              narrative: (entity.narrative ?? "") + `\nDismissed: ${ghost.label}`,
              updatedAt: Date.now(),
            }
            entityMap.set(reasoningEntityId, JSON.stringify(updated))
          } catch {
            // Ignore parse errors
          }
        }
      }

      setGhostEntities((prev) => prev.filter((g) => g !== ghost))
    },
    [reasoningEntityId, yDoc],
  )

  return { accept, cancel, dismiss, ghostEntities, invoke, reasoningEntityId, status }
}

function updateReasoningStatus(
  entityMap: Y.Map<string> | undefined,
  entityId: string,
  status: "cancelled" | "complete" | "error" | "running",
) {
  if (!entityMap) return
  const stored = entityMap.get(entityId)
  if (!stored) return

  try {
    const entity = JSON.parse(stored) as BoardEntity & { status?: string }
    entityMap.set(entityId, JSON.stringify({ ...entity, status, updatedAt: Date.now() }))
  } catch {
    // Ignore parse errors
  }
}

function appendNarrative(
  entityMap: Y.Map<string> | undefined,
  entityId: string,
  token: string,
) {
  if (!entityMap || !token) return
  const stored = entityMap.get(entityId)
  if (!stored) return

  try {
    const entity = JSON.parse(stored) as BoardEntity & { narrative?: string }
    entityMap.set(
      entityId,
      JSON.stringify({ ...entity, narrative: (entity.narrative ?? "") + token, updatedAt: Date.now() }),
    )
  } catch {
    // Ignore parse errors
  }
}

function updateConnectionLabel(
  updateConnection: UseAgentInvocationArgs["updateConnection"],
  connectionId: string | null,
  agentName: string,
  status: string,
) {
  if (!connectionId) return
  updateConnection(connectionId, (conn) => ({
    ...conn,
    customLabel: `${agentName} · ${status}`,
    type: "custom" as const,
  }))
}

function appendToolCallSummary(
  entityMap: Y.Map<string> | undefined,
  entityId: string,
  summary: string,
) {
  if (!entityMap || !summary) return
  const stored = entityMap.get(entityId)
  if (!stored) return

  try {
    const entity = JSON.parse(stored) as BoardEntity & { toolCallSummary?: string }
    const existing = entity.toolCallSummary?.trim() ?? ""
    const next = existing ? `${existing} · ${summary}` : summary
    entityMap.set(
      entityId,
      JSON.stringify({ ...entity, toolCallSummary: next, updatedAt: Date.now() }),
    )
  } catch {
    // Ignore parse errors
  }
}
