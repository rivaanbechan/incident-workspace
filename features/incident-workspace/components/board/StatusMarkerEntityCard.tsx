"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import type { StatusMarkerEntity } from "@/features/incident-workspace/lib/board/types"
import { cn } from "@/lib/utils"
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"

type EntityPointerTarget = HTMLElement | HTMLDivElement | HTMLButtonElement

type BadgeVariant = "critical" | "info" | "muted" | "secondary" | "success" | "warning"

type StatusMarkerEntityCardProps = {
  entity: StatusMarkerEntity
  handleEntityDoubleClick: () => void
  handleEntityDragStart: (event: ReactPointerEvent<EntityPointerTarget>) => void
  shellStyle: CSSProperties
}

const TONE_CLASS: Record<StatusMarkerEntity["tone"], string> = {
  danger: "border-destructive/20 bg-card",
  neutral: "border-border bg-card",
  success: "border-success/20 bg-card",
  warn: "border-warning/20 bg-card",
}

const TONE_BADGE_VARIANT: Record<StatusMarkerEntity["tone"], BadgeVariant> = {
  danger: "critical",
  neutral: "muted",
  success: "success",
  warn: "warning",
}

export function StatusMarkerEntityCard({
  entity,
  handleEntityDoubleClick,
  handleEntityDragStart,
  shellStyle,
}: StatusMarkerEntityCardProps) {
  return (
    <Card
      key={entity.id}
      className={cn("rounded-2xl shadow-sm", TONE_CLASS[entity.tone])}
      data-entity-id={entity.id}
      onDoubleClick={handleEntityDoubleClick}
      onPointerDown={handleEntityDragStart}
      style={{ ...shellStyle, height: 52 }}
    >
      <CardContent className="flex h-full items-center justify-between gap-3 px-4 py-0">
        <CardTitle className="text-sm font-bold">{entity.label}</CardTitle>
        <Badge variant={TONE_BADGE_VARIANT[entity.tone]}>{entity.tone}</Badge>
      </CardContent>
    </Card>
  )
}
