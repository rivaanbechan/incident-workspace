"use client"

import type { InvestigationSeverity, InvestigationStatus } from "@/lib/contracts/investigations"
import type { EntityRef } from "@/lib/contracts/entities"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import type {
  BoardConnectionType,
  BoardEntity,
  IncidentCardEntity,
  IncidentActionStatus,
  IncidentLogEntry,
  NoteEntity,
} from "@/features/incident-workspace/lib/board/types"
import { ActionKanbanBoard } from "@/features/incident-workspace/components/board/ActionKanbanBoard"
import { BoardCanvas } from "@/features/incident-workspace/components/board/BoardCanvas"
import { BoardEntityRenderer } from "@/features/incident-workspace/components/board/BoardEntityRenderer"
import { BoardSideRail } from "@/features/incident-workspace/components/board/BoardSideRail"
import { IncidentTimelineBoard } from "@/features/incident-workspace/components/board/IncidentTimelineBoard"
import { QuickCapturePalette } from "@/features/incident-workspace/components/board/QuickCapturePalette"
import {
  clamp,
  createIncidentCard,
  createInvestigationZone,
  createNote,
  nextBackgroundZIndex,
  parseEntity,
  screenToBoard,
  serializeEntity,
} from "@/features/incident-workspace/components/board/boardCore"
import { useBoardRoom } from "@/features/incident-workspace/components/board/useBoardRoom"
import { useBoardCommands } from "@/features/incident-workspace/components/board/useBoardCommands"
import {
  type ActiveScreenShare,
  type LiveShareView,
} from "@/features/incident-workspace/components/livekit/LiveSessionPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getEntityMapKind,
  isEditingElement,
  type MainWorkspaceTab,
  type PendingMapPrompt,
  type QuickCaptureMode,
  type RailPanel,
} from "@/features/incident-workspace/components/board/boardShellShared"
import { useToast } from "@/components/shell/ToastProvider"
import { createCaseRecordViaApi } from "@/features/incident-workspace/lib/caseRecordPromotion"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type BoardShellProps = {
  autoFitOnOpen?: boolean
  currentUser: CaseAccessContext
  initialEntityFocus?: {
    id: string
    kind: string | null
    label: string
    value: string
  } | null
  initialTab?: MainWorkspaceTab
  linkedCaseSeverity?: InvestigationSeverity | null
  linkedCaseId?: string | null
  linkedCaseStatus?: InvestigationStatus | null
  roomId: string
}

type InteractionState =
  | {
      pointerId: number
      startX: number
      startY: number
      type: "pan"
      viewX: number
      viewY: number
    }
  | {
      entityIds: string[]
      origins: Record<string, { x: number; y: number }>
      pointerId: number
      startClientX: number
      startClientY: number
      type: "drag"
    }
  | {
      entityId: string
      originHeight: number
      originWidth: number
      pointerId: number
      startClientX: number
      startClientY: number
      type: "resize"
    }
  | null

function getMinimumNoteHeight(mapKind?: NoteEntity["mapKind"]) {
  if (mapKind === "hypothesis") {
    return 500
  }

  if (mapKind === "evidence" || mapKind === "blocker" || mapKind === "handoff") {
    return 480
  }

  return 420
}

function getMinimumIncidentCardHeight(mapKind?: IncidentCardEntity["mapKind"]) {
  if (mapKind === "scope") {
    return 520
  }

  return 420
}

