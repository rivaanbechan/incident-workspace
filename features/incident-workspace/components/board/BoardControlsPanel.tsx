"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"
import {
  LiveSessionPanel,
  type ActiveScreenShare,
  type LiveShareView,
} from "@/features/incident-workspace/components/livekit/LiveSessionPanel"
import Link from "next/link"

type BoardControlsPanelProps = {
  activeScreenShares: ActiveScreenShare[]
  activeShareView: LiveShareView
  fitCanvasToScreen: () => void
  hasActiveScreenShares: boolean
  onSpeakersChange: (participantIds: string[]) => void
  roomId: string
  setActiveScreenShares: (shares: ActiveScreenShare[]) => void
  setActiveShareView: (view: LiveShareView | ((current: LiveShareView) => LiveShareView)) => void
}

/**
 * BoardControlsPanel — bottom-right overlay containing:
 * - Live share viewer stack (when screen shares are active)
 * - LiveSession mic/share controls
 * - Fit to screen, Focus Board, Open Hunt Graph, Show Shortcuts buttons
 * - Keyboard shortcuts help panel (when open)
 */
export function BoardControlsPanel({
  activeScreenShares,
  activeShareView,
  fitCanvasToScreen,
  hasActiveScreenShares,
  onSpeakersChange,
  roomId,
  setActiveScreenShares,
  setActiveShareView,
}: BoardControlsPanelProps) {
  const {
    commandHints,
    isBoardFullscreen,
    isHelpOpen,
    onToggleBoardFullscreen,
    onToggleHelpOpen,
    user,
  } = useBoardUI()

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        pointerEvents: "none",
        zIndex: 110,
      }}
    >
      <div
        style={{
          position: "relative",
          pointerEvents: "auto",
          display: "grid",
          justifyItems: "end",
          gap: 6,
        }}
      >
        {/* Live share viewer stack */}
        {hasActiveScreenShares ? (
          <Card className="w-[220px] border-border/60 bg-card/92 shadow-xl backdrop-blur">
            <CardContent className="grid gap-2 p-2">
              <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Live viewer
              </div>
              <Button
                className="h-9 justify-between rounded-xl"
                onClick={() =>
                  setActiveShareView((current) =>
                    current.mode === "gallery" ? { mode: "none" } : { mode: "gallery" },
                  )
                }
                size="sm"
                type="button"
                variant={activeShareView.mode === "gallery" ? "default" : "secondary"}
              >
                <span>0 Gallery</span>
                <span style={{ color: "inherit", opacity: 0.72 }}>
                  {activeScreenShares.length}
                </span>
              </Button>
              {activeScreenShares.slice(0, 9).map((share, index) => {
                const isActive =
                  activeShareView.mode === "focused" &&
                  activeShareView.trackId === share.trackId

                return (
                  <Button
                    key={share.trackId}
                    className="h-9 justify-between gap-2 rounded-xl"
                    onClick={() =>
                      setActiveShareView((current) =>
                        current.mode === "focused" && current.trackId === share.trackId
                          ? { mode: "none" }
                          : {
                              mode: "focused",
                              openedFromGallery: true,
                              trackId: share.trackId,
                            },
                      )
                    }
                    size="sm"
                    type="button"
                    variant={isActive ? "default" : "secondary"}
                  >
                    <span>{index + 1}</span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                      }}
                    >
                      {share.participantName}
                    </span>
                  </Button>
                )
              })}
            </CardContent>
          </Card>
        ) : null}

        {/* Main controls card */}
        <Card className="min-w-[156px] border-border/50 bg-card/92 shadow-xl backdrop-blur">
          <CardContent className="flex flex-col gap-2 p-2">
            <LiveSessionPanel
              activeShareView={activeShareView}
              inlineTrigger
              isViewerEnabled
              onActiveShareViewChange={setActiveShareView}
              onScreenSharesChange={setActiveScreenShares}
              onSpeakersChange={onSpeakersChange}
              roomId={roomId}
              user={user}
            />
            <Button
              className="justify-start rounded-xl"
              onClick={fitCanvasToScreen}
              size="sm"
              type="button"
            >
              Fit To Screen
            </Button>
            <Button
              className="justify-start rounded-xl"
              onClick={onToggleBoardFullscreen}
              size="sm"
              type="button"
              variant={isBoardFullscreen ? "default" : "secondary"}
            >
              {isBoardFullscreen ? "Show Workspace" : "Focus Board"}
            </Button>
            <Button asChild className="justify-start rounded-xl" size="sm" type="button">
              <Link href={`/hunt/${roomId}`} target="_blank" rel="noopener noreferrer">
                Open Hunt Graph
              </Link>
            </Button>
            <Button
              className="justify-start rounded-xl"
              onClick={onToggleHelpOpen}
              size="sm"
              type="button"
              variant="secondary"
            >
              {isHelpOpen ? "Hide Shortcuts" : "Show Shortcuts"}
            </Button>
          </CardContent>
        </Card>

        {/* Keyboard shortcuts help panel */}
        {isHelpOpen ? (
          <Card
            style={{
              position: "absolute",
              right: 0,
              bottom: "calc(100% + 10px)",
              width: "min(440px, calc(100vw - 48px))",
              maxHeight: "min(420px, calc(100vh - 120px))",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.18)",
              overflow: "auto",
            }}
            className="border-border/60 bg-card/96 backdrop-blur"
          >
            <CardHeader className="p-4 pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Board Commands
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 p-4 pt-0">
              {commandHints.map((hint) => (
                <Card key={hint} className="border-border/40 bg-background/80 shadow-none">
                  <CardContent className="flex min-h-10 items-center p-3 text-sm font-medium">
                    {hint}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
