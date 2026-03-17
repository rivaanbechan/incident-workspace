"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useBoardEntities } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"
import { cn } from "@/lib/utils"

const ENTITY_BUTTONS = [
  { accent: "#7c3aed", hotkey: "Q", label: "Hypothesis", key: "hypothesis" },
  { accent: "#2563eb", hotkey: "W", label: "Impact", key: "impact" },
  { accent: "#16a34a", hotkey: "E", label: "Evidence", key: "evidence" },
  { accent: "#dc2626", hotkey: "R", label: "Blocker", key: "blocker" },
  { accent: "#d97706", hotkey: "T", label: "Handoff", key: "handoff" },
  { accent: "hsl(var(--muted-foreground))", hotkey: "Y", label: "Zone", key: "zone" },
] as const

/**
 * EntityCreationToolbar — the bottom-centre floating card with entity creation buttons.
 * Mounted as an absolutely-positioned overlay inside the board canvas stage.
 */
export function EntityCreationToolbar() {
  const {
    onCreateBlocker,
    onCreateEvidenceNote,
    onCreateHandoff,
    onCreateHypothesis,
    onCreateImpactNote,
    onCreateZone,
  } = useBoardEntities()
  const { areZonesEditable, onToggleZoneEditing } = useBoardUI()

  const handlers: Record<typeof ENTITY_BUTTONS[number]["key"], () => void> = {
    blocker: onCreateBlocker,
    evidence: onCreateEvidenceNote,
    handoff: onCreateHandoff,
    hypothesis: onCreateHypothesis,
    impact: onCreateImpactNote,
    zone: onCreateZone,
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        pointerEvents: "none",
        width: "min(920px, calc(100% - 380px))",
        display: "flex",
        justifyContent: "center",
        zIndex: 110,
      }}
    >
      <Card
        className="relative border-border/50 bg-card/92 shadow-xl backdrop-blur"
        style={{ pointerEvents: "auto" }}
      >
        <CardContent className="flex items-center gap-2 p-2">
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "nowrap",
              justifyContent: "center",
            }}
          >
            {ENTITY_BUTTONS.map((card) => (
              <Button
                key={card.label}
                className="relative h-auto w-[118px] min-w-[118px] rounded-2xl border-border/40 bg-background/92 px-3 py-3 text-left shadow-md"
                onClick={handlers[card.key]}
                type="button"
                variant="outline"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                  style={{ background: card.accent }}
                />
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-extrabold text-foreground">
                      {card.label}
                    </span>
                    <Badge
                      className="bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
                      style={{ color: card.accent, borderColor: card.accent }}
                      variant="outline"
                    >
                      {card.hotkey}
                    </Badge>
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Add {card.label.toLowerCase()}
                  </div>
                </div>
              </Button>
            ))}

            <Button
              className="h-auto w-[118px] min-w-[118px] rounded-2xl px-3 py-3 text-left shadow-md"
              onClick={onToggleZoneEditing}
              type="button"
              variant={areZonesEditable ? "default" : "outline"}
            >
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-extrabold">
                    {areZonesEditable ? "Lock Zones" : "Edit Zones"}
                  </span>
                  <Badge variant={areZonesEditable ? "secondary" : "muted"}>D</Badge>
                </div>
                <div
                  className={cn(
                    "text-[11px] font-medium",
                    areZonesEditable ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {areZonesEditable ? "Lock zone layout" : "Edit zone layout"}
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
