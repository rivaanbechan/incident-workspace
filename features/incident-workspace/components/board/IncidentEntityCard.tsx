"use client"

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
import type { BoardEntity, IncidentCardEntity } from "@/features/incident-workspace/lib/board/types"
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react"
import type { SurfaceTone } from "./NoteEntityCard"

type EntityPointerTarget = HTMLElement | HTMLDivElement | HTMLButtonElement

type IncidentEntityCardProps = {
  entity: IncidentCardEntity
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

export function IncidentEntityCard({
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
}: IncidentEntityCardProps) {
  return (
    <Card
      key={entity.id}
      className="overflow-hidden rounded-2xl border-border bg-card"
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
        <CardHeader className="gap-3 px-5 pb-2 pr-10 pt-4">
          {metaBadges}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              onValueChange={(value) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  severity: value as IncidentCardEntity["severity"],
                  updatedAt: Date.now(),
                }) as IncidentCardEntity)
              }}
              value={entity.severity}
            >
              <SelectTrigger
                className="h-9 rounded-full bg-background text-xs font-semibold"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  status: value as IncidentCardEntity["status"],
                  updatedAt: Date.now(),
                }) as IncidentCardEntity)
              }}
              value={entity.status}
            >
              <SelectTrigger
                className="h-9 rounded-full bg-background text-xs font-semibold"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="mitigated">Mitigated</SelectItem>
              </SelectContent>
            </Select>
            {entity.mapKind === "scope" ? (
              <Select
                onValueChange={(value) => {
                  updateEntity(entity.id, (current) => ({
                    ...current,
                    scopeType: value as IncidentCardEntity["scopeType"],
                    updatedAt: Date.now(),
                  }) as IncidentCardEntity)
                }}
                value={entity.scopeType ?? "service"}
              >
                <SelectTrigger
                  className="h-9 rounded-full bg-background text-xs font-semibold"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="host">Host</SelectItem>
                  <SelectItem value="identity">Identity</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="detection">Detection</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <CardTitle>
            <Input
              className="h-auto border-0 bg-transparent px-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0"
              onChange={(event) => {
                updateEntity(entity.id, (current) => ({
                  ...current,
                  title: event.target.value,
                  updatedAt: Date.now(),
                }) as IncidentCardEntity)
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectSingleEntity(entity.id)
              }}
              value={entity.title}
            />
          </CardTitle>
          <Input
            className="bg-background"
            onChange={(event) => {
              updateEntity(entity.id, (current) => ({
                ...current,
                owner: event.target.value,
                updatedAt: Date.now(),
              }) as IncidentCardEntity)
            }}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder="Owner"
            value={entity.owner ?? ""}
          />
        </CardHeader>
        <Separator />
        <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 px-5 pb-10 pr-10 pt-3">
          <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
            Impact details
          </CardDescription>
          <Textarea
            className="min-h-0 flex-1 resize-none bg-background leading-6"
            onChange={(event) => {
              updateEntity(entity.id, (current) => ({
                ...current,
                body: event.target.value,
                updatedAt: Date.now(),
              }) as IncidentCardEntity)
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
