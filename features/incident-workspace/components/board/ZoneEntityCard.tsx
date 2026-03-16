"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ZONE_COLOR_SWATCHES } from "@/features/incident-workspace/components/board/boardShellShared"
import type { BoardEntity, InvestigationZoneEntity } from "@/features/incident-workspace/lib/board/types"
import { cn } from "@/lib/utils"
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react"

type EntityPointerTarget = HTMLElement | HTMLDivElement | HTMLButtonElement

type ZoneEntityCardProps = {
  areZonesEditable: boolean
  entity: InvestigationZoneEntity
  handleEntityDoubleClick: () => void
  handleEntityDragStart: (event: ReactPointerEvent<EntityPointerTarget>) => void
  isSelected: boolean
  isZoneLocked: boolean
  onSelectSingleEntity: (entityId: string) => void
  resizeHandle: ReactNode
  shellStyle: CSSProperties
  updateEntity: (entityId: string, updater: (entity: BoardEntity) => BoardEntity) => void
}

export function ZoneEntityCard({
  entity,
  handleEntityDoubleClick,
  handleEntityDragStart,
  isSelected,
  isZoneLocked,
  onSelectSingleEntity,
  resizeHandle,
  shellStyle,
  updateEntity,
}: ZoneEntityCardProps) {
  return (
    <Card
      key={entity.id}
      className={cn(
        "overflow-hidden rounded-2xl border-dashed bg-card shadow-none",
        isZoneLocked ? "pointer-events-none" : "pointer-events-auto",
      )}
      data-entity-id={entity.id}
      onDoubleClick={handleEntityDoubleClick}
      onPointerDown={isZoneLocked ? undefined : handleEntityDragStart}
      style={{
        ...shellStyle,
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        boxShadow: isSelected
          ? "0 0 0 2px hsl(var(--ring) / 0.72), inset 0 0 0 1px hsl(var(--background) / 0.55)"
          : "inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
      }}
    >
      {isZoneLocked ? (
        <CardContent className="flex items-start justify-start p-4">
          <Badge className="rounded-full bg-background px-3 py-1.5 text-[11px] uppercase tracking-[0.12em]" variant="outline">
            {entity.title}
          </Badge>
        </CardContent>
      ) : (
        <CardContent className="space-y-3 p-4 pb-10 pr-10 pt-4">
          <Badge className="rounded-full text-[11px] uppercase tracking-[0.14em]" variant="muted">
            Zone
          </Badge>
          <Input
            className="h-auto border-0 bg-transparent px-0 text-lg font-bold text-foreground shadow-none focus-visible:ring-0"
            onChange={(event) => {
              updateEntity(entity.id, (current) => ({
                ...current,
                title: event.target.value,
                updatedAt: Date.now(),
              }) as InvestigationZoneEntity)
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
              onSelectSingleEntity(entity.id)
            }}
            value={entity.title}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Zone color
            </div>
            <div className="flex flex-wrap gap-2">
              {ZONE_COLOR_SWATCHES.map((swatch) => {
                const isActive = entity.color === swatch

                return (
                  <Button
                    key={swatch}
                    className={cn(
                      "size-5 rounded-full border p-0 shadow-none transition-transform hover:scale-105",
                      isActive ? "border-foreground ring-2 ring-ring/30" : "border-border/40",
                    )}
                    onClick={(event) => {
                      event.stopPropagation()
                      updateEntity(entity.id, (current) => ({
                        ...current,
                        color: swatch,
                        updatedAt: Date.now(),
                      }) as InvestigationZoneEntity)
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{ background: swatch }}
                    type="button"
                    variant="ghost"
                  />
                )
              })}
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Drag, resize, and rename this zone to structure the board your way.
          </p>
        </CardContent>
      )}
      {resizeHandle}
    </Card>
  )
}
