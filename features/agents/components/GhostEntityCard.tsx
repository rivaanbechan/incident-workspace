"use client"

import { Button } from "@/components/ui/button"
import type { GhostEntity } from "@/features/incident-workspace/lib/board/types"

type Props = {
  ghost: GhostEntity
  onAccept: (ghost: GhostEntity) => void
  onDismiss: (ghost: GhostEntity) => void
}

export function GhostEntityCard({ ghost, onAccept, onDismiss }: Props) {
  return (
    <div
      className="flex w-72 flex-col gap-3 rounded-2xl border border-dashed border-sky-400/60 bg-sky-950/80 p-4 text-sky-100 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">
            Proposed · {ghost.proposedKind}
          </div>
          <div className="mt-1 text-sm font-semibold">{ghost.label}</div>
        </div>
      </div>

      {ghost.summary ? (
        <p className="text-xs leading-5 text-sky-300">{ghost.summary}</p>
      ) : null}

      <div className="flex gap-2">
        <Button
          className="h-8 border-sky-400/40 text-sky-200 hover:bg-sky-800"
          onClick={() => onAccept(ghost)}
          size="sm"
          type="button"
          variant="outline"
        >
          Accept
        </Button>
        <Button
          className="h-8 text-sky-400 hover:bg-sky-900/50"
          onClick={() => onDismiss(ghost)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
