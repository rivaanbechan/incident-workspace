"use client"

import type {
  BoardConnection,
  IncidentActionItem,
  BoardEntity,
  BoardPoint,
  IncidentLogEntry,
  IncidentRoleAssignments,
  IncidentRoleKey,
  IncidentSummary,
  PresenceState,
  PresenceUser,
} from "@/features/incident-workspace/lib/board/types"
import {
  DEFAULT_CAMERA,
  createIncidentActionItem as createRoomActionItem,
  createIncidentRoleAssignments,
  createIncidentSummary,
  createTypedIncidentLogEntry,
  createBoardConnection as createRoomConnection,
  getCollabServerUrl,
  isPresenceState,
  nextZIndex,
  parseEntity,
  parseBoardConnection,
  parseIncidentActionItem,
  parseIncidentLogEntry,
  parseIncidentRoleAssignments,
  parseIncidentSummary,
  readEntities,
  readBoardConnections,
  readIncidentActionItems,
  readIncidentLog,
  screenToBoard,
  serializeBoardConnection,
  serializeIncidentActionItem,
  serializeEntity,
  serializeIncidentLogEntry,
  serializeIncidentRoleAssignments,
  serializeIncidentSummary,
} from "@/features/incident-workspace/components/board/boardCore"
import type { ConnectionStatus } from "@/features/incident-workspace/components/board/boardCore"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { WebsocketProvider } from "y-websocket"
import * as Y from "yjs"

type RoomAccessPayload = {
  collabToken: string
}

