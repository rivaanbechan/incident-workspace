"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { IncidentActionItem } from "@/features/incident-workspace/lib/board/types"
import { InvestigationArtifactsPanel } from "@/features/incident-workspace/components/board/InvestigationArtifactsPanel"
import { YourTasksPanel } from "@/features/incident-workspace/components/board/YourTasksPanel"
import type { RailPanel } from "@/features/incident-workspace/components/board/boardShellShared"
import { cn } from "@/lib/utils"

type BoardSideRailProps = {
  actions: IncidentActionItem[]
  activeRailPanel: RailPanel
  getEntityLabel: (entityId: string) => string
  getTimelineEntryLabel: (entryId: string) => string
  isBoardFullscreen: boolean
  linkedCaseId?: string | null
  onCreateActionFromArtifact: (artifact: { title: string }) => void
  onLogActionStatusChange: (
    actionId: string,
    fromStatus: IncidentActionItem["status"],
    toStatus: IncidentActionItem["status"],
    comment: string,
  ) => void
  onOpenActionBoard: () => void
  onOpenTimelineBoard: (entryId: string | null) => void
  onSelectEntity: (entityId: string) => void
  onSetActiveRailPanel: (panel: RailPanel) => void
  onUpdateAction: (
    actionId: string,
    updater: (action: IncidentActionItem) => IncidentActionItem,
  ) => void
  roomId: string
}

export function BoardSideRail({
  actions,
  activeRailPanel,
  getEntityLabel,
  getTimelineEntryLabel,
  isBoardFullscreen,
  linkedCaseId = null,
  onCreateActionFromArtifact,
  onLogActionStatusChange,
  onOpenActionBoard,
  onOpenTimelineBoard,
  onSelectEntity,
  onSetActiveRailPanel,
  onUpdateAction,
  roomId,
}: BoardSideRailProps) {
  const railTabs: Array<{ id: RailPanel; label: string }> = [
    { id: "tasks", label: "Your Tasks" },
    { id: "findings", label: "Findings" },
  ]

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-[24px] transition-opacity duration-150",
        isBoardFullscreen
          ? "pointer-events-none border-transparent bg-transparent opacity-0 shadow-none"
          : "border border-border/30 bg-card/95 opacity-100 shadow-[0_20px_60px_rgba(15,23,42,0.08)]",
      )}
    >
      <Card className="rounded-none border-0 border-b border-border/30 bg-transparent shadow-none">
        <CardHeader className="gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge className="w-fit" variant="muted">
                Shared Workspace
              </Badge>
              <div>
                <CardTitle className="text-lg">Room side rail</CardTitle>
                <CardDescription className="mt-1 max-w-sm text-[13px] leading-6">
                  Keep the board visible while triaging assigned work and promoted findings.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline">
              {activeRailPanel === "tasks" ? "Tasks" : "Findings"}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {railTabs.map((tab) => {
              const isActive = activeRailPanel === tab.id

              return (
                <Button
                  key={tab.id}
                  className="h-auto rounded-xl px-3 py-2 text-[12px] font-semibold"
                  onClick={() => onSetActiveRailPanel(tab.id)}
                  type="button"
                  variant={isActive ? "default" : "secondary"}
                >
                  {tab.label}
                </Button>
              )
            })}
          </div>
        </CardHeader>
      </Card>

      <div className="min-h-0 flex-1 p-4">
        <div className="h-full overflow-y-auto pr-1">
          {activeRailPanel === "tasks" ? (
            <YourTasksPanel
              actions={actions}
              getEntityLabel={getEntityLabel}
              getTimelineEntryLabel={getTimelineEntryLabel}
              onLogActionStatusChange={onLogActionStatusChange}
              onOpenActionBoard={onOpenActionBoard}
              onOpenTimelineBoard={onOpenTimelineBoard}
              onSelectEntity={onSelectEntity}
              onUpdateAction={onUpdateAction}
            />
          ) : null}

          {activeRailPanel === "findings" ? (
            <InvestigationArtifactsPanel
              linkedCaseId={linkedCaseId}
              onCreateActionFromArtifact={onCreateActionFromArtifact}
              roomId={roomId}
            />
          ) : null}

        </div>
      </div>
    </aside>
  )
}
