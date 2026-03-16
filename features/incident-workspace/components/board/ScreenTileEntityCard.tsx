"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { BoardEntity, ScreenTileEntity } from "@/features/incident-workspace/lib/board/types"
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react"

type EntityPointerTarget = HTMLElement | HTMLDivElement | HTMLButtonElement

type ScreenTileEntityCardProps = {
  entity: ScreenTileEntity
  handleEntityDoubleClick: () => void
  handleEntityDragStart: (event: ReactPointerEvent<EntityPointerTarget>) => void
  onConnectToEntity: (entityId: string) => void
  onSelectSingleEntity: (entityId: string) => void
  pendingConnectionSourceId: string | null
  resizeHandle: ReactNode
  shellStyle: CSSProperties
  updateEntity: (entityId: string, updater: (entity: BoardEntity) => BoardEntity) => void
}

export function ScreenTileEntityCard({
  entity,
  handleEntityDoubleClick,
  handleEntityDragStart,
  onConnectToEntity,
  onSelectSingleEntity,
  pendingConnectionSourceId,
  resizeHandle,
  shellStyle,
  updateEntity,
}: ScreenTileEntityCardProps) {
  return (
    <Card
      key={entity.id}
      className="overflow-hidden rounded-2xl border-border bg-background"
      data-entity-id={entity.id}
      onDoubleClick={handleEntityDoubleClick}
      onPointerDown={handleEntityDragStart}
      onPointerDownCapture={(event) => {
        if (pendingConnectionSourceId && pendingConnectionSourceId !== entity.id) {
          event.stopPropagation()
          onConnectToEntity(entity.id)
        }
      }}
      style={{
        ...shellStyle,
        backgroundColor: "var(--card)",
        borderColor: entity.status === "active" ? "#2563eb" : "var(--border)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: entity.status === "active" ? "#2563eb" : "var(--border)" }}
      />
      <div className="flex h-full min-h-0 flex-col">
        <CardHeader className="px-4 pb-3 pr-10 pt-4">
          <CardTitle>
            <Input
              className="h-auto border-0 bg-transparent px-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  title: event.target.value,
                  updatedAt: Date.now(),
                }) as ScreenTileEntity)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectSingleEntity(entity.id)
              }}
              value={entity.title}
            />
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="px-4 pb-10 pr-10 pt-4">
          <Card className="mt-0 grid place-items-center rounded-2xl border border-dashed border-border/60 bg-muted shadow-none">
            <CardContent
              className="grid place-items-center p-4 text-center text-sm text-muted-foreground"
              style={{ height: entity.height - 112 }}
            >
              {entity.status === "active"
                ? "Live screen share connected."
                : "Waiting for a shared screen."}
            </CardContent>
          </Card>
        </CardContent>
      </div>
      {resizeHandle}
    </Card>
  )
}
