"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { ConnectionStatus } from "@/features/incident-workspace/components/board/boardCore"
import { cn } from "@/lib/utils"

type BoardHeaderProps = {
  actions?: ReactNode
  connectionStatus: ConnectionStatus
  liveSessionControl?: ReactNode
  roomId: string
}

export function BoardHeader({
  actions,
  connectionStatus,
  liveSessionControl,
  roomId,
}: BoardHeaderProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-lg backdrop-blur">
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Incident Workspace
            </div>
            <div className="text-lg font-semibold text-foreground">Room: {roomId}</div>
          </div>
          <Badge
            className={cn(
              "capitalize",
              connectionStatus === "connected"
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            {connectionStatus}
          </Badge>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {actions}
          <Button asChild size="sm">
            <Link href={`/hunt/${roomId}`} target="_blank" rel="noopener noreferrer">Open Hunt Graph</Link>
          </Button>
          {liveSessionControl}
        </div>
      </CardContent>
    </Card>
  )
}
