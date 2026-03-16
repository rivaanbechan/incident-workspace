"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { BoardEntity, NoteEntity } from "@/features/incident-workspace/lib/board/types"
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react"

type EntityPointerTarget = HTMLElement | HTMLDivElement | HTMLButtonElement

export type SurfaceTone = {
  accent: string
  tint: string
}

type NoteEntityCardProps = {
  entity: NoteEntity
  handleEntityDoubleClick: () => void
  handleEntityDragStart: (event: ReactPointerEvent<EntityPointerTarget>) => void
  metaBadges: ReactNode
  onConnectToEntity: (entityId: string) => void
  onSelectSingleEntity: (entityId: string) => void
  pendingConnectionSourceId: string | null
  resizeHandle: ReactNode
  shellStyle: CSSProperties
  surfaceTone: SurfaceTone
  updateEntity: (entityId: string, updater: (entity: BoardEntity) => BoardEntity) => void
}

export function NoteEntityCard({
  entity,
  handleEntityDoubleClick,
  handleEntityDragStart,
  metaBadges,
  onConnectToEntity,
  onSelectSingleEntity,
  pendingConnectionSourceId,
  resizeHandle,
  shellStyle,
  surfaceTone,
  updateEntity,
}: NoteEntityCardProps) {
  const evidenceUrl =
    entity.mapKind === "evidence" ? entity.sourceLabel?.trim() ?? "" : ""
  const hasEvidenceUrl =
    evidenceUrl.startsWith("https://") || evidenceUrl.startsWith("http://")

  return (
    <Card
      key={entity.id}
      className="overflow-hidden rounded-2xl border-border/50 bg-card"
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
        borderColor: surfaceTone.accent,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: surfaceTone.accent }}
      />
      <div className="flex h-full min-h-0 flex-col">
        <CardHeader className="gap-3 px-4 pb-2 pr-10 pt-4">
          {metaBadges}
          <CardTitle>
            <Input
              className="h-auto border-0 bg-transparent px-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  title: event.target.value,
                  updatedAt: Date.now(),
                }) as NoteEntity)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectSingleEntity(entity.id)
              }}
              value={entity.title}
            />
          </CardTitle>

          {entity.mapKind === "hypothesis" ? (
            <div className="flex flex-wrap gap-2">
              <Select
                onValueChange={(value) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    state: value as NoteEntity["state"],
                    updatedAt: Date.now(),
                  }) as NoteEntity)
                }}
                value={entity.state ?? "new"}
              >
                <SelectTrigger
                  className="h-9 rounded-full bg-background text-xs font-semibold"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="supported">Supported</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="h-9 min-w-[140px] flex-1 rounded-full bg-background"
                onChange={(event) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    owner: event.target.value,
                    updatedAt: Date.now(),
                  }) as NoteEntity)
                }}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="Owner"
                value={entity.owner ?? ""}
              />
            </div>
          ) : null}

          {entity.mapKind === "evidence" ? (
            <div className="grid gap-2">
              <Input
                className="bg-background"
                onChange={(event) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    sourceLabel: event.target.value,
                    updatedAt: Date.now(),
                  }) as NoteEntity)
                }}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="Source or deep link"
                value={entity.sourceLabel ?? ""}
              />
              {hasEvidenceUrl ? (
                <Button
                  className="justify-self-start"
                  onClick={(event) => {
                    event.stopPropagation()
                    window.open(evidenceUrl, "_blank", "noopener,noreferrer")
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Open source
                </Button>
              ) : null}
            </div>
          ) : null}

          {entity.mapKind === "blocker" || entity.mapKind === "handoff" ? (
            <Input
              className="bg-background"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  owner: event.target.value,
                  updatedAt: Date.now(),
                }) as NoteEntity)
              }}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder="Owner"
              value={entity.owner ?? ""}
            />
          ) : null}
        </CardHeader>
        <Separator />
        <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-4 pb-10 pr-10 pt-3">
          <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            Details
          </CardDescription>
          <Textarea
            className="min-h-0 flex-1 resize-none bg-background leading-6"
            onChange={(event) => {
              updateEntity(entity.id, (current) => ({
                ...current,
                body: event.target.value,
                updatedAt: Date.now(),
              }) as NoteEntity)
            }}
            onPointerDown={(event) => {
              event.stopPropagation()
              onSelectSingleEntity(entity.id)
            }}
            value={entity.body}
          />
        </CardContent>
      </div>
      {resizeHandle}
    </Card>
  )
}
