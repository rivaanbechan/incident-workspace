import type { CameraState } from "@/features/incident-workspace/lib/board/types"

export type ConnectionStatus = "connected" | "connecting" | "disconnected"

export const DEFAULT_CAMERA: CameraState = {
  x: 96,
  y: 96,
  zoom: 1,
}
export const DEFAULT_MAP_CARD_WIDTH = 460
export const DEFAULT_MAP_CARD_HEIGHT = 420

export function getCollabServerUrl() {
  if (process.env.NEXT_PUBLIC_Y_WEBSOCKET_URL) {
    return process.env.NEXT_PUBLIC_Y_WEBSOCKET_URL
  }

  if (typeof window === "undefined") {
    return "ws://localhost:1234"
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${window.location.hostname}:1234`
}
