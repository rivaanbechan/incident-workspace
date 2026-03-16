"use client"

import type { PresenceUser } from "@/features/incident-workspace/lib/board/types"
import { useActionManager } from "@/features/incident-workspace/components/board/useActionManager"
import { useConnectionManager } from "@/features/incident-workspace/components/board/useConnectionManager"
import { useEntityManager } from "@/features/incident-workspace/components/board/useEntityManager"
import { useRoomMeta } from "@/features/incident-workspace/components/board/useRoomMeta"
import { useTimelineManager } from "@/features/incident-workspace/components/board/useTimelineManager"
import { useYjsRoom } from "@/features/incident-workspace/components/board/useYjsRoom"
import { useEffect, useMemo, useRef } from "react"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

export function useBoardRoom(roomId: string, initialUser: PresenceUser) {
  const user = initialUser

  // All Yjs refs are created here in the coordinator and shared with domain hooks
  const entityMapRef = useRef<Y.Map<string> | null>(null)
  const connectionsRef = useRef<Y.Array<string> | null>(null)
  const incidentLogRef = useRef<Y.Array<string> | null>(null)
  const incidentActionsRef = useRef<Y.Array<string> | null>(null)
  const metaMapRef = useRef<Y.Map<string> | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)

  // Room metadata: camera, stageRef, incidentSummary, incidentRoles
  const meta = useRoomMeta({ metaMapRef })

  // Entity CRUD
  const entityManager = useEntityManager({
    cameraRef: meta.cameraRef,
    connectionsRef,
    entityMapRef,
    isSynced: false, // not used internally; Yjs callbacks drive state
    stageRef: meta.stageRef,
  })

  // Connection CRUD
  const connectionManager = useConnectionManager({ connectionsRef })

  // Timeline (incident log) CRUD
  const timelineManager = useTimelineManager({
    incidentActionsRef,
    incidentLogRef,
    selectedEntityId: entityManager.selectedEntityId,
    user,
  })

  // Action item CRUD
  const actionManager = useActionManager({
    incidentActionsRef,
    incidentLogRef,
    user,
  })

  // Yjs connection + sync — populates all refs and calls setters above
  const { connectionStatus, isSynced, presence } = useYjsRoom({
    callbacks: {
      onConnectionsChange: connectionManager.setConnections,
      onEntitiesChange: entityManager.setEntities,
      onIncidentActionsChange: actionManager.setIncidentActions,
      onIncidentLogChange: timelineManager.setIncidentLog,
      onMetaChange: (summary, roles) => {
        meta.setIncidentSummary(summary)
        meta.setIncidentRoles(roles)
      },
    },
    connectionsRef,
    entityMapRef,
    incidentActionsRef,
    incidentLogRef,
    metaMapRef,
    providerRef,
    roomId,
    user,
  })

  // Keep presence selection in sync with Yjs awareness
  useEffect(() => {
    providerRef.current?.awareness.setLocalStateField(
      "selectedEntityId",
      entityManager.selectedEntityId,
    )
  }, [entityManager.selectedEntityId])

  const remoteSelections = useMemo(() => {
    return new Map(
      presence
        .filter((item) => item.selectedEntityId)
        .map((item) => [item.selectedEntityId as string, item.user.color]),
    )
  }, [presence])

  // Return the same public interface as the original useBoardRoom
  return {
    addIncidentLogEntry: timelineManager.addIncidentLogEntry,
    addPreparedIncidentLogEntry: timelineManager.addPreparedIncidentLogEntry,
    camera: meta.camera,
    cameraRef: meta.cameraRef,
    connectionStatus,
    connections: connectionManager.connections,
    createActionFromTimelineEntry: timelineManager.createActionFromTimelineEntry,
    createActionItem: actionManager.createActionItem,
    createBoardSeedAtViewportCenter: entityManager.createBoardSeedAtViewportCenter,
    createConnection: connectionManager.createConnection,
    createEntitiesAtViewportCenter: entityManager.createEntitiesAtViewportCenter,
    createEntityAtViewportCenter: entityManager.createEntityAtViewportCenter,
    deleteActionItem: actionManager.deleteActionItem,
    deleteConnection: connectionManager.deleteConnection,
    deleteEntity: entityManager.deleteEntity,
    deleteIncidentLogEntry: timelineManager.deleteIncidentLogEntry,
    entities: entityManager.entities,
    entityMapRef,
    incidentActions: actionManager.incidentActions,
    incidentLog: timelineManager.incidentLog,
    incidentLogDraft: timelineManager.incidentLogDraft,
    incidentLogEntryType: timelineManager.incidentLogEntryType,
    incidentRoles: meta.incidentRoles,
    incidentSummary: meta.incidentSummary,
    isSynced,
    logActionStatusChange: actionManager.logActionStatusChange,
    presence,
    providerRef,
    refreshStageRect: meta.refreshStageRect,
    remoteSelections,
    selectedEntityId: entityManager.selectedEntityId,
    setCamera: meta.setCamera,
    setIncidentLogDraft: timelineManager.setIncidentLogDraft,
    setIncidentLogEntryType: timelineManager.setIncidentLogEntryType,
    setIncidentRole: meta.setIncidentRole,
    setIncidentSummaryField: meta.setIncidentSummaryField,
    setSelectedEntityId: entityManager.setSelectedEntityId,
    stageRect: meta.stageRect,
    stageRef: meta.stageRef,
    updateActionItem: actionManager.updateActionItem,
    updateConnection: connectionManager.updateConnection,
    updateEntity: entityManager.updateEntity,
    user,
  }
}
