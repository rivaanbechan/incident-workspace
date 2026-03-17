"use client"

import { useBoardEntities } from "@/features/incident-workspace/components/board/BoardEntitiesContext"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"

/**
 * ConnectionLayer — two SVG layers that render entity connections.
 *
 * Layer 1 (z-index 10, behind entities): plain lines.
 * Layer 2 (z-index 15, in front of entities): connection label pills.
 */
export function ConnectionLayer() {
  const { connections, entities, onRenameConnectionLabel } = useBoardEntities()
  const { camera, connectionToneMap } = useBoardUI()

  return (
    <>
      {/* Layer 1: lines behind entities */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "visible",
          zIndex: 10,
        }}
      >
        {connections.map((connection) => {
          const sourceEntity = entities.find((entity) => entity.id === connection.sourceEntityId)
          const targetEntity = entities.find((entity) => entity.id === connection.targetEntityId)

          if (!sourceEntity || !targetEntity) {
            return null
          }

          const sourceX = camera.x + (sourceEntity.x + sourceEntity.width / 2) * camera.zoom
          const sourceY = camera.y + (sourceEntity.y + sourceEntity.height / 2) * camera.zoom
          const targetX = camera.x + (targetEntity.x + targetEntity.width / 2) * camera.zoom
          const targetY = camera.y + (targetEntity.y + targetEntity.height / 2) * camera.zoom
          const tone = connectionToneMap[connection.type]

          return (
            <g key={connection.id}>
              <line
                x1={sourceX}
                y1={sourceY}
                x2={targetX}
                y2={targetY}
                stroke={tone.color}
                strokeDasharray={connection.type === "relates_to" ? "8 6" : undefined}
                strokeWidth={3}
                opacity={0.9}
              />
            </g>
          )
        })}
      </svg>

      {/* Layer 2: label pills in front of entities */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          zIndex: 15,
        }}
      >
        {connections.map((connection) => {
          const sourceEntity = entities.find((entity) => entity.id === connection.sourceEntityId)
          const targetEntity = entities.find((entity) => entity.id === connection.targetEntityId)

          if (!sourceEntity || !targetEntity) {
            return null
          }

          const sourceX = camera.x + (sourceEntity.x + sourceEntity.width / 2) * camera.zoom
          const sourceY = camera.y + (sourceEntity.y + sourceEntity.height / 2) * camera.zoom
          const targetX = camera.x + (targetEntity.x + targetEntity.width / 2) * camera.zoom
          const targetY = camera.y + (targetEntity.y + targetEntity.height / 2) * camera.zoom
          const midX = (sourceX + targetX) / 2
          const midY = (sourceY + targetY) / 2
          const tone = connectionToneMap[connection.type]
          const connectionLabel =
            connection.type === "custom" && connection.customLabel?.trim()
              ? connection.customLabel.trim()
              : tone.label
          const labelWidth = Math.max(68, Math.min(connectionLabel.length * 7 + 20, 160))

          return (
            <g key={`label-${connection.id}`}>
              <rect
                x={midX - labelWidth / 2}
                y={midY - 11}
                width={labelWidth}
                height={22}
                rx={11}
                fill="hsl(var(--background) / 0.96)"
                stroke={tone.color}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onClick={(event) => {
                  event.stopPropagation()
                  onRenameConnectionLabel(connection.id, connectionLabel)
                }}
              />
              <text
                x={midX}
                y={midY + 4}
                fill={tone.color}
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={(event) => {
                  event.stopPropagation()
                  onRenameConnectionLabel(connection.id, connectionLabel)
                }}
              >
                {connectionLabel}
              </text>
            </g>
          )
        })}
      </svg>
    </>
  )
}