export function useBoardRoom(roomId: string, initialUser: PresenceUser) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const cameraRef = useRef(DEFAULT_CAMERA)
  const entitiesRef = useRef<BoardEntity[]>([])
  const hasConnectedRef = useRef(false)
  const entityMapRef = useRef<Y.Map<string> | null>(null)
  const connectionsRef = useRef<Y.Array<string> | null>(null)
  const incidentLogRef = useRef<Y.Array<string> | null>(null)
  const incidentActionsRef = useRef<Y.Array<string> | null>(null)
  const metaMapRef = useRef<Y.Map<string> | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)

  const [user] = useState<PresenceUser>(initialUser)
  const [camera, setCamera] = useState(DEFAULT_CAMERA)
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting")
  const [collabToken, setCollabToken] = useState<string | null>(null)
  const [entities, setEntities] = useState<BoardEntity[]>([])
  const [connections, setConnections] = useState<BoardConnection[]>([])
  const [incidentActions, setIncidentActions] = useState<IncidentActionItem[]>([])
  const [incidentLog, setIncidentLog] = useState<IncidentLogEntry[]>([])
  const [incidentLogDraft, setIncidentLogDraft] = useState("")
  const [incidentLogEntryType, setIncidentLogEntryType] =
    useState<IncidentLogEntry["type"]>("update")
  const [incidentSummary, setIncidentSummary] = useState<IncidentSummary>(
    createIncidentSummary(),
  )
  const [incidentRoles, setIncidentRoles] = useState<IncidentRoleAssignments>(
    createIncidentRoleAssignments(),
  )
  const [isSynced, setIsSynced] = useState(false)
  const [presence, setPresence] = useState<PresenceState[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [stageRect, setStageRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    entitiesRef.current = entities
  }, [entities])

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

  const refreshStageRect = useCallback(() => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    setStageRect(stage.getBoundingClientRect())
  }, [])

  useEffect(() => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    refreshStageRect()

    const resizeObserver = new ResizeObserver(refreshStageRect)
    resizeObserver.observe(stage)
    window.addEventListener("resize", refreshStageRect)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", refreshStageRect)
    }
  }, [refreshStageRect])

  useEffect(() => {
    if (!collabToken) {
      return
    }

    const doc = new Y.Doc()
    const provider = new WebsocketProvider(getCollabServerUrl(), roomId, doc, {
      params: {
        token: collabToken,
      },
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
      setEntities(readEntities(entityMap).filter((entity) => entity.type !== "screenTile"))
    }

    const syncConnections = () => {
      setConnections(readBoardConnections(connectionsList))
    }

    const syncIncidentLog = () => {
      setIncidentLog(readIncidentLog(incidentLogEntries))
    }

    const syncIncidentActions = () => {
      setIncidentActions(readIncidentActionItems(incidentActionsList))
    }

    const syncIncidentMeta = () => {
      setIncidentSummary(
        parseIncidentSummary(metaMap.get("incidentSummary")) ?? createIncidentSummary(),
      )
      setIncidentRoles(
        parseIncidentRoleAssignments(metaMap.get("incidentRoles")) ??
          createIncidentRoleAssignments(),
      )
    }

    const syncPresence = () => {
      const nextPresence = Array.from(provider.awareness.getStates().values())
        .filter(isPresenceState)
        .filter((item) => item.roomId === roomId && item.user.id !== user.id)

      setPresence(nextPresence)
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
      user,
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
  }, [collabToken, roomId, user])

  useEffect(() => {
    providerRef.current?.awareness.setLocalStateField(
      "selectedEntityId",
      selectedEntityId,
    )
  }, [selectedEntityId])

  const remoteSelections = useMemo(() => {
    return new Map(
      presence
        .filter((item) => item.selectedEntityId)
        .map((item) => [item.selectedEntityId as string, item.user.color]),
    )
  }, [presence])

  const createEntityAtViewportCenter = useCallback(
    (factory: (point: BoardPoint, zIndex: number) => BoardEntity) => {
      const stage = stageRef.current
      const entityMap = entityMapRef.current

      if (!stage || !entityMap) {
        return null
      }

      const rect = stage.getBoundingClientRect()
      const point = screenToBoard(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect,
        cameraRef.current,
      )

      const entity = factory(
        {
          x: point.x,
          y: point.y,
        },
        nextZIndex(entitiesRef.current),
      )

      const centeredEntity = {
        ...entity,
        x: point.x - entity.width / 2,
        y: point.y - entity.height / 2,
      }

      entityMap.set(centeredEntity.id, serializeEntity(centeredEntity))
      setSelectedEntityId(centeredEntity.id)
      return centeredEntity.id
    },
    [],
  )

  const createEntitiesAtViewportCenter = useCallback(
    (
      factory: (point: BoardPoint, startZIndex: number) => BoardEntity[],
      options?: { replaceEntityIds?: string[] },
    ) => {
      const stage = stageRef.current
      const entityMap = entityMapRef.current

      if (!stage || !entityMap) {
        return []
      }

      const rect = stage.getBoundingClientRect()
      const point = screenToBoard(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect,
        cameraRef.current,
      )

      const entities = factory(
        {
          x: point.x - 560,
          y: point.y - 360,
        },
        nextZIndex(entitiesRef.current),
      )

      const replaceEntityIds = options?.replaceEntityIds ?? []

      entityMap.doc?.transact(() => {
        replaceEntityIds.forEach((entityId) => {
          entityMap.delete(entityId)
        })

        entities.forEach((entity) => {
          entityMap.set(entity.id, serializeEntity(entity))
        })
      })

      setSelectedEntityId(entities[0]?.id ?? null)
      return entities.map((entity) => entity.id)
    },
    [],
  )

  const createBoardSeedAtViewportCenter = useCallback(
    (
      factory: (
        point: BoardPoint,
        startZIndex: number,
      ) => {
        connections: BoardConnection[]
        entities: BoardEntity[]
      },
      options?: { replaceEntityIds?: string[] },
    ) => {
      const stage = stageRef.current
      const entityMap = entityMapRef.current
      const connectionsList = connectionsRef.current

      if (!stage || !entityMap || !connectionsList) {
        return []
      }

      const rect = stage.getBoundingClientRect()
      const point = screenToBoard(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        rect,
        cameraRef.current,
      )

      const seed = factory(
        {
          x: point.x - 700,
          y: point.y - 440,
        },
        nextZIndex(entitiesRef.current),
      )

      const replaceEntityIds = new Set(options?.replaceEntityIds ?? [])
      const nextConnections = connectionsList
        .toArray()
        .map(parseBoardConnection)
        .filter((connection): connection is BoardConnection => connection !== null)
        .filter(
          (connection) =>
            !replaceEntityIds.has(connection.sourceEntityId) &&
            !replaceEntityIds.has(connection.targetEntityId),
        )

      entityMap.doc?.transact(() => {
        replaceEntityIds.forEach((entityId) => {
          entityMap.delete(entityId)
        })

        seed.entities.forEach((entity) => {
          entityMap.set(entity.id, serializeEntity(entity))
        })

        connectionsList.delete(0, connectionsList.length)
        connectionsList.push([
          ...nextConnections.map((connection) => serializeBoardConnection(connection)),
          ...seed.connections.map((connection) => serializeBoardConnection(connection)),
        ])
      })

      setSelectedEntityId(seed.entities[0]?.id ?? null)
      return seed.entities.map((entity) => entity.id)
    },
    [],
  )

  const updateEntity = useCallback(
    (entityId: string, updater: (entity: BoardEntity) => BoardEntity) => {
      const entityMap = entityMapRef.current

      if (!entityMap) {
        return
      }

      const current = parseEntity(entityMap.get(entityId))

      if (!current) {
        return
      }

      entityMap.set(entityId, serializeEntity(updater(current)))
    },
    [],
  )

  const deleteEntity = useCallback((entityId: string) => {
    const entityMap = entityMapRef.current
    const connectionsList = connectionsRef.current

    if (!entityMap) {
      return
    }

    if (connectionsList) {
      const nextConnections = connectionsList
        .toArray()
        .map(parseBoardConnection)
        .filter((connection): connection is BoardConnection => connection !== null)

      for (let index = nextConnections.length - 1; index >= 0; index -= 1) {
        const connection = nextConnections[index]

        if (
          connection.sourceEntityId === entityId ||
          connection.targetEntityId === entityId
        ) {
          connectionsList.delete(index, 1)
        }
      }
    }

    entityMap.delete(entityId)
    setSelectedEntityId((current) => (current === entityId ? null : current))
  }, [])

  const createConnection = useCallback(
    (
      sourceEntityId: string,
      targetEntityId: string,
      type: BoardConnection["type"],
      customLabel?: string,
    ) => {
      const connectionsList = connectionsRef.current

      if (!connectionsList || sourceEntityId === targetEntityId) {
        return
      }

      const existing = connectionsList
        .toArray()
        .map(parseBoardConnection)
        .find(
          (connection) =>
            connection &&
            connection.sourceEntityId === sourceEntityId &&
            connection.targetEntityId === targetEntityId &&
            connection.type === type &&
            (connection.customLabel ?? "") ===
              (type === "custom" ? customLabel?.trim() ?? "" : ""),
        )

      if (existing) {
        return
      }

      connectionsList.push([
        serializeBoardConnection(
          createRoomConnection(sourceEntityId, targetEntityId, type, customLabel),
        ),
      ])
    },
    [],
  )

  const deleteConnection = useCallback((connectionId: string) => {
    const connectionsList = connectionsRef.current

    if (!connectionsList) {
      return
    }

    const index = connectionsList
      .toArray()
      .findIndex((value) => parseBoardConnection(value)?.id === connectionId)

    if (index !== -1) {
      connectionsList.delete(index, 1)
    }
  }, [])

  const updateConnection = useCallback(
    (
      connectionId: string,
      updater: (connection: BoardConnection) => BoardConnection,
    ) => {
      const connectionsList = connectionsRef.current

      if (!connectionsList) {
        return
      }

      const index = connectionsList
        .toArray()
        .findIndex((value) => parseBoardConnection(value)?.id === connectionId)

      if (index === -1) {
        return
      }

      const current = parseBoardConnection(connectionsList.get(index))

      if (!current) {
        return
      }

      connectionsList.delete(index, 1)
      connectionsList.insert(index, [
        serializeBoardConnection(
          updater({
            ...current,
            updatedAt: Date.now(),
          }),
        ),
      ])
    },
    [],
  )

  const addIncidentLogEntry = useCallback(() => {
    const incidentLogEntries = incidentLogRef.current
    const body = incidentLogDraft.trim()

    if (!incidentLogEntries || !body) {
      return
    }

    incidentLogEntries.push([
      serializeIncidentLogEntry(
        createTypedIncidentLogEntry(user, {
          body,
          linkedEntityIds: selectedEntityId ? [selectedEntityId] : [],
          type: incidentLogEntryType,
        }),
      ),
    ])
    setIncidentLogDraft("")
    setIncidentLogEntryType("update")
  }, [incidentLogDraft, incidentLogEntryType, selectedEntityId, user])

  const addPreparedIncidentLogEntry = useCallback(
    (input: {
      body: string
      linkedEntityIds?: string[]
      type: IncidentLogEntry["type"]
    }) => {
      const incidentLogEntries = incidentLogRef.current
      const body = input.body.trim()

      if (!incidentLogEntries || !body) {
        return
      }

      incidentLogEntries.push([
        serializeIncidentLogEntry(
          createTypedIncidentLogEntry(user, {
            body,
            linkedEntityIds: input.linkedEntityIds ?? [],
            type: input.type,
          }),
        ),
      ])
    },
    [user],
  )

  const deleteIncidentLogEntry = useCallback((entryId: string) => {
    const incidentLogEntries = incidentLogRef.current
    const actions = incidentActionsRef.current

    if (!incidentLogEntries) {
      return
    }

    const index = incidentLogEntries
      .toArray()
      .findIndex((value) => parseIncidentLogEntry(value)?.id === entryId)

    if (index === -1) {
      return
    }

    incidentLogEntries.delete(index, 1)

    if (!actions) {
      return
    }

    actions.toArray().forEach((value, actionIndex) => {
      const action = parseIncidentActionItem(value)

      if (!action || action.sourceLogEntryId !== entryId) {
        return
      }

      actions.delete(actionIndex, 1)
      actions.insert(actionIndex, [
        serializeIncidentActionItem({
          ...action,
          sourceLogEntryId: null,
          updatedAt: Date.now(),
        }),
      ])
    })
  }, [])

  const setIncidentSummaryField = useCallback(
    <K extends keyof IncidentSummary>(field: K, value: IncidentSummary[K]) => {
      const metaMap = metaMapRef.current
      const currentSummary =
        parseIncidentSummary(metaMap?.get("incidentSummary")) ?? createIncidentSummary()

      if (!metaMap) {
        return
      }

      metaMap.set(
        "incidentSummary",
        serializeIncidentSummary({
          ...currentSummary,
          [field]: value,
        }),
      )
    },
    [],
  )

  const setIncidentRole = useCallback((role: IncidentRoleKey, value: string) => {
    const metaMap = metaMapRef.current
    const currentRoles =
      parseIncidentRoleAssignments(metaMap?.get("incidentRoles")) ??
      createIncidentRoleAssignments()

    if (!metaMap) {
      return
    }

    metaMap.set(
      "incidentRoles",
      serializeIncidentRoleAssignments({
        ...currentRoles,
        [role]: value,
      }),
    )
  }, [])

  const createActionItem = useCallback((
    title: string,
    options?: {
      linkedEntityIds?: string[]
      sourceLogEntryId?: string | null
    },
  ) => {
    const actions = incidentActionsRef.current
    const nextTitle = title.trim()

    if (!actions || !nextTitle) {
      return
    }

    actions.push([
      serializeIncidentActionItem(createRoomActionItem(nextTitle, options)),
    ])
  }, [])

  const createActionFromTimelineEntry = useCallback((entryId: string) => {
    const actions = incidentActionsRef.current
    const incidentLogEntries = incidentLogRef.current

    if (!actions || !incidentLogEntries) {
      return
    }

    const logIndex = incidentLogEntries
      .toArray()
      .findIndex((value) => parseIncidentLogEntry(value)?.id === entryId)

    if (logIndex === -1) {
      return
    }

    const sourceEntry = parseIncidentLogEntry(incidentLogEntries.get(logIndex))

    if (!sourceEntry) {
      return
    }

    const nextAction = createRoomActionItem(sourceEntry.body.split("\n")[0]?.trim() || "Follow up", {
      linkedEntityIds: sourceEntry.linkedEntityIds,
      sourceLogEntryId: sourceEntry.id,
    })

    actions.push([serializeIncidentActionItem(nextAction)])

    incidentLogEntries.delete(logIndex, 1)
    incidentLogEntries.insert(logIndex, [
      serializeIncidentLogEntry({
        ...sourceEntry,
        linkedActionIds: Array.from(new Set([...sourceEntry.linkedActionIds, nextAction.id])),
      }),
    ])
  }, [])

  const logActionStatusChange = useCallback(
    (
      actionId: string,
      fromStatus: IncidentActionItem["status"],
      toStatus: IncidentActionItem["status"],
      comment: string,
    ) => {
      const actions = incidentActionsRef.current
      const incidentLogEntries = incidentLogRef.current

      if (!actions || !incidentLogEntries || fromStatus === toStatus) {
        return
      }

      const action = actions
        .toArray()
        .map((value) => parseIncidentActionItem(value))
        .find((value) => value?.id === actionId)

      if (!action) {
        return
      }

      const nextComment = comment.trim()
      const statusLabels: Record<IncidentActionItem["status"], string> = {
        blocked: "Blocked",
        done: "Done",
        in_progress: "In Progress",
        open: "Open",
      }

      const body = [
        `Action status changed: ${action.title}`,
        `From: ${statusLabels[fromStatus]}`,
        `To: ${statusLabels[toStatus]}`,
        `Owner: ${action.owner.trim() || "Unassigned"}`,
        nextComment ? `Comment: ${nextComment}` : null,
      ]
        .filter(Boolean)
        .join("\n")

      incidentLogEntries.push([
        serializeIncidentLogEntry(
          createTypedIncidentLogEntry(user, {
            body,
            linkedActionIds: [action.id],
            linkedEntityIds: action.linkedEntityIds,
            type: "update",
          }),
        ),
      ])
    },
    [user],
  )

  const updateActionItem = useCallback(
    (actionId: string, updater: (action: IncidentActionItem) => IncidentActionItem) => {
      const actions = incidentActionsRef.current

      if (!actions) {
        return
      }

      const index = actions
        .toArray()
        .findIndex((value) => parseIncidentActionItem(value)?.id === actionId)

      if (index === -1) {
        return
      }

      const current = parseIncidentActionItem(actions.get(index))

      if (!current) {
        return
      }

      actions.delete(index, 1)
      actions.insert(
        index,
        [
          serializeIncidentActionItem(
            updater({
              ...current,
              updatedAt: Date.now(),
            }),
          ),
        ],
      )
    },
    [],
  )

  const deleteActionItem = useCallback((actionId: string) => {
    const actions = incidentActionsRef.current
    const incidentLogEntries = incidentLogRef.current

    if (!actions) {
      return
    }

    const index = actions
      .toArray()
      .findIndex((value) => parseIncidentActionItem(value)?.id === actionId)

    if (index === -1) {
      return
    }

    actions.delete(index, 1)

    if (!incidentLogEntries) {
      return
    }

    incidentLogEntries.toArray().forEach((value, logIndex) => {
      const entry = parseIncidentLogEntry(value)

      if (!entry || !entry.linkedActionIds.includes(actionId)) {
        return
      }

      incidentLogEntries.delete(logIndex, 1)
      incidentLogEntries.insert(logIndex, [
        serializeIncidentLogEntry({
          ...entry,
          linkedActionIds: entry.linkedActionIds.filter(
            (linkedActionId) => linkedActionId !== actionId,
          ),
        }),
      ])
    })
  }, [])

  return {
    addIncidentLogEntry,
    addPreparedIncidentLogEntry,
    camera,
    cameraRef,
    connectionStatus,
    connections,
    createConnection,
    createActionItem,
    createActionFromTimelineEntry,
    createBoardSeedAtViewportCenter,
    createEntityAtViewportCenter,
    createEntitiesAtViewportCenter,
    deleteActionItem,
    deleteEntity,
    deleteConnection,
    deleteIncidentLogEntry,
    entities,
    entityMapRef,
    incidentActions,
    incidentLogEntryType,
    incidentLog,
    incidentLogDraft,
    incidentRoles,
    incidentSummary,
    isSynced,
    presence,
    providerRef,
    remoteSelections,
    refreshStageRect,
    selectedEntityId,
    setCamera,
    setIncidentLogEntryType,
    setIncidentLogDraft,
    setIncidentRole,
    setIncidentSummaryField,
    setSelectedEntityId,
    stageRect,
    stageRef,
    logActionStatusChange,
    updateConnection,
    updateActionItem,
    updateEntity,
    user,
  }
}
