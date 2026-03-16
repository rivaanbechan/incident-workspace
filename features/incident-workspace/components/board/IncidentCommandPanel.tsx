"use client"

import { Button } from "@/components/ui/button"
import { formatLogTimestamp } from "@/features/incident-workspace/components/board/boardCore"
import type {
  IncidentActionItem,
  IncidentLogEntry,
  IncidentRoleAssignments,
  IncidentRoleKey,
  IncidentSummary,
} from "@/features/incident-workspace/lib/board/types"
import { useState } from "react"

type IncidentCommandPanelProps = {
  actions: IncidentActionItem[]
  latestTimelineLinkedActions: IncidentActionItem[]
  onAddTimelineEntry: () => void
  onOpenActionBoard: () => void
  onOpenTimelineBoard: () => void
  onBoardTimelineFromSelection: () => void
  onIncidentLogDraftChange: (value: string) => void
  onIncidentLogEntryTypeChange: (value: IncidentLogEntry["type"]) => void
  onIncidentRoleChange: (role: IncidentRoleKey, value: string) => void
  onIncidentSummaryChange: <K extends keyof IncidentSummary>(
    field: K,
    value: IncidentSummary[K],
  ) => void
  relatedActionsForSelectedEntity: IncidentActionItem[]
  relatedTimelineEntriesForSelectedEntity: IncidentLogEntry[]
  roles: IncidentRoleAssignments
  selectedEntityLabel: string | null
  summary: IncidentSummary
  timelineDraft: string
  timelineEntries: IncidentLogEntry[]
  timelineEntryType: IncidentLogEntry["type"]
  variant: "command" | "incident_log"
}

const ROLE_LABELS: Record<IncidentRoleKey, string> = {
  communicationsLead: "Comms owner",
  incidentCommander: "Incident commander",
  operationsLead: "Operations",
  technicalLead: "Tech lead",
}

const TIMELINE_TYPE_LABELS: Record<IncidentLogEntry["type"], string> = {
  comms: "Comms",
  decision: "Decision",
  mitigation: "Mitigation",
  owner_change: "Owner change",
  update: "Update",
}

function getTimelineEntrySummary(entry: IncidentLogEntry) {
  return entry.body.split("\n")[0]?.trim() || "Timeline entry"
}

function SectionToggle({
  isOpen,
  label,
  onClick,
}: {
  isOpen: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button onClick={onClick} size="sm" variant="ghost">
      {isOpen ? `Hide ${label}` : `Show ${label}`}
    </Button>
  )
}

