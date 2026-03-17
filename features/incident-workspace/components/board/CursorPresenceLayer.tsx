"use client"

import { boardToScreen } from "@/features/incident-workspace/components/board/boardCore"
import { useBoardEntities } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"

type CursorPresenceLayerProps = {
  speakingParticipantIds: string[]
  stageRect: DOMRect | null
}

/**
 * CursorPresenceLayer — renders remote participant cursors with name tags.
 * Mounted inside the canvas stage at z-index 40.
 */
export function CursorPresenceLayer({ speakingParticipantIds, stageRect }: CursorPresenceLayerProps) {
  const { presence } = useBoardEntities()
  const { camera } = useBoardUI()

  if (!stageRect) {
    return null
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 40,
        borderRadius: 24,
      }}
    >
      {presence
        .filter((item) => item.cursor !== null)
        .map((item) => {
          if (!item.cursor) {
            return null
          }

          const isSpeaking = speakingParticipantIds.includes(item.user.id)
          const point = boardToScreen(item.cursor, stageRect, camera)

          return (
            <div
              key={item.user.id}
              style={{
                position: "absolute",
                left: point.x - stageRect.left,
                top: point.y - stageRect.top,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: item.user.color,
                  boxShadow: isSpeaking
                    ? `0 0 0 3px hsl(var(--background) / 0.9), 0 0 0 5px ${item.user.color}`
                    : "0 0 0 3px hsl(var(--background) / 0.9)",
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  marginLeft: 10,
                  padding: "6px 8px",
                  borderRadius: 10,
                  background: "hsl(var(--foreground))",
                  color: "hsl(var(--background))",
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isSpeaking ? (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "#22c55e",
                      flexShrink: 0,
                    }}
                  />
                ) : null}
                {item.user.name}
              </div>
            </div>
          )
        })}
    </div>
  )
}
