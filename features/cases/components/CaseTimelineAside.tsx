import { removeCaseRecordAction } from "@/features/cases/actions"
import { EmptyState } from "@/components/shell/EmptyState"
import { TimelineEntry } from "@/components/shell/TimelineEntry"
import {
  formatTimestamp,
  formatTimelineDay,
  getSourceBadgeVariant,
  getSourceLabel,
  getTimelineBadgeVariant,
  getTimelineTone,
  getTimelineTypeLabel,
} from "@/features/cases/lib/formatters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock, LayoutGrid } from "lucide-react"

export type CaseTimelineItem = {
  id: string
  body: string
  createdAt: number
  linkedActionIds: string[]
  linkedEntityIds: string[]
  source: "case" | "artifact" | "record"
  type: string
}

type CaseTimelineAsideProps = {
  caseId: string
  roomId: string
  timeline: CaseTimelineItem[]
}

export function CaseTimelineAside({ caseId, roomId, timeline }: CaseTimelineAsideProps) {
  return (
    <aside className="sticky top-7 min-w-0 self-start xl:h-[calc(100vh-56px)]">
      <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/50 bg-card/95 shadow-lg">
        <CardHeader className="gap-4 border-b border-border/40 bg-gradient-to-b from-card via-card to-muted/20 pb-4 pt-4">
          <div>
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Clock className="size-4 text-muted-foreground" />
                Case Timeline
              </CardTitle>
              <CardDescription className="mt-1">
                Review promoted case activity and workspace milestones in one feed.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {timeline.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-5">
            <EmptyState
              icon={<Clock className="size-5 text-muted-foreground" />}
              heading="No timeline entries yet"
              message="Promote findings or feed updates into the case record to build the timeline."
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid min-w-0 gap-4">
              {timeline.map((item, index) => {
                const tone = getTimelineTone(item.type)
                const currentDay = formatTimelineDay(item.createdAt)
                const previousDay =
                  index > 0 ? formatTimelineDay(timeline[index - 1].createdAt) : null

                return (
                  <TimelineEntry
                    key={item.id}
                    currentDay={currentDay}
                    previousDay={previousDay}
                    timestampLabel={formatTimestamp(new Date(item.createdAt).toISOString())}
                    secondaryLabel={getSourceLabel(item.source)}
                    tone={tone}
                  >
                    <CardContent className="grid gap-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={getTimelineBadgeVariant(item.type)}
                            className="uppercase tracking-[0.12em]"
                          >
                            {getTimelineTypeLabel(item.type)}
                          </Badge>
                          <Badge variant={getSourceBadgeVariant(item.source)}>
                            {getSourceLabel(item.source)}
                          </Badge>
                        </div>
                        {item.source === "record" ? (
                          <form action={removeCaseRecordAction}>
                            <input type="hidden" name="caseId" value={caseId} />
                            <input
                              type="hidden"
                              name="recordId"
                              value={item.id.replace("record-", "")}
                            />
                            <Button size="sm" type="submit" variant="ghost">
                              Remove
                            </Button>
                          </form>
                        ) : null}
                      </div>

                      <div className="whitespace-pre-wrap break-all text-sm leading-7 text-foreground/85">
                        {item.body}
                      </div>

                      {(item.linkedActionIds.length > 0 || item.linkedEntityIds.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.linkedActionIds.length > 0 && (
                            <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                              <CheckCircle2 className="size-3" />
                              {item.linkedActionIds.length} action{item.linkedActionIds.length === 1 ? "" : "s"}
                            </div>
                          )}
                          {item.linkedEntityIds.length > 0 && (
                            <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                              <LayoutGrid className="size-3" />
                              {item.linkedEntityIds.length} entit{item.linkedEntityIds.length === 1 ? "y" : "ies"}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </TimelineEntry>
                )
              })}
            </div>
          </div>
        )}
        <div className="border-t border-border/40 bg-muted/20 p-3">
          <Button asChild variant="secondary" size="sm" className="w-full justify-start gap-2 text-xs">
            <Link href={`/board/${roomId}?tab=feed`}>
              <ArrowRight className="size-3" />
              Continue in Workspace
            </Link>
          </Button>
        </div>
      </Card>
    </aside>
  )
}