export function BoardShell({
  autoFitOnOpen = false,
  currentUser,
  initialEntityFocus = null,
  initialTab = "canvas",
  linkedCaseSeverity = null,
  linkedCaseId = null,
  linkedCaseStatus = null,
  roomId,
}: BoardShellProps) {
  const interactionRef = useRef<InteractionState>(null)
  const actionComposerRef = useRef<HTMLInputElement | null>(null)
  const feedComposerRef = useRef<HTMLTextAreaElement | null>(null)
  const hasAppliedInitialFitRef = useRef(false)
  const hasAppliedInitialEntityFocusRef = useRef(false)

  const [activeRailPanel, setActiveRailPanel] = useState<RailPanel>("tasks")
  const [activeMainTab, setActiveMainTab] = useState<MainWorkspaceTab>(initialTab)
  const [activeScreenShares, setActiveScreenShares] = useState<ActiveScreenShare[]>([])
  const [activeShareView, setActiveShareView] = useState<LiveShareView>({ mode: "none" })
  const [connectionDraftType, setConnectionDraftType] =
    useState<BoardConnectionType>("supports")
  const [connectionDraftCustomLabel, setConnectionDraftCustomLabel] = useState("")
  const [pendingConnectionSourceId, setPendingConnectionSourceId] = useState<string | null>(
    null,
  )
  const [pendingMapPrompt, setPendingMapPrompt] = useState<PendingMapPrompt | null>(null)
  useEffect(() => {
    if (!pendingMapPrompt) return
    const timer = setTimeout(() => setPendingMapPrompt(null), 8000)
    return () => clearTimeout(timer)
  }, [pendingMapPrompt])
  const [promotingSourceId, setPromotingSourceId] = useState<string | null>(null)
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])
  const [areZonesEditable, setAreZonesEditable] = useState(false)
  const [isRoomVisualMode, setIsRoomVisualMode] = useState(false)
  const [isBoardFullscreen, setIsBoardFullscreen] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false)
  const [quickCaptureDraft, setQuickCaptureDraft] = useState("")
  const [quickCaptureMode, setQuickCaptureMode] = useState<QuickCaptureMode>("timeline")
  const [quickCaptureTimelineType, setQuickCaptureTimelineType] =
    useState<IncidentLogEntry["type"]>("update")
  const { showToast } = useToast()
  const assignmentSnapshotRef = useRef<Map<string, string>>(new Map())
  const actionStatusSnapshotRef = useRef<Map<string, IncidentActionStatus>>(new Map())
  const incidentLogSnapshotRef = useRef<Set<string>>(new Set())
  const hasInitializedAssignmentsRef = useRef(false)
  const hasInitializedActionStatusesRef = useRef(false)
  const hasInitializedIncidentLogRef = useRef(false)
  const notificationPermissionRequestedRef = useRef(false)
  const connectionToneMap: Record<
    BoardConnectionType,
    { color: string; label: string }
  > = {
    blocks: { color: "#dc2626", label: "Blocks" },
    custom: { color: "#7c3aed", label: "Custom" },
    mitigates: { color: "#16a34a", label: "Mitigates" },
    relates_to: { color: "hsl(var(--muted-foreground))", label: "Relates to" },
    supports: { color: "#2563eb", label: "Supports" },
  }
  const isCanvasVisualMode = isRoomVisualMode
  const isWorkspaceVisualMode = isRoomVisualMode
  const setIsCanvasVisualMode = setIsRoomVisualMode
  const setIsWorkspaceVisualMode = setIsRoomVisualMode

  useEffect(() => {
    setActiveMainTab(initialTab)
    setIsRoomVisualMode(false)
  }, [initialTab])

  const {
    addIncidentLogEntry,
    addPreparedIncidentLogEntry,
    camera,
    cameraRef,
    connectionStatus,
    connections,
    createConnection,
    createActionItem,
    createActionFromTimelineEntry,
    createEntityAtViewportCenter,
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
    incidentSummary,
    isSynced,
    logActionStatusChange,
    presence,
    providerRef,
    refreshStageRect,
    remoteSelections,
    selectedEntityId,
    setCamera,
    setIncidentLogEntryType,
    setIncidentLogDraft,
    setSelectedEntityId: setRoomSelectedEntityId,
    stageRect,
    stageRef,
    updateConnection,
    updateActionItem,
    updateEntity,
    user,
  } = useBoardRoom(roomId, {
    color: currentUser.color,
    id: currentUser.id,
    name: currentUser.name,
  })

  const setSelectedEntityId = useCallback((entityId: string | null) => {
    setRoomSelectedEntityId(entityId)
    setSelectedEntityIds(entityId ? [entityId] : [])
  }, [setRoomSelectedEntityId])

  useEffect(() => {
    if (!selectedEntityId) {
      setSelectedEntityIds([])
      return
    }

    setSelectedEntityIds((current) =>
      current.length === 1 && current[0] === selectedEntityId ? current : [selectedEntityId],
    )
  }, [selectedEntityId])

  const clearEntitySelection = () => {
    setSelectedEntityId(null)
    setSelectedEntityIds([])
  }

  const participantOwners = useMemo(() => {
    const seenNames = new Set<string>()
    const owners: Array<{ label: string; value: string }> = []
    const participants = [user, ...presence.map((item) => item.user)]

    participants.forEach((participant, index) => {
      const nextName = participant.name.trim()

      if (!nextName || seenNames.has(nextName)) {
        return
      }

      seenNames.add(nextName)
      owners.push({
        label: index === 0 ? `${nextName} (You)` : nextName,
        value: nextName,
      })
    })

    return owners
  }, [presence, user])

  const myAssignedActions = useMemo(
    () => incidentActions.filter((action) => action.owner === user.name),
    [incidentActions, user.name],
  )
  const remainingAssignedTaskCount = useMemo(
    () => myAssignedActions.filter((action) => action.status !== "done").length,
    [myAssignedActions],
  )

  const resetQuickCapture = useCallback(() => {
    setQuickCaptureDraft("")
    setQuickCaptureMode("timeline")
    setQuickCaptureTimelineType("update")
  }, [])

  const closeQuickCapture = useCallback(() => {
    setIsQuickCaptureOpen(false)
    resetQuickCapture()
    window.requestAnimationFrame(() => {
      stageRef.current?.focus()
    })
  }, [resetQuickCapture, stageRef])

  const selectSingleEntity = useCallback((entityId: string) => {
    setSelectedEntityId(entityId)
    setSelectedEntityIds([entityId])
  }, [setSelectedEntityId])

  const toggleEntitySelection = useCallback((entityId: string) => {
    if (selectedEntityIds.includes(entityId)) {
      const next = selectedEntityIds.filter((id) => id !== entityId)
      setSelectedEntityIds(next)
      if (selectedEntityId === entityId) {
        setRoomSelectedEntityId(next[next.length - 1] ?? null)
      }
      return
    }

    setRoomSelectedEntityId(entityId)
    setSelectedEntityIds([...selectedEntityIds, entityId])
  }, [selectedEntityId, selectedEntityIds, setRoomSelectedEntityId])

  const beginEntityDrag = useCallback((
    event: React.PointerEvent<HTMLElement | HTMLDivElement | HTMLButtonElement>,
    entityId: string,
  ) => {
    const draggedIds = selectedEntityIds.includes(entityId)
      ? selectedEntityIds
      : [entityId]

    const origins = draggedIds.reduce<Record<string, { x: number; y: number }>>(
      (result, currentEntityId) => {
        const currentEntity = entities.find((item) => item.id === currentEntityId)

        if (currentEntity) {
          result[currentEntityId] = {
            x: currentEntity.x,
            y: currentEntity.y,
          }
        }

        return result
      },
      {},
    )

    interactionRef.current = {
      entityIds: draggedIds,
      origins,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      type: "drag",
    }
  }, [entities, selectedEntityIds])

  useEffect(() => {
    const updatePresencePointer = (event: PointerEvent) => {
      const provider = providerRef.current
      const stage = stageRef.current

      if (!provider || !stage) {
        return
      }

      const rect = stage.getBoundingClientRect()

      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return
      }

      const nextCursor = screenToBoard(
        event.clientX,
        event.clientY,
        rect,
        cameraRef.current,
      )

      provider.awareness.setLocalStateField("cursor", nextCursor)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current

      updatePresencePointer(event)

      if (!interaction || event.pointerId !== interaction.pointerId) {
        return
      }

      if (interaction.type === "pan") {
        setIsPanning(true)
        setCamera({
          x: interaction.viewX + event.clientX - interaction.startX,
          y: interaction.viewY + event.clientY - interaction.startY,
          zoom: cameraRef.current.zoom,
        })

        return
      }

      const entityMap = entityMapRef.current

      if (!entityMap) {
        return
      }

      if (interaction.type === "drag") {
        const dx = (event.clientX - interaction.startClientX) / cameraRef.current.zoom
        const dy = (event.clientY - interaction.startClientY) / cameraRef.current.zoom

        interaction.entityIds.forEach((entityId) => {
          const nextEntity = parseEntity(entityMap.get(entityId))
          const origin = interaction.origins[entityId]

          if (!nextEntity || !origin) {
            return
          }

          entityMap.set(
            nextEntity.id,
            serializeEntity({
              ...nextEntity,
              updatedAt: Date.now(),
              x: origin.x + dx,
              y: origin.y + dy,
            }),
          )
        })

        return
      }

      const current = parseEntity(entityMap.get(interaction.entityId))

      if (!current) {
        return
      }

      const nextWidth = clamp(
        interaction.originWidth +
          (event.clientX - interaction.startClientX) / cameraRef.current.zoom,
        current.type === "investigationZone" ? 320 : 180,
        current.type === "investigationZone" ? 8000 : 2400,
      )
      const nextHeight = clamp(
        interaction.originHeight +
          (event.clientY - interaction.startClientY) / cameraRef.current.zoom,
        current.type === "investigationZone"
          ? 220
          : current.type === "incidentCard"
            ? getMinimumIncidentCardHeight(current.mapKind)
            : current.type === "note"
              ? getMinimumNoteHeight(current.mapKind)
              : 120,
        current.type === "investigationZone" ? 5000 : 1800,
      )

      entityMap.set(
        current.id,
        serializeEntity({
          ...current,
          height: nextHeight,
          updatedAt: Date.now(),
          width: nextWidth,
        }),
      )
    }

    const handlePointerUp = (event: PointerEvent) => {
      const interaction = interactionRef.current

      if (!interaction || interaction.pointerId !== event.pointerId) {
        return
      }

      interactionRef.current = null
      setIsPanning(false)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [cameraRef, entityMapRef, providerRef, setCamera, setRoomSelectedEntityId, stageRef])

  useEffect(() => {
    if (activeMainTab !== "canvas") {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      refreshStageRect()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeMainTab, refreshStageRect])

  useEffect(() => {
    if (activeMainTab !== "canvas") {
      return
    }

    let firstFrameId = 0
    let secondFrameId = 0

    firstFrameId = window.requestAnimationFrame(() => {
      stageRef.current?.focus()
      secondFrameId = window.requestAnimationFrame(() => {
        stageRef.current?.focus()
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
    }
  }, [activeMainTab, stageRef])

  useEffect(() => {
    if (activeMainTab !== "canvas") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditingElement(event.target)) {
        return
      }

      setIsRoomVisualMode(true)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMainTab])

  useEffect(() => {
    if (activeMainTab === "canvas") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isEditingElement(event.target)) {
        return
      }

      event.preventDefault()

      if (isRoomVisualMode) {
        setActiveMainTab("canvas")
        return
      }

      setIsRoomVisualMode(true)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMainTab, isRoomVisualMode])

  useEffect(() => {
    const orderedTabs: MainWorkspaceTab[] = ["canvas", "actions", "feed"]

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !isRoomVisualMode
      ) {
        return
      }

      if (isEditingElement(event.target)) {
        return
      }

      event.preventDefault()
      setActiveMainTab((current) => {
        const currentIndex = orderedTabs.indexOf(current)

        if (currentIndex === -1) {
          return "canvas"
        }

        return orderedTabs[(currentIndex + 1) % orderedTabs.length]
      })
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isRoomVisualMode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isRoomVisualMode || isEditingElement(event.target)) {
        return
      }

      if (event.key === "a") {
        event.preventDefault()
        openMainTab("actions")
        return
      }

      if (event.key === "c") {
        event.preventDefault()
        openMainTab("canvas")
        return
      }

      if (event.key === "f") {
        event.preventDefault()
        openMainTab("feed")
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isRoomVisualMode])

  const enterWorkspaceInsertMode = (tab: "actions" | "feed") => {
    setIsRoomVisualMode(false)

    window.requestAnimationFrame(() => {
      if (tab === "actions") {
        actionComposerRef.current?.focus()
        return
      }

      feedComposerRef.current?.focus()
    })
  }

  const openMainTab = (tab: MainWorkspaceTab) => {
    setActiveMainTab(tab)
  }

  const focusEntityOnCanvas = useCallback((entityId: string | null) => {
    if (!entityId) {
      return
    }

    const stage = stageRef.current
    const entity = entities.find((item) => item.id === entityId)

    if (!stage || !entity) {
      return
    }

    const rect = stage.getBoundingClientRect()
    const paddingX = 160
    const paddingY = 132
    const availableWidth = Math.max(rect.width - paddingX * 2, 220)
    const availableHeight = Math.max(rect.height - paddingY * 2, 220)
    const targetZoom = clamp(
      Math.min(availableWidth / entity.width, availableHeight / entity.height),
      0.58,
      1.9,
    )
    const entityCenterX = entity.x + entity.width / 2
    const entityCenterY = entity.y + entity.height / 2

    setCamera({
      x: rect.width / 2 - entityCenterX * targetZoom,
      y: rect.height / 2 - entityCenterY * targetZoom,
      zoom: targetZoom,
    })
  }, [entities, setCamera, stageRef])

  const fitCanvasToScreen = useCallback(() => {
    const stage = stageRef.current

    if (!stage || entities.length === 0) {
      return
    }

    const rect = stage.getBoundingClientRect()
    const minX = Math.min(...entities.map((entity) => entity.x))
    const minY = Math.min(...entities.map((entity) => entity.y))
    const maxX = Math.max(...entities.map((entity) => entity.x + entity.width))
    const maxY = Math.max(...entities.map((entity) => entity.y + entity.height))
    const boundsWidth = Math.max(maxX - minX, 1)
    const boundsHeight = Math.max(maxY - minY, 1)
    const padding = 96
    const availableWidth = Math.max(rect.width - padding * 2, 160)
    const availableHeight = Math.max(rect.height - padding * 2, 160)
    const nextZoom = clamp(
      Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight) * 0.94,
      0.12,
      3.2,
    )
    const centeredWidth = boundsWidth * nextZoom
    const centeredHeight = boundsHeight * nextZoom

    setCamera({
      x: padding + (availableWidth - centeredWidth) / 2 - minX * nextZoom,
      y: padding + (availableHeight - centeredHeight) / 2 - minY * nextZoom,
      zoom: nextZoom,
    })
  }, [entities, setCamera, stageRef])

  useEffect(() => {
    if (!autoFitOnOpen || initialTab !== "canvas") {
      hasAppliedInitialFitRef.current = false
      return
    }

    if (hasAppliedInitialFitRef.current || activeMainTab !== "canvas" || entities.length === 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      fitCanvasToScreen()
      hasAppliedInitialFitRef.current = true
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeMainTab, autoFitOnOpen, entities.length, fitCanvasToScreen, initialTab])

  useEffect(() => {
    if (
      !initialEntityFocus ||
      hasAppliedInitialEntityFocusRef.current ||
      (activeMainTab !== "canvas" && activeMainTab !== "feed")
    ) {
      return
    }

    if (activeMainTab === "feed") {
      hasAppliedInitialEntityFocusRef.current = true
      setIncidentLogEntryType("update")
      setIncidentLogDraft(
        `Entity context: ${initialEntityFocus.label}\nObserved signal:\nWhy it matters:\nNext step:`,
      )
      return
    }

    if (entities.length === 0) {
      return
    }

    const labelNeedle = initialEntityFocus.label.trim().toLowerCase()
    const valueNeedle = initialEntityFocus.value.trim().toLowerCase()
    const matched = entities.find((entity) => {
      const title =
        "title" in entity && typeof entity.title === "string" ? entity.title.toLowerCase() : ""
      const body =
        "body" in entity && typeof entity.body === "string" ? entity.body.toLowerCase() : ""
      const label =
        "label" in entity && typeof entity.label === "string" ? entity.label.toLowerCase() : ""

      return (
        title.includes(labelNeedle) ||
        body.includes(labelNeedle) ||
        label.includes(labelNeedle) ||
        title.includes(valueNeedle) ||
        body.includes(valueNeedle) ||
        label.includes(valueNeedle)
      )
    })

    hasAppliedInitialEntityFocusRef.current = true

    if (matched) {
      setSelectedEntityId(matched.id)
      focusEntityOnCanvas(matched.id)
      return
    }

    setActiveMainTab("feed")
  }, [
    activeMainTab,
    entities,
    focusEntityOnCanvas,
    initialEntityFocus,
    setIncidentLogDraft,
    setIncidentLogEntryType,
    setSelectedEntityId,
  ])

  const handleCreateNote = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Hypothesis:\nWhy it fits:\nHow to verify:",
      height: getMinimumNoteHeight("hypothesis"),
      mapKind: "hypothesis",
      owner: "",
      state: "new",
      title: "New hypothesis",
    }))

    if (entityId) {
      setPendingMapPrompt(null)
    }
  }

  const handleCreateIncidentCard = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createIncidentCard(point, zIndex),
      body: "Affected scope:\nObserved signal:\nImpact summary:",
      height: getMinimumIncidentCardHeight("scope"),
      mapKind: "scope",
      owner: "",
      scopeType: "service",
      title: "Impact assessment",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  const handleCreateStatusMarker = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Blocker:\nWhat is blocked:\nUnblock condition:",
      color: "#fee2e2",
      height: getMinimumNoteHeight("blocker"),
      mapKind: "blocker",
      owner: "",
      title: "New blocker",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "action" })
    }
  }

  const handleCreateZone = () => {
    createEntityAtViewportCenter((point) => {
      const nextZ = nextBackgroundZIndex(entities)

      return {
        ...createInvestigationZone(point, nextZ),
        title: "Investigation zone",
      }
    })
    setPendingMapPrompt(null)
  }

  const handleCreateHypothesis = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Hypothesis:\nWhy it fits:\nHow to verify:",
      height: getMinimumNoteHeight("hypothesis"),
      mapKind: "hypothesis",
      owner: "",
      state: "new",
      title: "Hypothesis",
    }))

    if (entityId) {
      setPendingMapPrompt(null)
    }
  }

  const handleCreateImpactNote = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createIncidentCard(point, zIndex),
      body: "Affected scope:\nObserved signal:\nImpact summary:",
      height: getMinimumIncidentCardHeight("scope"),
      mapKind: "scope",
      owner: "",
      scopeType: "service",
      title: "Impact assessment",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  const handleCreateEvidenceNote = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Evidence summary:\nWhy it matters:\nDeep link / source:",
      color: "#dbeafe",
      height: getMinimumNoteHeight("evidence"),
      mapKind: "evidence",
      sourceLabel: "",
      title: "Evidence reference",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  const handleCreateBlocker = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Blocker:\nWhat is blocked:\nUnblock condition:",
      color: "#fee2e2",
      height: getMinimumNoteHeight("blocker"),
      mapKind: "blocker",
      owner: "",
      title: "Blocker",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "action" })
    }
  }

  const handleCreateHandoff = () => {
    const entityId = createEntityAtViewportCenter((point, zIndex) => ({
      ...createNote(point, zIndex),
      body: "Context:\nCurrent state:\nNext action:\nOwner:",
      height: getMinimumNoteHeight("handoff"),
      mapKind: "handoff",
      owner: "",
      title: "Handoff",
    }))

    if (entityId) {
      setPendingMapPrompt({ entityId, recommendedAction: "feed" })
    }
  }

  const handleDeleteSelectedEntity = () => {
    const entityIdsToDelete = Array.from(
      new Set(
        selectedEntityIds.length > 0
          ? selectedEntityIds
          : selectedEntityId
            ? [selectedEntityId]
            : [],
      ),
    )

    if (entityIdsToDelete.length === 0) {
      return
    }

    entityIdsToDelete.forEach((entityId) => {
      deleteEntity(entityId)
    })
    setRoomSelectedEntityId(null)
    setSelectedEntityIds([])
  }

  const selectedEntity = selectedEntityId
    ? entities.find((entity) => entity.id === selectedEntityId) ?? null
    : null
  const selectedEntityLabel =
    selectedEntity?.type === "statusMarker"
      ? selectedEntity.label
      : selectedEntity?.title ?? null
  const selectedEntityConnections = selectedEntityId
    ? connections.filter(
        (connection) =>
          connection.sourceEntityId === selectedEntityId ||
          connection.targetEntityId === selectedEntityId,
      )
    : []

  const getEntityLabel = useCallback((entityId: string) => {
    const entity = entities.find((item) => item.id === entityId)

    if (!entity) {
      return "Unknown"
    }

    return entity.type === "statusMarker" ? entity.label : entity.title
  }, [entities])

  const getEntityFeedTemplate = (entity: BoardEntity) => {
    const mapKind = getEntityMapKind(entity)

    if (mapKind === "scope" && entity.type === "incidentCard") {
      return {
        draft: `Impact update: ${entity.title}\nImpact summary: ${entity.body.split("\n")[0] || "Confirm affected scope."}\nOwner: ${entity.owner?.trim() || "Unassigned"}`,
        type: "update" as const,
      }
    }

    if (mapKind === "handoff" && entity.type === "note") {
      return {
        draft: `Handoff: ${entity.title}\nCurrent state: ${entity.body.split("\n")[0] || "Summarize current state."}\nOwner: ${entity.owner?.trim() || "Unassigned"}`,
        type: "owner_change" as const,
      }
    }

    if (mapKind === "evidence" && entity.type === "note") {
      return {
        draft: `Evidence update: ${entity.title}\nSummary: ${entity.body.split("\n")[0] || "Add supporting evidence."}\nSource: ${entity.sourceLabel?.trim() || "Not set"}`,
        type: "update" as const,
      }
    }

    return {
      draft: `Board context: ${getEntityLabel(entity.id)}`,
      type: "update" as const,
    }
  }

  const getEntityRefForBoardEntity = (entity: BoardEntity): EntityRef | null => {
    if (entity.type === "incidentCard") {
      const kind =
        entity.scopeType === "identity"
          ? "identity"
          : entity.scopeType === "service"
            ? "service"
            : entity.scopeType === "tenant"
              ? "cloud-resource"
              : entity.scopeType === "detection"
                ? "alert"
                : "host"

      return {
        id: entity.id,
        kind,
        label: entity.title,
        sourceModule: "incident-workspace",
      }
    }

    return null
  }

  const buildLinkedEntityRefs = (linkedEntityIds: string[]) =>
    linkedEntityIds.flatMap((entityId) => {
      const entity = entities.find((item) => item.id === entityId)
      const ref = entity ? getEntityRefForBoardEntity(entity) : null

      return ref ? [ref] : []
    })

  const persistCaseRecord = async (
    sourceId: string,
    record: {
      kind: "action" | "decision" | "evidence" | "finding" | "hypothesis" | "timeline-event"
      payload?: Record<string, unknown>
      relatedEntities?: EntityRef[]
      sourceType: "action-item" | "incident-card" | "note" | "timeline-entry"
      summary: string
      title: string
    },
  ) => {
    if (!linkedCaseId) {
      showToast({
        message: "Link this room to a case before promoting durable records.",
        tone: "error",
      })
      return
    }

    try {
      setPromotingSourceId(sourceId)
      await createCaseRecordViaApi({
        caseId: linkedCaseId,
        record: {
          deepLink: {
            href:
              record.sourceType === "action-item"
                ? `/board/${roomId}?tab=actions`
                : record.sourceType === "timeline-entry"
                  ? `/board/${roomId}?tab=feed`
                  : `/board/${roomId}`,
            moduleId: "incident-workspace",
          },
          kind: record.kind,
          payload: record.payload ?? {},
          relatedEntities: record.relatedEntities ?? [],
          sourceId,
          sourceModule: "incident-workspace",
          sourceRoomId: roomId,
          sourceType: record.sourceType,
          summary: record.summary,
          title: record.title,
        },
      })

      showToast({
        message: `Promoted "${record.title}" into the case.`,
        tone: "success",
      })
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Unable to promote this record.",
        tone: "error",
      })
    } finally {
      setPromotingSourceId(null)
    }
  }

  const promoteSelectedEntityToCase = () => {
    if (!selectedEntity || (selectedEntity.type !== "incidentCard" && selectedEntity.type !== "note")) {
      return
    }

    if (selectedEntity.type === "incidentCard") {
      const entityRef = getEntityRefForBoardEntity(selectedEntity)
      void persistCaseRecord(selectedEntity.id, {
        kind: "finding",
        payload: {
          body: selectedEntity.body,
          owner: selectedEntity.owner ?? "",
          scopeType: selectedEntity.scopeType ?? null,
          severity: selectedEntity.severity,
          status: selectedEntity.status,
        },
        relatedEntities: entityRef ? [entityRef] : [],
        sourceType: "incident-card",
        summary: selectedEntity.body || "Incident card promoted from the workspace.",
        title: selectedEntity.title,
      })
      return
    }

    const noteKind =
      selectedEntity.mapKind === "hypothesis"
        ? "hypothesis"
        : selectedEntity.mapKind === "evidence"
          ? "evidence"
          : "finding"

    void persistCaseRecord(selectedEntity.id, {
      kind: noteKind,
      payload: {
        body: selectedEntity.body,
        mapKind: selectedEntity.mapKind ?? null,
        owner: selectedEntity.owner ?? "",
        sourceLabel: selectedEntity.sourceLabel ?? "",
        state: selectedEntity.state ?? null,
      },
      relatedEntities: [],
      sourceType: "note",
      summary: selectedEntity.body || "Workspace note promoted into the case.",
      title: selectedEntity.title,
    })
  }

  const promoteTimelineEntryToCase = (entry: IncidentLogEntry) => {
    void persistCaseRecord(entry.id, {
      kind: entry.type === "decision" ? "decision" : "timeline-event",
      payload: {
        authorId: entry.authorId,
        authorName: entry.authorName,
        entryType: entry.type,
        linkedActionIds: entry.linkedActionIds,
        linkedEntityIds: entry.linkedEntityIds,
      },
      relatedEntities: buildLinkedEntityRefs(entry.linkedEntityIds),
      sourceType: "timeline-entry",
      summary: entry.body,
      title: getTimelineEntrySummary(entry),
    })
  }

  const promoteActionToCase = (action: typeof incidentActions[number]) => {
    void persistCaseRecord(action.id, {
      kind: "action",
      payload: {
        linkedEntityIds: action.linkedEntityIds,
        owner: action.owner,
        sourceLogEntryId: action.sourceLogEntryId,
        status: action.status,
      },
      relatedEntities: buildLinkedEntityRefs(action.linkedEntityIds),
      sourceType: "action-item",
      summary: `Owner: ${action.owner.trim() || "Unassigned"} · Status: ${action.status.replaceAll("_", " ")}`,
      title: action.title,
    })
  }

  const openFeedForEntity = (entityId: string) => {
    const entity = entities.find((item) => item.id === entityId)

    if (!entity) {
      return
    }

    const feedTemplate = getEntityFeedTemplate(entity)

    selectSingleEntity(entityId)
    setIncidentLogEntryType(feedTemplate.type)
    setIncidentLogDraft(feedTemplate.draft)
    openMainTab("feed")
    setPendingMapPrompt((current) => (current?.entityId === entityId ? null : current))
  }

  const logEntityToFeed = (entityId: string) => {
    const entity = entities.find((item) => item.id === entityId)

    if (!entity) {
      return
    }

    const feedTemplate = getEntityFeedTemplate(entity)

    selectSingleEntity(entityId)
    addPreparedIncidentLogEntry({
      body: feedTemplate.draft,
      linkedEntityIds: [entityId],
      type: feedTemplate.type,
    })
    setPendingMapPrompt((current) => (current?.entityId === entityId ? null : current))
    openMainTab("feed")
  }

  const createActionForEntity = (entityId: string) => {
    const entity = entities.find((item) => item.id === entityId)

    if (!entity) {
      return
    }

    selectSingleEntity(entityId)
    createActionItem(`${getEntityLabel(entityId)} follow-up`, {
      linkedEntityIds: [entityId],
    })
    openMainTab("actions")
    setPendingMapPrompt((current) => (current?.entityId === entityId ? null : current))
  }

  const handleCreateActionFromSelected = () => {
    if (!selectedEntityLabel || !selectedEntityId) {
      return
    }

    createActionItem(`Follow up: ${selectedEntityLabel}`, {
      linkedEntityIds: [selectedEntityId],
    })
    openMainTab("actions")
  }

  const handleAddSelectedToTimeline = () => {
    if (!selectedEntityId || !selectedEntityLabel) {
      return
    }

    openFeedForEntity(selectedEntityId)
  }

  const handleRevealEntity = (entityId: string) => {
    selectSingleEntity(entityId)
    setIsCanvasVisualMode(true)
    setActiveMainTab("canvas")
  }

  const getTimelineEntrySummary = (entry: IncidentLogEntry) =>
    entry.body.split("\n")[0]?.trim() || "Timeline entry"

  const getActionLabel = (actionId: string) => {
    const action = incidentActions.find((item) => item.id === actionId)

    return action?.title ?? "Unknown action"
  }

  const getTimelineEntryLabel = (entryId: string) => {
    const entry = incidentLog.find((item) => item.id === entryId)

    return entry ? getTimelineEntrySummary(entry) : "Unknown timeline entry"
  }

  const selectedEntityMapKind = getEntityMapKind(selectedEntity)
  const selectedEntityLinkedEntryCount = selectedEntityId
    ? incidentLog.filter((entry) => entry.linkedEntityIds.includes(selectedEntityId)).length
    : 0
  const selectedEntityLinkedActionCount = selectedEntityId
    ? incidentActions.filter((action) => action.linkedEntityIds.includes(selectedEntityId)).length
    : 0
  const visiblePendingMapPrompt =
    pendingMapPrompt &&
    activeMainTab === "canvas" &&
    entities.some((entity) => entity.id === pendingMapPrompt.entityId)
      ? pendingMapPrompt
      : null
  const hasActiveScreenShares = activeScreenShares.length > 0
  const visibleSeverity = linkedCaseSeverity ?? incidentSummary.severity
  const visibleStatus = linkedCaseStatus ?? incidentSummary.status

  const handleConnectToEntity = useCallback((targetEntityId: string) => {
    if (!pendingConnectionSourceId || pendingConnectionSourceId === targetEntityId) {
      return
    }

    createConnection(
      pendingConnectionSourceId,
      targetEntityId,
      connectionDraftType,
      connectionDraftType === "custom" ? connectionDraftCustomLabel : undefined,
    )
    setPendingConnectionSourceId(null)
    if (connectionDraftType === "custom") {
      setConnectionDraftCustomLabel("")
      setConnectionDraftType("supports")
    }
  }, [
    connectionDraftCustomLabel,
    connectionDraftType,
    createConnection,
    pendingConnectionSourceId,
  ])

  const renameConnectionLabel = useCallback(
    (connectionId: string, currentLabel: string) => {
      if (typeof window === "undefined") {
        return
      }

      const nextLabel = window.prompt("Rename this connection", currentLabel)

      if (!nextLabel || !nextLabel.trim()) {
        return
      }

      updateConnection(connectionId, (current) => ({
        ...current,
        customLabel: nextLabel.trim(),
        type: "custom",
      }))
    },
    [updateConnection],
  )

  const isLinkableArtifactEntity = (entity: BoardEntity | null) =>
    entity?.type === "incidentCard" || entity?.type === "note"

  const handleShiftLinkToEntity = useCallback(
    (targetEntityId: string) => {
      if (!selectedEntityId || selectedEntityId === targetEntityId || typeof window === "undefined") {
        return false
      }

      const sourceEntity =
        entities.find((entity) => entity.id === selectedEntityId) ?? null
      const targetEntity =
        entities.find((entity) => entity.id === targetEntityId) ?? null

      if (!isLinkableArtifactEntity(sourceEntity) || !isLinkableArtifactEntity(targetEntity)) {
        return false
      }

      const nextLabel = window.prompt(
        "Name this connection",
        connectionDraftType === "custom"
          ? connectionDraftCustomLabel.trim()
          : `${getEntityLabel(selectedEntityId)} -> ${getEntityLabel(targetEntityId)}`,
      )

      if (!nextLabel || !nextLabel.trim()) {
        return true
      }

      createConnection(selectedEntityId, targetEntityId, "custom", nextLabel.trim())
      setPendingConnectionSourceId(null)
      setConnectionDraftCustomLabel("")
      setConnectionDraftType("supports")
      return true
    },
    [
      connectionDraftCustomLabel,
      connectionDraftType,
      createConnection,
      entities,
      getEntityLabel,
      selectedEntityId,
    ],
  )

  const openShareGallery = () => {
    if (!hasActiveScreenShares) {
      return
    }

    setActiveShareView({ mode: "gallery" })
  }

  const openIndexedShare = (index: number) => {
    const share = activeScreenShares[index]

    if (!share) {
      return
    }

    setActiveShareView({
      mode: "focused",
      openedFromGallery: activeShareView.mode === "gallery",
      trackId: share.trackId,
    })
  }

  useEffect(() => {
    if (activeMainTab !== "canvas" || activeShareView.mode === "none") {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditingElement(event.target)) {
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        setActiveShareView((current) =>
          current.mode === "focused"
            ? current.openedFromGallery
              ? { mode: "gallery" }
              : { mode: "none" }
            : { mode: "none" },
        )
        return
      }

      if (!/^[0-9]$/.test(event.key)) {
        return
      }

      const digit = Number(event.key)

      if (digit === 0) {
        if (activeScreenShares.length > 0) {
          event.preventDefault()
          setActiveShareView({ mode: "gallery" })
        }
        return
      }

      if (digit <= activeScreenShares.length) {
        const share = activeScreenShares[digit - 1]

        if (!share) {
          return
        }

        event.preventDefault()
        setActiveShareView({
          mode: "focused",
          openedFromGallery: false,
          trackId: share.trackId,
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeMainTab, activeScreenShares, activeShareView.mode])

  const {
    commandHints,
    isBoardFocused,
    isHelpOpen,
    setIsHelpOpen,
  } = useBoardCommands({
    activeScreenShareCount: activeScreenShares.length,
    areZonesEditable,
    createEvidence: handleCreateEvidenceNote,
    createHandoff: handleCreateHandoff,
    createIncidentCard: handleCreateIncidentCard,
    createNote: handleCreateNote,
    createStatusMarker: handleCreateStatusMarker,
    createZone: handleCreateZone,
    deleteSelectedEntity: handleDeleteSelectedEntity,
    entities,
    fitToScreen: fitCanvasToScreen,
    focusSelectedEntity: () => {
      focusEntityOnCanvas(selectedEntityId)
    },
    isVisualMode: isCanvasVisualMode,
    openIndexedShare,
    openActionBoard: () => openMainTab("actions"),
    openFeed: () => openMainTab("feed"),
    openShareGallery,
    selectedEntityId,
    setIsVisualMode: setIsCanvasVisualMode,
    setCamera,
    setSelectedEntityId,
    stageRef,
    toggleZoneEditing: () => setAreZonesEditable((current) => !current),
  })

  useEffect(() => {
    const isEditingElement = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      const tagName = element?.tagName

      return (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        element?.isContentEditable === true
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return
      }

      if (isEditingElement(event.target)) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === "k") {
        if (isQuickCaptureOpen) {
          return
        }

        event.preventDefault()
        setIsQuickCaptureOpen(true)
        setQuickCaptureDraft("")
        setQuickCaptureMode("timeline")
        setQuickCaptureTimelineType("update")
        return
      }

      if (key === "s") {
        event.preventDefault()
        setIsBoardFullscreen((current) => !current)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [isQuickCaptureOpen])

  useEffect(() => {
    if (typeof window === "undefined") return
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isSynced) return
    if (typeof window === "undefined" || !("Notification" in window)) return
    if (Notification.permission !== "default") return
    if (notificationPermissionRequestedRef.current) return
    notificationPermissionRequestedRef.current = true
    void Notification.requestPermission()
  }, [isSynced])

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return
    }

    if (!isSynced) {
      return
    }

    const dispatchNotifications = (title: string, bodies: string[]) => {
      const notify = () => {
        if ("serviceWorker" in navigator) {
          void navigator.serviceWorker.ready.then((registration) => {
            bodies.forEach((body) => {
              void registration.showNotification(title, { body })
            })
          }).catch(() => {
            bodies.forEach((body) => {
              new Notification(title, { body })
            })
          })
        } else {
          bodies.forEach((body) => {
            new Notification(title, { body })
          })
        }
      }

      if (Notification.permission === "granted") {
        notify()
        return
      }

      if (
        Notification.permission === "default" &&
        !notificationPermissionRequestedRef.current
      ) {
        notificationPermissionRequestedRef.current = true
        void Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            notify()
          }
        })
      }
    }

    const currentAssignments = new Map(
      incidentActions.map((action) => [action.id, action.owner]),
    )
    const currentStatuses = new Map(
      incidentActions.map((action) => [action.id, action.status]),
    )
    const currentIncidentLogIds = new Set(incidentLog.map((entry) => entry.id))

    const isFirstAssignmentSnapshot = !hasInitializedAssignmentsRef.current
    const isFirstStatusSnapshot = !hasInitializedActionStatusesRef.current
    const isFirstIncidentLogSnapshot = !hasInitializedIncidentLogRef.current

    if (isFirstAssignmentSnapshot) {
      assignmentSnapshotRef.current = currentAssignments
      hasInitializedAssignmentsRef.current = true
    }

    if (isFirstStatusSnapshot) {
      actionStatusSnapshotRef.current = currentStatuses
      hasInitializedActionStatusesRef.current = true
    }

    if (isFirstIncidentLogSnapshot) {
      incidentLogSnapshotRef.current = currentIncidentLogIds
      hasInitializedIncidentLogRef.current = true
    }

    if (isFirstAssignmentSnapshot || isFirstStatusSnapshot || isFirstIncidentLogSnapshot) {
      return
    }

    const newlyAssigned = incidentActions.filter((action) => {
      const previousOwner = assignmentSnapshotRef.current.get(action.id) ?? ""

      return action.owner === user.name && previousOwner !== user.name
    })
    const newlyCompleted = incidentActions.filter((action) => {
      const previousStatus = actionStatusSnapshotRef.current.get(action.id)

      return previousStatus !== "done" && action.status === "done"
    })
    const newTimelineEntries = incidentLog.filter(
      (entry) => !incidentLogSnapshotRef.current.has(entry.id),
    )

    assignmentSnapshotRef.current = currentAssignments
    actionStatusSnapshotRef.current = currentStatuses
    incidentLogSnapshotRef.current = currentIncidentLogIds

    if (newlyAssigned.length > 0) {
      dispatchNotifications(
        "Task assigned to you",
        newlyAssigned.map((action) => `${action.title}\nAssigned in incident room`),
      )
    }

    if (newlyCompleted.length > 0) {
      dispatchNotifications(
        "Task completed",
        newlyCompleted.map((action) => {
          const actor = action.owner.trim() || "Someone"

          return `${actor} completed a task: ${action.title}`
        }),
      )
    }

    if (newTimelineEntries.length > 0) {
      dispatchNotifications(
        "Feed updated",
        newTimelineEntries.map((entry) => {
          const headline = entry.body.split("\n")[0]?.trim() || "New timeline entry"

          return `${entry.authorName} updated the feed: ${headline}`
        }),
      )
    }
  }, [incidentActions, incidentLog, isSynced, user.name])

  const submitQuickCapture = useCallback(() => {
    const body = quickCaptureDraft.trim()

    if (!body) {
      return
    }

    if (quickCaptureMode === "timeline") {
      addPreparedIncidentLogEntry({
        body,
        linkedEntityIds: selectedEntityId ? [selectedEntityId] : undefined,
        type: quickCaptureTimelineType,
      })
      showToast({ message: "Timeline entry added.", tone: "success" })
    } else {
      createActionItem(body, {
        linkedEntityIds: selectedEntityId ? [selectedEntityId] : undefined,
      })
      showToast({ message: "Action created.", tone: "success" })
    }

    closeQuickCapture()
  }, [
    addPreparedIncidentLogEntry,
    closeQuickCapture,
    createActionItem,
    quickCaptureDraft,
    quickCaptureMode,
    quickCaptureTimelineType,
    selectedEntityId,
    showToast,
  ])

  const handleBackgroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    setIsCanvasVisualMode(false)
    clearEntitySelection()
    interactionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      type: "pan",
      viewX: cameraRef.current.x,
      viewY: cameraRef.current.y,
    }
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()

    const stage = stageRef.current

    if (!stage) {
      return
    }

    const rect = stage.getBoundingClientRect()

    setCamera((current) => {
      const nextZoom = clamp(
        current.zoom * (event.deltaY < 0 ? 1.08 : 0.92),
        0.12,
        3.2,
      )
      const boardPoint = screenToBoard(
        event.clientX,
        event.clientY,
        rect,
        current,
      )

      return {
        x: event.clientX - rect.left - boardPoint.x * nextZoom,
        y: event.clientY - rect.top - boardPoint.y * nextZoom,
        zoom: nextZoom,
      }
    })
  }

  const handleResizeStart = useCallback(
    ({
      entityId,
      originHeight,
      originWidth,
      pointerId,
      startClientX,
      startClientY,
    }: {
      entityId: string
      originHeight: number
      originWidth: number
      pointerId: number
      startClientX: number
      startClientY: number
    }) => {
      interactionRef.current = {
        entityId,
        originHeight,
        originWidth,
        pointerId,
        startClientX,
        startClientY,
        type: "resize",
      }
    },
    [],
  )

  const renderEntity = useCallback(
    (entity: BoardEntity) => (
      <BoardEntityRenderer
        areZonesEditable={areZonesEditable}
        entity={entity}
        incidentActions={incidentActions}
        incidentLog={incidentLog}
        key={entity.id}
        onBeginEntityDrag={beginEntityDrag}
        onConnectToEntity={handleConnectToEntity}
        onFocusEntityOnCanvas={focusEntityOnCanvas}
        onPrimarySelectionChange={setRoomSelectedEntityId}
        onResizeStart={handleResizeStart}
        onSelectSingleEntity={selectSingleEntity}
        onSetCanvasVisualMode={setIsCanvasVisualMode}
        onShiftLinkToEntity={handleShiftLinkToEntity}
        onToggleEntitySelection={toggleEntitySelection}
        pendingConnectionSourceId={pendingConnectionSourceId}
        remoteSelectionColor={remoteSelections.get(entity.id)}
        selectedEntityIds={selectedEntityIds}
        stageRef={stageRef}
        updateEntity={updateEntity}
      />
    ),
    [
      areZonesEditable,
      beginEntityDrag,
      handleConnectToEntity,
      focusEntityOnCanvas,
      handleResizeStart,
      handleShiftLinkToEntity,
      incidentActions,
      incidentLog,
      pendingConnectionSourceId,
      remoteSelections,
      selectedEntityIds,
      selectSingleEntity,
      setIsCanvasVisualMode,
      setRoomSelectedEntityId,
      stageRef,
      toggleEntitySelection,
      updateEntity,
    ],
  )

  return (
    <main
      style={{
        position: "absolute",
        inset: 0,
        padding: 16,
        background:
          "radial-gradient(circle at top left, hsl(var(--border) /0.14), transparent 32%), hsl(var(--background))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: isBoardFullscreen
            ? "minmax(0, 1fr) 0px"
            : "minmax(0, 1fr) 380px",
          gap: 12,
        }}
      >
        <section
          style={{
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            borderRadius: 24,
            border: "1px solid hsl(var(--border) /0.25)",
            background: "hsl(var(--card) / 0.78)",
            boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
            {activeMainTab === "canvas" ? (
              <BoardCanvas
                activeScreenShares={activeScreenShares}
                activeShareView={activeShareView}
                areZonesEditable={areZonesEditable}
                camera={camera}
                commandHints={commandHints}
                connectionDraftCustomLabel={connectionDraftCustomLabel}
                connectionDraftType={connectionDraftType}
                connectionStatus={connectionStatus}
                connectionToneMap={connectionToneMap}
                connections={connections}
                entities={entities}
                fitCanvasToScreen={fitCanvasToScreen}
                getEntityLabel={getEntityLabel}
                hasActiveScreenShares={hasActiveScreenShares}
                isBoardFocused={isBoardFocused}
                isBoardFullscreen={isBoardFullscreen}
                isCanvasVisualMode={isCanvasVisualMode}
                isHelpOpen={isHelpOpen}
                isPanning={isPanning}
                linkedCaseId={linkedCaseId}
                onActiveRailPanelOpen={() => {
                  setActiveRailPanel("tasks")
                  setIsBoardFullscreen(false)
                }}
                onBackgroundPointerDown={handleBackgroundPointerDown}
                onConnectDraftCustomLabelChange={setConnectionDraftCustomLabel}
                onConnectDraftTypeChange={setConnectionDraftType}
                onCreateActionForEntity={createActionForEntity}
                onCreateBlocker={handleCreateBlocker}
                onCreateEvidenceNote={handleCreateEvidenceNote}
                onCreateHandoff={handleCreateHandoff}
                onCreateHypothesis={handleCreateHypothesis}
                onCreateImpactNote={handleCreateImpactNote}
                onCreateZone={handleCreateZone}
                onDeleteConnection={deleteConnection}
                onDeleteSelectedEntity={handleDeleteSelectedEntity}
                onDismissPendingMapPrompt={() => setPendingMapPrompt(null)}
                onLinkArtifactCancel={() => {
                  setPendingConnectionSourceId(null)
                  if (connectionDraftType === "custom") {
                    setConnectionDraftCustomLabel("")
                    setConnectionDraftType("supports")
                  }
                }}
                onLinkArtifactStart={setPendingConnectionSourceId}
                onLogEntityToFeed={logEntityToFeed}
                onPromoteSelectedEntity={promoteSelectedEntityToCase}
                onRenameConnectionLabel={renameConnectionLabel}
                onToggleBoardFullscreen={() => setIsBoardFullscreen((current) => !current)}
                onToggleHelpOpen={() => setIsHelpOpen((current) => !current)}
                onToggleZoneEditing={() => setAreZonesEditable((current) => !current)}
                onWheel={handleWheel}
                pendingConnectionSourceId={pendingConnectionSourceId}
                presence={presence}
                promotingSourceId={promotingSourceId}
                remainingAssignedTaskCount={remainingAssignedTaskCount}
                renderEntity={renderEntity}
                roomId={roomId}
                selectedEntity={selectedEntity}
                selectedEntityConnections={selectedEntityConnections}
                selectedEntityId={selectedEntityId}
                selectedEntityLinkedActionCount={selectedEntityLinkedActionCount}
                selectedEntityLinkedEntryCount={selectedEntityLinkedEntryCount}
                selectedEntityMapKind={selectedEntityMapKind}
                setActiveScreenShares={setActiveScreenShares}
                setActiveShareView={setActiveShareView}
                stageRect={stageRect}
                stageRef={stageRef}
                user={user}
                visiblePendingMapPrompt={visiblePendingMapPrompt}
                visibleSeverity={visibleSeverity}
                visibleStatus={visibleStatus}
              />
            ) : activeMainTab === "actions" ? (
              <ActionKanbanBoard
                actions={incidentActions}
                availableOwners={participantOwners}
                composerRef={actionComposerRef}
                onAddAction={createActionItem}
                onEnterInsertMode={() => enterWorkspaceInsertMode("actions")}
                onExitToVisualMode={() => setIsWorkspaceVisualMode(true)}
                getEntityLabel={getEntityLabel}
                getTimelineEntryLabel={getTimelineEntryLabel}
                isVisualMode={isWorkspaceVisualMode}
                onCreateActionFromSelection={handleCreateActionFromSelected}
                onDeleteAction={deleteActionItem}
                onLogActionStatusChange={logActionStatusChange}
                onOpenTimelineBoard={(entryId) => {
                  if (entryId) {
                    openMainTab("feed")
                  }
                }}
                onPromoteAction={linkedCaseId ? promoteActionToCase : undefined}
                onSelectEntity={handleRevealEntity}
                onUpdateAction={updateActionItem}
                selectedEntityLabel={selectedEntityLabel}
              />
            ) : (
              <IncidentTimelineBoard
                composerRef={feedComposerRef}
                draft={incidentLogDraft}
                entries={incidentLog}
                entryType={incidentLogEntryType}
                onAddEntry={addIncidentLogEntry}
                onCreateActionFromEntry={(entryId) => {
                  createActionFromTimelineEntry(entryId)
                  openMainTab("actions")
                }}
                onDeleteEntry={deleteIncidentLogEntry}
                onDraftChange={setIncidentLogDraft}
                onEnterInsertMode={() => enterWorkspaceInsertMode("feed")}
                onEntryTypeChange={setIncidentLogEntryType}
                onExitToVisualMode={() => setIsWorkspaceVisualMode(true)}
                onOpenActionBoard={() => openMainTab("actions")}
                onPromoteEntry={linkedCaseId ? promoteTimelineEntryToCase : undefined}
                onSelectEntity={handleRevealEntity}
                onSeedFromSelection={selectedEntityLabel ? handleAddSelectedToTimeline : undefined}
                selectedEntityLabel={selectedEntityLabel}
                isVisualMode={isWorkspaceVisualMode}
                getActionLabel={getActionLabel}
                getEntityLabel={getEntityLabel}
              />
            )}

            <QuickCapturePalette
              draft={quickCaptureDraft}
              isOpen={isQuickCaptureOpen}
              mode={quickCaptureMode}
              onClose={closeQuickCapture}
              onDraftChange={setQuickCaptureDraft}
              onModeChange={setQuickCaptureMode}
              onSubmit={submitQuickCapture}
              onTimelineTypeChange={setQuickCaptureTimelineType}
              timelineType={quickCaptureTimelineType}
            />

            <div
              style={{
                position: "absolute",
                left: 16,
                bottom: 16,
                pointerEvents: "none",
                zIndex: 110,
              }}
            >
              <div
                style={{
                  pointerEvents: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <Card className="min-w-[140px] border-border/50 bg-card/92 shadow-xl backdrop-blur">
                  <CardContent className="flex flex-col gap-2 p-2">
                  {[
                    { id: "canvas", label: "Canvas" },
                    { id: "actions", label: "Action Board" },
                    { id: "feed", label: "Feed" },
                  ].map((tab) => {
                    const isActive = activeMainTab === tab.id

                    return (
                      <Button
                        key={tab.id}
                        className="justify-start rounded-xl"
                        onClick={() => {
                          openMainTab(tab.id as MainWorkspaceTab)
                        }}
                        size="sm"
                        type="button"
                        variant={isActive ? "default" : "secondary"}
                      >
                        {tab.label}
                      </Button>
                    )
                  })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <BoardSideRail
          actions={myAssignedActions}
          activeRailPanel={activeRailPanel}
          getEntityLabel={getEntityLabel}
          getTimelineEntryLabel={getTimelineEntryLabel}
          isBoardFullscreen={isBoardFullscreen}
          linkedCaseId={linkedCaseId}
          onAddTimelineEntry={addPreparedIncidentLogEntry}
          onCreateActionFromArtifact={(artifact) => {
            createActionItem(`Investigate: ${artifact.title}`)
            setActiveMainTab("actions")
          }}
          onLogActionStatusChange={logActionStatusChange}
          onOpenActionBoard={() => setActiveMainTab("actions")}
          onOpenTimelineBoard={(entryId) => {
            if (entryId) {
              openMainTab("feed")
            }
          }}
          onSelectEntity={handleRevealEntity}
          onSetActiveRailPanel={setActiveRailPanel}
          onUpdateAction={updateActionItem}
          roomId={roomId}
        />
      </div>
    </main>
  )
}
