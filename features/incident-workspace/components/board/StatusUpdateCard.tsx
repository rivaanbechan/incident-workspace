"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

type StatusUpdateCardProps = {
  comment: string
  fromLabel: string
  toLabel: string
  onChangeComment: (value: string) => void
  onDismiss: () => void
  onSubmit: () => void
  /** Set true on drag-enabled boards to stop pointer events propagating to drag handlers. */
  stopPointerPropagation?: boolean
  submitLabel?: string
}

/**
 * StatusUpdateCard — inline card for logging a status transition comment.
 * Used in ActionKanbanBoard and YourTasksPanel.
 */
export function StatusUpdateCard({
  comment,
  fromLabel,
  toLabel,
  onChangeComment,
  onDismiss,
  onSubmit,
  stopPointerPropagation = false,
  submitLabel = "Post Update",
}: StatusUpdateCardProps) {
  const stopProp = stopPointerPropagation
    ? (e: React.PointerEvent) => e.stopPropagation()
    : undefined

  return (
    <Card className="border-border/40 bg-muted/35 shadow-none">
      <CardContent className="grid gap-2 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Post status update
        </div>
        <div className="text-xs font-semibold text-foreground">
          {fromLabel} to {toLabel}
        </div>
        <Textarea
          className="min-h-[72px] resize-y bg-background/80 text-xs leading-6"
          onChange={(event) => onChangeComment(event.target.value)}
          onPointerDown={stopProp}
          placeholder="Optional note for the timeline..."
          value={comment}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onSubmit}
            onPointerDown={stopProp}
            size="sm"
            type="button"
          >
            {submitLabel}
          </Button>
          <Button
            onClick={onDismiss}
            onPointerDown={stopProp}
            size="sm"
            type="button"
            variant="secondary"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
