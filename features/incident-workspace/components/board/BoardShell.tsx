"use client"

import type { InvestigationSeverity, InvestigationStatus } from "@/lib/contracts/investigations"
import type { CaseAccessContext } from "@/lib/auth/permissions"
import type {
  BoardConnectionType,
  BoardEntity,
  IncidentLogEntry,
} from "@/features/incident-workspace/lib/board/types"
import { ActionKanbanBoard } from "@/features/incident-workspace/components/board/ActionKanbanBoard"
import { BoardCanvas } from "@/features/incident-workspace/components/board/BoardCanvas"
import { BoardEntityRenderer } from "@/features/incident-workspace/components/board/BoardEntityRenderer"
import { BoardSideRail } from "@/features/incident-workspace/components/board/BoardSideRail"
import { DatasourceSearchPanel } from "@/features/incident-workspace/components/board/DatasourceSearchPanel"
import { IncidentTimelineBoard } from "@/features/incident-workspace/components/board/IncidentTimelineBoard"
import { QuickCapturePalette } from "@/features/incident-workspace/components/board/QuickCapturePalette"
import { useBoardRoom } from "@/features/incident-workspace/components/board/useBoardRoom"
import { useBoardCommands } from "@/features/incident-workspace/components/board/useBoardCommands"
import { useQuickCapture } from "@/features/incident-workspace/components/board/useQuickCapture"
import { useScreenShares } from "@/features/incident-workspace/components/board/useScreenShares"
import { useEntityCreation } from "@/features/incident-workspace/components/board/useEntityCreation"
import { useCasePromotion } from "@/features/incident-workspace/components/board/useCasePromotion"
import { useNotifications } from "@/features/incident-workspace/components/board/useNotifications"
import { useDragAndResize } from "@/features/incident-workspace/components/board/useDragAndResize"
import { useConnectionFlow } from "@/features/incident-workspace/components/board/useConnectionFlow"
import { useKeyboardShortcuts } from "@/features/incident-workspace/components/board/useKeyboardShortcuts"
import { useEntityActions } from "@/features/incident-workspace/components/board/useEntityActions"
import { useViewportNavigation } from "@/features/incident-workspace/components/board/useViewportNavigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getEntityMapKind,
  isEditingElement,
  type MainWorkspaceTab,
  type PendingMapPrompt,
  type RailPanel,
} from "@/features/incident-workspace/components/board/boardShellShared"
import { BoardEntitiesContext } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { BoardSelectionContext } from "@/features/incident-workspace/components/board/BoardSelectionContext"
import { BoardUIContext } from "@/features/incident-workspace/components/board/BoardUIContext"
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
  const actionComposerRef = useRef<HTMLInputElement | null>(null)
  const feedComposerRef = useRef<HTMLTextAreaElement | null>(null)

  const [activeRailPanel, setActiveRailPanel] = useState<RailPanel>("tasks")
  const [activeMainTab, setActiveMainTab] = useState<MainWorkspaceTab>(initialTab)
  const [connectionDraftType, setConnectionDraftType] =
    useState<BoardConnectionType>("supports")
  const [connectionDraftCustomLabel, setConnectionDraftCustomLabel] = useState("")
  const [pendingMapPrompt, setPendingMapPrompt] = useState<PendingMapPrompt | null>(null)
  useEffect(() => {
    if (!pendingMapPrompt) return
    const timer = setTimeout(() => setPendingMapPrompt(null), 8000)
    return () => clearTimeout(timer)
  }, [pendingMapPrompt])
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([])
  const [areZonesEditable, setAreZonesEditable] = useState(false)
  const [isRoomVisualMode, setIsRoomVisualMode] = useState(false)
  const [isBoardFullscreen, setIsBoardFullscreen] = useState(false)
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

  const selectedEntity = selectedEntityId
    ? entities.find((entity) => entity.id === selectedEntityId) ?? null
    : null

  const {
    isQuickCaptureOpen,
    quickCaptureDraft,
    quickCaptureMode,
    quickCaptureTimelineType,
    setQuickCaptureDraft,
    setQuickCaptureMode,
    setQuickCaptureTimelineType,
    closeQuickCapture,
    submitQuickCapture,
  } = useQuickCapture({
    addPreparedIncidentLogEntry,
    createActionItem,
    selectedEntityId,
    stageRef,
  })

  const {
    activeScreenShares,
    setActiveScreenShares,
    activeShareView,
    setActiveShareView,
    openShareGallery,
    openIndexedShare,
  } = useScreenShares({ activeMainTab })

  const {
    handleCreateNote,
    handleCreateIncidentCard,
    handleCreateStatusMarker,
    handleCreateZone,
    handleCreateHypothesis,
    handleCreateImpactNote,
    handleCreateEvidenceNote,
    handleCreateBlocker,
    handleCreateHandoff,
  } = useEntityCreation({ createEntityAtViewportCenter, entities, setPendingMapPrompt })

  const {
    promotingSourceId,
    promoteSelectedEntityToCase,
    promoteTimelineEntryToCase,
    promoteActionToCase,
  } = useCasePromotion({ entities, linkedCaseId, roomId, selectedEntity })

  useNotifications({ incidentActions, incidentLog, isSynced, user })

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

  const entityActions = useEntityActions({
    addPreparedIncidentLogEntry,
    createActionItem,
    entities,
    incidentActions,
    incidentLog,
    selectedEntityId,
    selectedEntityLabel,
    selectSingleEntity,
    setActiveMainTab,
    setIncidentLogDraft,
    setIncidentLogEntryType,
    setIsCanvasVisualMode,
    setPendingMapPrompt,
  })

  const {
    createActionForEntity,
    getActionLabel,
    getEntityLabel,
    getTimelineEntryLabel,
    handleAddSelectedToTimeline,
    handleCreateActionFromSelected,
    handleRevealEntity,
    logEntityToFeed,
    openFeedForEntity,
  } = entityActions

  const dragAndResize = useDragAndResize({
    cameraRef,
    entities,
    entityMapRef,
    providerRef,
    selectedEntityIds,
    setCamera,
    stageRef,
  })

  const { beginEntityDrag, handleResizeStart, handleWheel, isPanning, startPan } = dragAndResize

  const connectionFlow = useConnectionFlow({
    connectionDraftCustomLabel,
    connectionDraftType,
    createConnection,
    entities,
    getEntityLabel,
    selectedEntityId,
    setConnectionDraftCustomLabel,
    setConnectionDraftType,
    updateConnection,
  })

  const {
    handleConnectToEntity,
    handleShiftLinkToEntity,
    pendingConnectionSourceId,
    renameConnectionLabel,
    setPendingConnectionSourceId,
  } = connectionFlow

  useKeyboardShortcuts({
    activeMainTab,
    isRoomVisualMode,
    setActiveMainTab,
    setIsBoardFullscreen,
    setIsRoomVisualMode,
  })

  const viewportNavigation = useViewportNavigation({
    activeMainTab,
    autoFitOnOpen,
    entities,
    initialEntityFocus,
    initialTab,
    setActiveMainTab,
    setCamera,
    setIncidentLogDraft,
    setIncidentLogEntryType,
    setSelectedEntityId,
    stageRef,
  })

  const { fitCanvasToScreen, focusEntityOnCanvas } = viewportNavigation

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
    openActionBoard: () => setActiveMainTab("actions"),
    openFeed: () => setActiveMainTab("feed"),
    openShareGallery,
    selectedEntityId,
    setIsVisualMode: setIsCanvasVisualMode,
    setCamera,
    setSelectedEntityId,
    stageRef,
    toggleZoneEditing: () => setAreZonesEditable((current) => !current),
  })

  const handleBackgroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    setIsCanvasVisualMode(false)
    clearEntitySelection()
    startPan(event)
  }

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

  const renderEntity = useCallback(
    (entity: BoardEntity) => (
      <BoardEntityRenderer
        entity={entity}
        key={entity.id}
        onBeginEntityDrag={beginEntityDrag}
        onConnectToEntity={handleConnectToEntity}
        onFocusEntityOnCanvas={focusEntityOnCanvas}
        onPrimarySelectionChange={setRoomSelectedEntityId}
        onResizeStart={handleResizeStart}
        onShiftLinkToEntity={handleShiftLinkToEntity}
        remoteSelectionColor={remoteSelections.get(entity.id)}
        stageRef={stageRef}
      />
    ),
    [
      beginEntityDrag,
      handleConnectToEntity,
      focusEntityOnCanvas,
      handleResizeStart,
      handleShiftLinkToEntity,
      remoteSelections,
      setRoomSelectedEntityId,
      stageRef,
    ],
  )

  const boardUIValue = {
    areZonesEditable,
    camera,
    commandHints,
    connectionDraftCustomLabel,
    connectionDraftType,
    connectionStatus,
    connectionToneMap,
    isBoardFocused,
    isBoardFullscreen,
    isCanvasVisualMode,
    isHelpOpen,
    isPanning,
    linkedCaseId,
    pendingConnectionSourceId,
    remainingAssignedTaskCount,
    user,
    visiblePendingMapPrompt,
    visibleSeverity,
    visibleStatus,
    onActiveRailPanelOpen: () => {
      setActiveRailPanel("tasks")
      setIsBoardFullscreen(false)
    },
    onConnectDraftCustomLabelChange: setConnectionDraftCustomLabel,
    onConnectDraftTypeChange: setConnectionDraftType,
    onDismissPendingMapPrompt: () => setPendingMapPrompt(null),
    onLinkArtifactCancel: () => {
      setPendingConnectionSourceId(null)
      if (connectionDraftType === "custom") {
        setConnectionDraftCustomLabel("")
        setConnectionDraftType("supports")
      }
    },
    onLinkArtifactStart: setPendingConnectionSourceId,
    onToggleBoardFullscreen: () => setIsBoardFullscreen((current) => !current),
    onToggleHelpOpen: () => setIsHelpOpen((current) => !current),
    onToggleZoneEditing: () => setAreZonesEditable((current) => !current),
    setCamera,
    setIsCanvasVisualMode,
  }

  const boardSelectionValue = {
    clearEntitySelection,
    onDeleteSelectedEntity: handleDeleteSelectedEntity,
    onPromoteSelectedEntity: promoteSelectedEntityToCase,
    promotingSourceId,
    selectedEntity,
    selectedEntityConnections,
    selectedEntityId,
    selectedEntityIds,
    selectedEntityLabel,
    selectedEntityLinkedActionCount,
    selectedEntityLinkedEntryCount,
    selectedEntityMapKind,
    selectSingleEntity,
    toggleEntitySelection,
  }

  const boardEntitiesValue = {
    connections,
    entities,
    getEntityLabel,
    incidentActions,
    incidentLog,
    onCreateActionForEntity: createActionForEntity,
    onCreateBlocker: handleCreateBlocker,
    onCreateEvidenceNote: handleCreateEvidenceNote,
    onCreateHandoff: handleCreateHandoff,
    onCreateHypothesis: handleCreateHypothesis,
    onCreateImpactNote: handleCreateImpactNote,
    onCreateZone: handleCreateZone,
    onDeleteConnection: deleteConnection,
    onLogEntityToFeed: logEntityToFeed,
    onRenameConnectionLabel: renameConnectionLabel,
    presence,
    remoteSelections,
    updateEntity,
  }

  return (
    <BoardUIContext.Provider value={boardUIValue}>
    <BoardSelectionContext.Provider value={boardSelectionValue}>
    <BoardEntitiesContext.Provider value={boardEntitiesValue}>
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
                fitCanvasToScreen={fitCanvasToScreen}
                hasActiveScreenShares={hasActiveScreenShares}
                onBackgroundPointerDown={handleBackgroundPointerDown}
                onWheel={handleWheel}
                renderEntity={renderEntity}
                roomId={roomId}
                setActiveScreenShares={setActiveScreenShares}
                setActiveShareView={setActiveShareView}
                stageRect={stageRect}
                stageRef={stageRef}
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
                    setActiveMainTab("feed")
                  }
                }}
                onPromoteAction={linkedCaseId ? promoteActionToCase : undefined}
                onSelectEntity={handleRevealEntity}
                onUpdateAction={updateActionItem}
                selectedEntityLabel={selectedEntityLabel}
              />
            ) : activeMainTab === "feed" ? (
              <IncidentTimelineBoard
                composerRef={feedComposerRef}
                draft={incidentLogDraft}
                entries={incidentLog}
                entryType={incidentLogEntryType}
                onAddEntry={addIncidentLogEntry}
                onCreateActionFromEntry={(entryId) => {
                  createActionFromTimelineEntry(entryId)
                  setActiveMainTab("actions")
                }}
                onDeleteEntry={deleteIncidentLogEntry}
                onDraftChange={setIncidentLogDraft}
                onEnterInsertMode={() => enterWorkspaceInsertMode("feed")}
                onEntryTypeChange={setIncidentLogEntryType}
                onExitToVisualMode={() => setIsWorkspaceVisualMode(true)}
                onOpenActionBoard={() => setActiveMainTab("actions")}
                onPromoteEntry={linkedCaseId ? promoteTimelineEntryToCase : undefined}
                onSelectEntity={handleRevealEntity}
                onSeedFromSelection={selectedEntityLabel ? handleAddSelectedToTimeline : undefined}
                selectedEntityLabel={selectedEntityLabel}
                isVisualMode={isWorkspaceVisualMode}
                getActionLabel={getActionLabel}
                getEntityLabel={getEntityLabel}
              />
            ) : (
              <div className="h-full overflow-y-auto">
                <div className="max-w-3xl mx-auto p-6">
                  <DatasourceSearchPanel
                    linkedCaseId={linkedCaseId}
                    onAddTimelineEntry={addPreparedIncidentLogEntry}
                    roomId={roomId}
                  />
                </div>
              </div>
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
                    { id: "search", label: "Search" },
                  ].map((tab) => {
                    const isActive = activeMainTab === tab.id

                    return (
                      <Button
                        key={tab.id}
                        className="justify-start rounded-xl"
                        onClick={() => {
                          setActiveMainTab(tab.id as MainWorkspaceTab)
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
          onCreateActionFromArtifact={(artifact) => {
            createActionItem(`Investigate: ${artifact.title}`)
            setActiveMainTab("actions")
          }}
          onLogActionStatusChange={logActionStatusChange}
          onOpenActionBoard={() => setActiveMainTab("actions")}
          onOpenTimelineBoard={(entryId) => {
            if (entryId) {
              setActiveMainTab("feed")
            }
          }}
          onSelectEntity={handleRevealEntity}
          onSetActiveRailPanel={setActiveRailPanel}
          onUpdateAction={updateActionItem}
          roomId={roomId}
        />
      </div>
    </main>
    </BoardEntitiesContext.Provider>
    </BoardSelectionContext.Provider>
    </BoardUIContext.Provider>
  )
}
