"use client"

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ReasoningEntity } from "@/features/incident-workspace/lib/board/types"
import type { EntityPointerTarget } from "@/features/incident-workspace/components/board/BoardEntityRenderer"

type Props = {
  entity: ReasoningEntity
  handleEntityDragStart: (
    event: ReactPointerEvent<EntityPointerTarget>,
    entityId: string,
  ) => void
  onCancel?: (entityId: string) => void
  shellStyle: CSSProperties
  currentUserId?: string
}

const STATUS_VARIANT = {
  running: "warning",
  complete: "success",
  error: "critical",
  cancelled: "muted",
} as const

export function ReasoningEntityCard({
  currentUserId,
  entity,
  handleEntityDragStart,
  onCancel,
  shellStyle,
}: Props) {
  const isRunning = entity.status === "running"
  const canCancel = isRunning && currentUserId === entity.invokingUserId

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-violet-400/40 bg-violet-950/90 text-violet-100 backdrop-blur"
      data-entity-id={entity.id}
      onPointerDown={(event) => handleEntityDragStart(event, entity.id)}
      style={shellStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-violet-400/20 px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="shrink-0 text-violet-300">
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="truncate text-sm font-semibold">{entity.agentName}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={STATUS_VARIANT[entity.status]}>{entity.status}</Badge>
          {canCancel && onCancel ? (
            <Button
              className="h-7 border-violet-400/40 text-violet-200 hover:bg-violet-800"
              onClick={(e) => {
                e.stopPropagation()
                onCancel(entity.id)
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {/* Tool call summary */}
      {entity.toolCallSummary ? (
        <div className="border-b border-violet-400/20 px-4 py-2 text-xs text-violet-300">
          {entity.toolCallSummary}
        </div>
      ) : null}

      {/* Narrative — always visible */}
      <div className="flex-1 overflow-y-auto p-4 text-sm leading-6 text-violet-100">
        {entity.narrative ? (
          <ReactMarkdown
            remarkPlugins={[remarkBreaks]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-2 mt-4 border-b border-violet-400/20 pb-1 text-sm font-bold text-violet-100 first:mt-0">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-1.5 mt-3 text-sm font-bold text-violet-200 first:mt-0">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="mb-1 mt-2 text-sm font-semibold text-violet-300 first:mt-0">{children}</h3>
              ),
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 list-disc pl-4 marker:text-violet-400">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 marker:text-violet-400">{children}</ol>,
              li: ({ children }) => <li className="mb-0.5 pl-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-violet-100">{children}</strong>,
              em: ({ children }) => <em className="italic text-violet-300">{children}</em>,
              code: ({ children }) => (
                <code className="rounded bg-violet-900/60 px-1 py-0.5 font-mono text-xs text-violet-300">{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="mb-2 overflow-x-auto rounded-lg bg-violet-900/60 p-3 font-mono text-xs text-violet-300">{children}</pre>
              ),
              hr: () => <hr className="my-3 border-violet-400/20" />,
              blockquote: ({ children }) => (
                <blockquote className="mb-2 border-l-2 border-violet-400/40 pl-3 text-violet-300">{children}</blockquote>
              ),
            }}
          >
            {entity.narrative}
          </ReactMarkdown>
        ) : (
          isRunning ? "Thinking…" : "No narrative captured."
        )}
        {isRunning ? (
          <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-violet-400" />
        ) : null}
      </div>
    </div>
  )
}
