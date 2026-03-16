"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { formatLogTimestamp } from "@/features/incident-workspace/components/board/boardCore"
import type { IncidentLogEntry } from "@/features/incident-workspace/lib/board/types"

type IncidentLogPanelProps = {
  draft: string
  entries: IncidentLogEntry[]
  onAddEntry: () => void
  onDraftChange: (value: string) => void
}

export function IncidentLogPanel({
  draft,
  entries,
  onAddEntry,
  onDraftChange,
}: IncidentLogPanelProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-transparent bg-background/95 text-foreground shadow-xl shadow-background/20">
      <CardHeader className="border-b border-border">
        <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Incident Log
        </CardDescription>
        <CardTitle className="text-foreground">Shared room notebook</CardTitle>
        <CardDescription className="text-sm leading-6 text-muted-foreground">
          Capture timeline updates, decisions, owners, and hypotheses in one collaborative feed.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-border bg-muted p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: entry.authorColor }}
                />
                <span>{entry.authorName}</span>
                <span className="font-normal text-muted-foreground">
                  {formatLogTimestamp(entry.createdAt)}
                </span>
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {entry.body}
              </div>
            </article>
          ))}
        </div>

        <div className="border-t border-border bg-background/70 p-4">
          <Textarea
            className="min-h-24 border-border bg-muted text-foreground placeholder:text-muted-foreground"
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Add a timeline update, decision, owner, or next action..."
            value={draft}
          />
          <Button
            className="mt-3 w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onAddEntry}
            type="button"
          >
            Add Log Entry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
