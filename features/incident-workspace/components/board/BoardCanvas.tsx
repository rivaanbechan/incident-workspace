"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { BoardEntity } from "@/features/incident-workspace/lib/board/types"
import { useBoardEntities } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"
import { BoardControlsPanel } from "@/features/incident-workspace/components/board/BoardControlsPanel"
import { ConnectionLayer } from "@/features/incident-workspace/components/board/ConnectionLayer"
import { CursorPresenceLayer } from "@/features/incident-workspace/components/board/CursorPresenceLayer"
import { EntityCreationToolbar } from "@/features/incident-workspace/components/board/EntityCreationToolbar"
import { EntitySelectionPanel } from "@/features/incident-workspace/components/board/EntitySelectionPanel"
import { PendingMapPromptCard } from "@/features/incident-workspace/components/board/PendingMapPromptCard"
import { UnlinkedCaseBanner } from "@/features/incident-workspace/components/board/UnlinkedCaseBanner"
import {
  type ActiveScreenShare,
  type LiveShareView,
} from "@/features/incident-workspace/components/livekit/LiveSessionPanel"
import { type MutableRefObject, type ReactNode, useState } from "react"

type BoardCanvasProps = {
  activeScreenShares: ActiveScreenShare[]
  activeShareView: LiveShareView
  fitCanvasToScreen: () => void
  hasActiveScreenShares: boolean
  onBackgroundPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void
  renderEntity: (entity: BoardEntity) => ReactNode
  roomId: string
  setActiveScreenShares: (shares: ActiveScreenShare[]) => void
  setActiveShareView: (view: LiveShareView | ((current: LiveShareView) => LiveShareView)) => void
  stageRect: DOMRect | null
  stageRef: MutableRefObject<HTMLDivElement | null>
}

export function BoardCanvas({
  activeScreenShares,
  activeShareView,
  fitCanvasToScreen,
  hasActiveScreenShares,
  onBackgroundPointerDown,
  onWheel,
  renderEntity,
  roomId,
  setActiveScreenShares,
  setActiveShareView,
  stageRect,
  stageRef,
}: BoardCanvasProps) {
  const { camera, isBoardFocused, isCanvasVisualMode, isPanning, onActiveRailPanelOpen, remainingAssignedTaskCount } = useBoardUI()
  const { entities } = useBoardEntities()

  const [speakingParticipantIds, setSpeakingParticipantIds] = useState<string[]>([])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <UnlinkedCaseBanner />

      <div style={{ position: "relative", flex: 1, minHeight: 0, zIndex: 0 }}>
        {/* Canvas stage */}
        <div
          ref={stageRef}
          onPointerDownCapture={() => {
            stageRef.current?.focus()
          }}
          tabIndex={0}
          onPointerDown={onBackgroundPointerDown}
          onWheel={onWheel}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            cursor: isPanning ? "grabbing" : "grab",
            borderRadius: 24,
            border: isCanvasVisualMode
              ? "4px solid hsl(var(--foreground) / 0.92)"
              : isBoardFocused
                ? "1px solid hsl(var(--border) / 0.75)"
                : "1px solid transparent",
            boxSizing: "border-box",
            outline: isCanvasVisualMode ? "3px solid hsl(var(--primary) / 0.65)" : "none",
            outlineOffset: isCanvasVisualMode ? 3 : 0,
            boxShadow: isCanvasVisualMode
              ? "0 0 0 1px hsl(var(--background)), 0 0 28px hsl(var(--primary) / 0.22)"
              : "none",
          }}
        >
          {/* Visual mode header gradient */}
          {isCanvasVisualMode ? (
            <div
              style={{
                position: "absolute",
                inset: "0 0 auto 0",
                height: 52,
                zIndex: 22,
                pointerEvents: "none",
                borderBottom: "1px solid hsl(var(--primary) / 0.28)",
                background:
                  "linear-gradient(180deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--primary) / 0.08) 52%, transparent 100%)",
              }}
            />
          ) : null}

          {/* Task count + visual mode badges */}
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 100,
              pointerEvents: "none",
              display: "grid",
              justifyItems: "end",
              gap: 8,
            }}
          >
            {remainingAssignedTaskCount > 0 ? (
              <Button
                className="pointer-events-auto h-8 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] shadow-lg"
                onClick={onActiveRailPanelOpen}
                size="sm"
                type="button"
              >
                {remainingAssignedTaskCount} task
                {remainingAssignedTaskCount === 1 ? "" : "s"}
              </Button>
            ) : null}
            {isCanvasVisualMode ? (
              <Badge className="rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.12em]" variant="info">
                Visual mode
              </Badge>
            ) : null}
          </div>

          {/* Inner shadow / focus ring overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 25,
              pointerEvents: "none",
              borderRadius: 24,
              boxShadow: isCanvasVisualMode
                ? "inset 0 0 0 2px hsl(var(--background)), inset 0 0 0 7px hsl(var(--primary) / 0.12)"
                : isBoardFocused
                  ? "inset 0 0 0 2px hsl(var(--foreground) / 0.22)"
                  : "none",
              transition: "box-shadow 140ms ease",
            }}
          />

          {/* Connection lines + label pills */}
          <ConnectionLayer />

          {/* Canvas background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at top left, hsl(var(--background) / 0.92), hsl(var(--card) / 0.58) 42%, hsl(var(--muted) / 0.34))",
            }}
          />

          {/* Entities layer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
              transformOrigin: "top left",
              zIndex: 20,
            }}
          >
            {entities.map(renderEntity)}
          </div>
        </div>

        {/* Overlays */}
        <CursorPresenceLayer stageRect={stageRect} speakingParticipantIds={speakingParticipantIds} />
        <EntityCreationToolbar />
        <EntitySelectionPanel />
        <PendingMapPromptCard />
        <BoardControlsPanel
          activeScreenShares={activeScreenShares}
          activeShareView={activeShareView}
          fitCanvasToScreen={fitCanvasToScreen}
          hasActiveScreenShares={hasActiveScreenShares}
          onSpeakersChange={setSpeakingParticipantIds}
          roomId={roomId}
          setActiveScreenShares={setActiveScreenShares}
          setActiveShareView={setActiveShareView}
        />
      </div>
    </div>
  )
}