export function IncidentCommandPanel({
  actions,
  latestTimelineLinkedActions,
  onAddTimelineEntry,
  onOpenActionBoard,
  onOpenTimelineBoard,
  onBoardTimelineFromSelection,
  onIncidentLogDraftChange,
  onIncidentLogEntryTypeChange,
  onIncidentRoleChange,
  onIncidentSummaryChange,
  relatedActionsForSelectedEntity,
  relatedTimelineEntriesForSelectedEntity,
  roles,
  selectedEntityLabel,
  summary,
  timelineDraft,
  timelineEntries,
  timelineEntryType,
  variant,
}: IncidentCommandPanelProps) {
  const [isRolesOpen, setIsRolesOpen] = useState(false)
  const latestTimelineEntry = timelineEntries[timelineEntries.length - 1] ?? null
  const openActions = actions.filter((action) => action.status !== "done").slice(0, 4)

  return (
    <aside className="grid gap-3.5 content-start">
      {variant === "command" ? (
        <>
          <section className="w-full rounded-2xl bg-background p-4 text-foreground shadow-[0_20px_48px_rgba(15,23,42,0.18)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Command summary
            </div>
            <div className="mt-1.5 text-lg font-bold">
              Current command state
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={summary.severity}
                onChange={(event) => onIncidentSummaryChange("severity", event.target.value as IncidentSummary["severity"])}
                className="rounded-full border border-border/25 bg-muted/65 px-3 py-2 font-bold text-foreground"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select
                value={summary.status}
                onChange={(event) => onIncidentSummaryChange("status", event.target.value as IncidentSummary["status"])}
                className="rounded-full border border-border/25 bg-muted/65 px-3 py-2 font-bold text-foreground"
              >
                <option value="open">Open</option>
                <option value="monitoring">Monitoring</option>
                <option value="mitigated">Mitigated</option>
              </select>
            </div>
            <label className="mt-3 grid gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">Customer impact</span>
              <textarea
                value={summary.impactSummary}
                onChange={(event) => onIncidentSummaryChange("impactSummary", event.target.value)}
                className="min-h-14 resize-y rounded-xl border border-border/25 bg-muted/65 p-3 text-foreground"
              />
            </label>
            <label className="mt-3 grid gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">Current objective</span>
              <input
                value={summary.currentObjective}
                onChange={(event) => onIncidentSummaryChange("currentObjective", event.target.value)}
                className="rounded-xl border border-border/25 bg-muted/65 px-3 py-2.5 text-foreground"
              />
            </label>
            <label className="mt-3 grid gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">Next update time</span>
              <input
                value={summary.nextUpdateAt}
                onChange={(event) => onIncidentSummaryChange("nextUpdateAt", event.target.value)}
                placeholder="e.g. 14:30 UTC"
                className="rounded-xl border border-border/25 bg-muted/65 px-3 py-2.5 text-foreground"
              />
            </label>
          </section>

          <section className="w-full rounded-2xl border border-border/20 bg-card p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Command roles
            </div>
            <div className="mt-1.5 text-[17px] font-bold text-foreground">
              Ownership
            </div>
            <div className="mt-3 grid gap-2">
              {(Object.keys(ROLE_LABELS) as IncidentRoleKey[]).map((role) => (
                <div
                  key={role}
                  className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
                >
                  <span className="font-bold">{ROLE_LABELS[role]}</span>
                  <span className={roles[role] ? "font-bold text-foreground" : "font-bold text-slate-400"}>
                    {roles[role] || "Unassigned"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <SectionToggle
                isOpen={isRolesOpen}
                label="Role Editor"
                onClick={() => setIsRolesOpen((current) => !current)}
              />
            </div>
            {isRolesOpen ? (
              <div className="mt-3 grid gap-2.5">
                {(Object.keys(ROLE_LABELS) as IncidentRoleKey[]).map((role) => (
                  <label key={role} className="grid gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground">
                      {ROLE_LABELS[role]}
                    </span>
                    <input
                      value={roles[role]}
                      onChange={(event) => onIncidentRoleChange(role, event.target.value)}
                      placeholder="Unassigned"
                      className="rounded-xl border border-border px-3 py-2.5 text-foreground"
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {variant === "incident_log" ? (
        <>
          <section className="w-full rounded-2xl border border-border/20 bg-card p-4 grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Quick capture
                </div>
                <div className="mt-1.5 text-[17px] font-bold text-foreground">
                  Add the next log item
                </div>
                <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Use the rail for fast updates, then move into Feed for the full event stream.
                </div>
              </div>
              <Button onClick={onOpenTimelineBoard} size="sm" variant="secondary">Open Feed</Button>
            </div>

            <div className="grid gap-2">
              <select
                value={timelineEntryType}
                onChange={(event) => onIncidentLogEntryTypeChange(event.target.value as IncidentLogEntry["type"])}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-foreground"
              >
                {Object.entries(TIMELINE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea
                value={timelineDraft}
                onChange={(event) => onIncidentLogDraftChange(event.target.value)}
                placeholder="Record the next signal, decision, mitigation, or comms checkpoint..."
                className="min-h-20 resize-y rounded-[14px] border border-border bg-card p-3 text-[13px] leading-relaxed text-foreground outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onAddTimelineEntry}>Add update</Button>
              {selectedEntityLabel ? (
                <Button onClick={onBoardTimelineFromSelection} variant="secondary">Use selected board item</Button>
              ) : null}
            </div>

            {latestTimelineEntry ? (
              <div className="grid gap-1 rounded-[14px] border border-border/15 bg-muted p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Latest log item
                </div>
                <div className="text-[13px] font-bold text-foreground">
                  {getTimelineEntrySummary(latestTimelineEntry)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {TIMELINE_TYPE_LABELS[latestTimelineEntry.type]} · {formatLogTimestamp(latestTimelineEntry.createdAt)}
                </div>
              </div>
            ) : null}
          </section>

          <section className="w-full rounded-2xl border border-border/20 bg-card p-4 grid gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Related context
              </div>
              <div className="mt-1.5 text-[17px] font-bold text-foreground">
                Current board links
              </div>
            </div>

            {selectedEntityLabel ? (
              <div className="grid gap-2.5">
                <div className="rounded-[14px] border border-border/20 bg-muted p-3">
                  <div className="text-xs font-bold text-muted-foreground">Selected board item</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {selectedEntityLabel}
                  </div>
                </div>

                {relatedTimelineEntriesForSelectedEntity.length > 0 ? (
                  <div className="grid gap-2">
                    <div className="text-xs font-bold text-muted-foreground">
                      Linked log items
                    </div>
                    {relatedTimelineEntriesForSelectedEntity.slice(0, 3).map((entry) => (
                      <article
                        key={entry.id}
                        className="rounded-xl border border-border/20 bg-muted p-3"
                      >
                        <div className="text-[13px] font-bold text-foreground">
                          {getTimelineEntrySummary(entry)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatLogTimestamp(entry.createdAt)}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {relatedActionsForSelectedEntity.length > 0 ? (
                  <div className="grid gap-2">
                    <div className="text-xs font-bold text-muted-foreground">
                      Linked actions
                    </div>
                    {relatedActionsForSelectedEntity.slice(0, 3).map((action) => (
                      <article
                        key={action.id}
                        className="rounded-xl border border-border/20 bg-muted p-3"
                      >
                        <div className="text-[13px] font-bold text-foreground">
                          {action.title}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {action.owner ? `Owner: ${action.owner}` : "Owner unassigned"}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                {relatedTimelineEntriesForSelectedEntity.length === 0 &&
                relatedActionsForSelectedEntity.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    No linked log items or actions yet.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Select a board item to see linked log items and actions.
              </div>
            )}
          </section>

          <section className="w-full rounded-2xl border border-border/20 bg-card p-4 grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Follow-up work
                </div>
                <div className="mt-1.5 text-[17px] font-bold text-foreground">
                  Open action context
                </div>
              </div>
              <Button onClick={onOpenActionBoard} size="sm">Open Action Board</Button>
            </div>

            {latestTimelineLinkedActions.length > 0 ? (
              <div className="grid gap-2">
                <div className="text-xs font-bold text-muted-foreground">
                  Latest timeline follow-up
                </div>
                {latestTimelineLinkedActions.slice(0, 3).map((action) => (
                  <article
                    key={action.id}
                    className="rounded-xl border border-border/20 bg-muted p-3"
                  >
                    <div className="text-[13px] font-bold text-foreground">
                      {action.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {action.status.replace("_", " ")}
                    </div>
                  </article>
                ))}
              </div>
            ) : openActions.length > 0 ? (
              <div className="grid gap-2">
                <div className="text-xs font-bold text-muted-foreground">
                  Open actions
                </div>
                {openActions.map((action) => (
                  <article
                    key={action.id}
                    className="rounded-xl border border-border/20 bg-muted p-3"
                  >
                    <div className="text-[13px] font-bold text-foreground">
                      {action.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {action.owner ? `Owner: ${action.owner}` : "Owner unassigned"}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No open actions yet. Create follow-up work from Feed or the Action Board.
              </div>
            )}
          </section>
        </>
      ) : null}
    </aside>
  )
}
