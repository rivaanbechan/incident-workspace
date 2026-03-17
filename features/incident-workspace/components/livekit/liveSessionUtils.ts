export type ActiveScreenShare = {
  participantId: string
  participantName: string
  trackId: string
}

export type LiveShareView =
  | { mode: "none" }
  | { mode: "gallery" }
  | { mode: "focused"; openedFromGallery?: boolean; trackId: string }

export type LiveKitSession = {
  serverUrl: string
  token: string
}

export type TokenResponse = LiveKitSession & {
  error?: string
}

export function resolveBrowserLiveKitUrl(serverUrl: string) {
  if (typeof window === "undefined") {
    return serverUrl
  }

  const resolvedUrl = new URL(serverUrl)
  const isLoopbackHost =
    resolvedUrl.hostname === "localhost" ||
    resolvedUrl.hostname === "127.0.0.1" ||
    resolvedUrl.hostname === "0.0.0.0"

  if (isLoopbackHost) {
    resolvedUrl.hostname = window.location.hostname
  }

  const pathname = resolvedUrl.pathname === "/" ? "" : resolvedUrl.pathname

  return `${resolvedUrl.protocol}//${resolvedUrl.host}${pathname}${resolvedUrl.search}${resolvedUrl.hash}`
}

export function supportsScreenShare() {
  if (typeof navigator === "undefined") {
    return false
  }

  return typeof navigator.mediaDevices?.getDisplayMedia === "function"
}

export function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}
