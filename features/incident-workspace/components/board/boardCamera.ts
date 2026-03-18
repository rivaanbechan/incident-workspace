import type { BoardEntity, BoardPoint, CameraState, PresenceState } from "@/features/incident-workspace/lib/board/types"

export function screenToBoard(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: CameraState,
) {
  return {
    x: (clientX - rect.left - camera.x) / camera.zoom,
    y: (clientY - rect.top - camera.y) / camera.zoom,
  }
}

export function boardToScreen(point: BoardPoint, rect: DOMRect, camera: CameraState) {
  return {
    x: rect.left + camera.x + point.x * camera.zoom,
    y: rect.top + camera.y + point.y * camera.zoom,
  }
}

export function isPresenceState(value: unknown): value is PresenceState {
  if (!value || typeof value !== "object") return false
  const candidate = value as PresenceState
  return (
    typeof candidate.roomId === "string" &&
    typeof candidate.user?.id === "string" &&
    typeof candidate.user?.name === "string" &&
    typeof candidate.user?.color === "string"
  )
}

export function nextZIndex(entities: BoardEntity[]) {
  return entities.reduce((max, entity) => Math.max(max, entity.zIndex), 0) + 1
}

export function nextBackgroundZIndex(entities: BoardEntity[]) {
  return entities.reduce((min, entity) => Math.min(min, entity.zIndex), 0) - 1
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function formatLogTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(timestamp))
}
