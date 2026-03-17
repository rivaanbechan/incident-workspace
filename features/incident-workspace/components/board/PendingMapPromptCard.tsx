"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBoardEntities } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"

/**
 * PendingMapPromptCard — top-right floating card that suggests the next action
 * after an entity is placed on the board (log to feed or create action).
 */
export function PendingMapPromptCard() {
  const { visiblePendingMapPrompt, onDismissPendingMapPrompt } = useBoardUI()
  const { getEntityLabel, onCreateActionForEntity, onLogEntityToFeed } = useBoardEntities()

  if (!visiblePendingMapPrompt) {
    return null
  }

  return (
    <Card
      style={{
        position: "absolute",
        right: 16,
        top: 16,
        boxShadow: "0 18px 48px rgba(15, 23, 42, 0.18)",
        maxWidth: 320,
      }}
      className="border-border/60 bg-card/95 backdrop-blur"
    >
      <CardHeader className="space-y-2 p-4">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
          Next step
        </CardDescription>
        <CardTitle className="text-sm">
          {getEntityLabel(visiblePendingMapPrompt.entityId)}
        </CardTitle>
        <CardDescription className="leading-5">
          {visiblePendingMapPrompt.recommendedAction === "feed"
            ? "This artifact usually needs a shared incident update."
            : "This artifact usually needs owned follow-up work."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
        <Button
          onClick={() =>
            visiblePendingMapPrompt.recommendedAction === "feed"
              ? onLogEntityToFeed(visiblePendingMapPrompt.entityId)
              : onCreateActionForEntity(visiblePendingMapPrompt.entityId)
          }
          size="sm"
          type="button"
        >
          {visiblePendingMapPrompt.recommendedAction === "feed" ? "Log to Feed" : "Create Action"}
        </Button>
        <Button onClick={onDismissPendingMapPrompt} size="sm" type="button" variant="ghost">
          Dismiss
        </Button>
      </CardContent>
    </Card>
  )
}
