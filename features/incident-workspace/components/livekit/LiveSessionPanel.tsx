"use client"

import { Button } from "@/components/ui/button"
import type { PresenceUser } from "@/features/incident-workspace/lib/board/types"
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react"
import type { TrackReference } from "@livekit/components-react"
import { Track } from "livekit-client"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type ActiveScreenShare = {
  participantId: string
  participantName: string
  trackId: string
}

export type LiveShareView =
  | { mode: "none" }
  | { mode: "gallery" }
  | { mode: "focused"; openedFromGallery?: boolean; trackId: string }

type LiveSessionPanelProps = {
  activeShareView: LiveShareView
  inlineTrigger?: boolean
  isViewerEnabled?: boolean
  onActiveShareViewChange: (view: LiveShareView) => void
  onScreenSharesChange: (screenShares: ActiveScreenShare[]) => void
  roomId: string
  user: PresenceUser
}

type LiveKitSession = {
  serverUrl: string
  token: string
}

type TokenResponse = LiveKitSession & {
  error?: string
}

function resolveBrowserLiveKitUrl(serverUrl: string) {
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

function supportsScreenShare() {
  if (typeof navigator === "undefined") {
    return false
  }

  return typeof navigator.mediaDevices?.getDisplayMedia === "function"
}

function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function LiveSessionViewer({
  activeShareView,
  isViewerEnabled = true,
  onActiveShareViewChange,
  onScreenSharesChange,
  showControls = true,
}: {
  activeShareView: LiveShareView
  isViewerEnabled?: boolean
  onActiveShareViewChange: (view: LiveShareView) => void
  onScreenSharesChange: (screenShares: ActiveScreenShare[]) => void
  showControls?: boolean
}) {
  const { isScreenShareEnabled, localParticipant } = useLocalParticipant()
  const screenTracks = useTracks([Track.Source.ScreenShare]) as TrackReference[]
  const [isTogglingShare, setIsTogglingShare] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const canScreenShare = supportsScreenShare()
  const isScreenShareEnabledRef = useRef(isScreenShareEnabled)

  const activeScreenShares = useMemo(
    () =>
      screenTracks
        .map((trackRef) => {
          const trackId = trackRef.publication.trackSid

          if (!trackId) {
            return null
          }

          return {
            participantId: trackRef.participant.identity,
            participantName: trackRef.participant.name || trackRef.participant.identity,
            trackId,
          }
        })
        .filter((screenShare): screenShare is ActiveScreenShare => screenShare !== null)
        .sort((left, right) => left.trackId.localeCompare(right.trackId)),
    [screenTracks],
  )

  useEffect(() => {
    onScreenSharesChange(activeScreenShares)
  }, [activeScreenShares, onScreenSharesChange])

  useEffect(() => {
    isScreenShareEnabledRef.current = isScreenShareEnabled
  }, [isScreenShareEnabled])

  useEffect(() => {
    if (!isViewerEnabled) {
      onActiveShareViewChange({ mode: "none" })
      return
    }

    if (activeScreenShares.length === 0) {
      if (activeShareView.mode !== "none") {
        onActiveShareViewChange({ mode: "none" })
      }
      return
    }

    if (
      activeShareView.mode === "focused" &&
      !activeScreenShares.some((share) => share.trackId === activeShareView.trackId)
    ) {
      onActiveShareViewChange(
        activeScreenShares.length > 0 ? { mode: "gallery" } : { mode: "none" },
      )
    }
  }, [activeScreenShares, activeShareView, isViewerEnabled, onActiveShareViewChange])

  useEffect(() => {
    return () => {
      onScreenSharesChange([])
      if (isScreenShareEnabledRef.current) {
        void localParticipant.setScreenShareEnabled(false).catch(() => {})
      }
    }
  }, [localParticipant, onScreenSharesChange])

  const handleToggleShare = async () => {
    if (!canScreenShare) {
      setToggleError("This browser does not support screen sharing.")
      return
    }

    try {
      setIsTogglingShare(true)
      setToggleError(null)
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    } catch (error) {
      setToggleError(
        error instanceof Error ? error.message : "Unable to change screen sharing state.",
      )
    } finally {
      setIsTogglingShare(false)
    }
  }

  const focusedTrack =
    activeShareView.mode === "focused"
      ? screenTracks.find((trackRef) => trackRef.publication.trackSid === activeShareView.trackId)
      : null

  const viewerOverlay =
    isViewerEnabled && activeShareView.mode !== "none" && activeScreenShares.length > 0 ? (
      <div
        onClick={() => onActiveShareViewChange({ mode: "none" })}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(2, 6, 23, 0.82)",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        {activeShareView.mode === "gallery" ? (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(94vw, 1600px)",
              maxHeight: "92vh",
              borderRadius: 24,
              overflow: "hidden",
              background: "rgba(15, 23, 42, 0.94)",
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.45)",
              padding: 18,
              display: "grid",
              gridTemplateRows: "auto minmax(0, 1fr)",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ color: "hsl(var(--foreground))", fontSize: 18, fontWeight: 800 }}>
                Gallery mode
              </div>
              <button
                onClick={() => onActiveShareViewChange({ mode: "none" })}
                style={{
                  border: "none",
                  borderRadius: 999,
                  background: "hsl(var(--muted) / 0.5)",
                  color: "hsl(var(--foreground))",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  activeScreenShares.length === 1
                    ? "minmax(0, 1fr)"
                    : activeScreenShares.length <= 4
                      ? "repeat(2, minmax(0, 1fr))"
                      : "repeat(3, minmax(0, 1fr))",
                gap: 14,
                justifyItems: activeScreenShares.length === 1 ? "center" : "stretch",
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              {screenTracks.map((trackRef) => {
                const trackId = trackRef.publication.trackSid

                if (!trackId) {
                  return null
                }

                return (
                  <button
                    key={trackId}
                    onClick={() =>
                      onActiveShareViewChange({
                        mode: "focused",
                        openedFromGallery: true,
                        trackId,
                      })
                    }
                    style={{
                      border: "none",
                      borderRadius: 18,
                      background: "hsl(var(--background))",
                      overflow: "hidden",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.24)",
                      width:
                        activeScreenShares.length === 1
                          ? "min(100%, 1120px)"
                          : "100%",
                    }}
                  >
                    <div style={{ aspectRatio: "16 / 9", background: "#020617" }}>
                      <VideoTrack
                        trackRef={trackRef}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          background: "hsl(var(--background))",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        color: "#e2e8f0",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      <span>{trackRef.participant.name || trackRef.participant.identity}</span>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>Open</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : focusedTrack ? (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "relative",
              width: "min(calc(100vw - 32px), calc((100vh - 32px) * 16 / 9))",
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100vh - 32px)",
              aspectRatio: "16 / 9",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.45)",
              background: "hsl(var(--background))",
            }}
          >
            <VideoTrack
              trackRef={focusedTrack}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                background: "hsl(var(--background))",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                borderRadius: 999,
                background: "rgba(15, 23, 42, 0.72)",
                color: "#f8fafc",
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {focusedTrack.participant.name || focusedTrack.participant.identity}
            </div>
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                display: "flex",
                gap: 8,
              }}
            >
              <button
                onClick={() => onActiveShareViewChange({ mode: "gallery" })}
                style={{
                  border: "none",
                  borderRadius: 999,
                  background: "rgba(15, 23, 42, 0.72)",
                  color: "#f8fafc",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Gallery
              </button>
              <button
                onClick={() => onActiveShareViewChange({ mode: "none" })}
                style={{
                  border: "none",
                  borderRadius: 999,
                  background: "rgba(15, 23, 42, 0.72)",
                  color: "#f8fafc",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    ) : null

  return (
    <>
      <RoomAudioRenderer />

      {showControls ? (
        <>
          <button
            onClick={handleToggleShare}
            disabled={isTogglingShare || !canScreenShare}
            style={{
              width: "100%",
              marginTop: 14,
              border: "none",
              borderRadius: 12,
              background: !canScreenShare
                ? "rgba(148, 163, 184, 0.28)"
                : isScreenShareEnabled
                  ? "#ef4444"
                  : "#ffffff",
              color: !canScreenShare
                ? "#cbd5e1"
                : isScreenShareEnabled
                  ? "#ffffff"
                  : "#0f172a",
              padding: "12px 14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: !canScreenShare ? "not-allowed" : "pointer",
            }}
          >
            {!canScreenShare
              ? "Screen Share Unsupported"
              : isTogglingShare
                ? "Updating..."
                : isScreenShareEnabled
                  ? "Stop Screen Share"
                  : "Share Screen to Room"}
          </button>

          <p
            style={{
              margin: "10px 0 0",
              color: "#94a3b8",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {canScreenShare
              ? "Published screen shares appear in the live viewer stack. Use 0 for gallery and 1-9 to focus a share."
              : "This browser can join the live session, but it cannot publish a screen share."}
          </p>

          {toggleError ? (
            <div
              style={{
                marginTop: 10,
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.16)",
                color: "#fecaca",
                padding: "10px 12px",
                fontSize: 12,
              }}
            >
              {toggleError}
            </div>
          ) : null}
        </>
      ) : null}

      {viewerOverlay && typeof document !== "undefined"
        ? createPortal(viewerOverlay, document.body)
        : null}
    </>
  )
}

export function LiveSessionPanel({
  activeShareView,
  inlineTrigger = false,
  isViewerEnabled = true,
  onActiveShareViewChange,
  onScreenSharesChange,
  roomId,
}: LiveSessionPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [session, setSession] = useState<LiveKitSession | null>(null)
  const autoJoinAttemptedRef = useRef(false)
  const liveSessionSupported = !isMobileBrowser()
  const inlinePopoverStyle = inlineTrigger
    ? {
        position: "absolute" as const,
        right: 0,
        bottom: "calc(100% + 10px)",
        zIndex: 60,
        width: 300,
        maxWidth: "min(300px, calc(100vw - 32px))",
        marginTop: 0,
      }
    : {
        position: "fixed" as const,
        top: 64,
        right: 16,
        zIndex: 51,
        width: 320,
        marginTop: 0,
      }

  const handleSessionEnded = () => {
    onScreenSharesChange([])
    onActiveShareViewChange({ mode: "none" })
    setIsPanelOpen(false)
    setSession(null)
  }

  useEffect(() => {
    return () => {
      onScreenSharesChange([])
      onActiveShareViewChange({ mode: "none" })
    }
  }, [onActiveShareViewChange, onScreenSharesChange])

  const handleJoin = useCallback(async () => {
    try {
      setIsJoining(true)
      setError(null)

      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomName: roomId,
        }),
      })

      const payload = (await response.json()) as TokenResponse

      if (!response.ok || !payload.token || !payload.serverUrl) {
        throw new Error(payload.error || "Unable to join the LiveKit room.")
      }

      const resolvedServerUrl = resolveBrowserLiveKitUrl(payload.serverUrl)

      setSession({
        serverUrl: resolvedServerUrl,
        token: payload.token,
      })
    } catch (joinError) {
      setError(
        joinError instanceof Error ? joinError.message : "Unable to join the LiveKit room.",
      )
    } finally {
      setIsJoining(false)
    }
  }, [roomId])

  useEffect(() => {
    if (!liveSessionSupported || session || isJoining || autoJoinAttemptedRef.current) {
      return
    }

    autoJoinAttemptedRef.current = true
    void handleJoin()
  }, [handleJoin, isJoining, liveSessionSupported, session])

  if (inlineTrigger) {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        {session ? (
          <LiveKitRoom
            connect
            onDisconnected={handleSessionEnded}
            onError={(nextError) => {
              setError(nextError.message)
            }}
            serverUrl={session.serverUrl}
            token={session.token}
            video={false}
            audio={false}
          >
            <ConnectedInlineScreenShareButton onError={setError} />
            <LiveSessionViewer
              activeShareView={activeShareView}
              isViewerEnabled={isViewerEnabled}
              onActiveShareViewChange={onActiveShareViewChange}
              onScreenSharesChange={onScreenSharesChange}
              showControls={false}
            />
          </LiveKitRoom>
        ) : (
          <DisconnectedInlineScreenShareButton
            error={error}
            isConnecting={isJoining}
            liveSessionSupported={liveSessionSupported}
            onConnect={handleJoin}
          />
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        position: "static",
      }}
    >
      <button
        onClick={() => setIsPanelOpen((current) => !current)}
        style={{
          position: "fixed" as const,
          top: 16,
          right: 16,
          zIndex: 52,
          border: "none",
          borderRadius: 12,
          background: session ? "#0f766e" : "rgba(15, 23, 42, 0.96)",
          color: "#f8fafc",
          padding: "10px 12px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.24)",
        }}
      >
        {session ? "Live Session Active" : "Live Session"}
      </button>

      {!session && isPanelOpen ? (
        <div
          style={{
            ...inlinePopoverStyle,
            borderRadius: 18,
            background: "rgba(15, 23, 42, 0.96)",
            color: "#e2e8f0",
            boxShadow: "0 18px 48px rgba(15, 23, 42, 0.24)",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Live share
          </div>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              lineHeight: 1.5,
              color: "#94a3b8",
            }}
          >
            This joins a LiveKit room matching the board room and lets participants publish screen shares into the live viewer.
          </p>
          <button
            onClick={handleJoin}
            disabled={isJoining || !liveSessionSupported}
            style={{
              width: "100%",
              marginTop: 14,
              border: "none",
              borderRadius: 12,
              background: liveSessionSupported
                ? "#ffffff"
                : "rgba(148, 163, 184, 0.28)",
              color: liveSessionSupported ? "#0f172a" : "#cbd5e1",
              padding: "12px 14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: liveSessionSupported ? "pointer" : "not-allowed",
            }}
          >
            {!liveSessionSupported
              ? "Live Session Desktop Only"
              : isJoining
                ? "Joining..."
                : "Join Live Session"}
          </button>
          {!liveSessionSupported ? (
            <div
              style={{
                marginTop: 10,
                borderRadius: 12,
                background: "rgba(148, 163, 184, 0.12)",
                color: "#cbd5e1",
                padding: "10px 12px",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              LiveKit joining and screen sharing are currently supported on desktop browsers only.
            </div>
          ) : null}
          {error ? (
            <div
              style={{
                marginTop: 10,
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.16)",
                color: "#fecaca",
                padding: "10px 12px",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      ) : null}

      {session ? (
        <LiveKitRoom
          connect
          onDisconnected={handleSessionEnded}
          onError={(nextError) => {
            setError(nextError.message)
          }}
          serverUrl={session.serverUrl}
          token={session.token}
          video={false}
          audio={false}
        >
          {isPanelOpen ? (
            <div
              style={{
                ...inlinePopoverStyle,
                borderRadius: 18,
                background: "rgba(15, 23, 42, 0.96)",
                color: "#e2e8f0",
                boxShadow: "0 18px 48px rgba(15, 23, 42, 0.24)",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700 }}>Live session connected</div>
              </div>

              <LiveSessionViewer
                activeShareView={activeShareView}
                isViewerEnabled={isViewerEnabled}
                onActiveShareViewChange={onActiveShareViewChange}
                onScreenSharesChange={onScreenSharesChange}
                showControls
              />
            </div>
          ) : (
            <LiveSessionViewer
              activeShareView={activeShareView}
              isViewerEnabled={isViewerEnabled}
              onActiveShareViewChange={onActiveShareViewChange}
              onScreenSharesChange={onScreenSharesChange}
              showControls={false}
            />
          )}
        </LiveKitRoom>
      ) : null}
    </div>
  )
}

function ConnectedInlineScreenShareButton({
  onError,
}: {
  onError: (message: string | null) => void
}) {
  const { isScreenShareEnabled, localParticipant } = useLocalParticipant()
  const [isTogglingShare, setIsTogglingShare] = useState(false)
  const canScreenShare = supportsScreenShare()

  const handleClick = async () => {
    if (!canScreenShare) {
      onError("This browser does not support screen sharing.")
      return
    }

    try {
      setIsTogglingShare(true)
      onError(null)
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
    } catch (nextError) {
      onError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to change screen sharing state.",
      )
    } finally {
      setIsTogglingShare(false)
    }
  }

  return (
    <Button
      className="h-9 w-full justify-start rounded-xl"
      onClick={() => {
        void handleClick()
      }}
      disabled={isTogglingShare || !canScreenShare}
      size="sm"
      type="button"
      variant={!canScreenShare ? "outline" : isScreenShareEnabled ? "destructive" : "secondary"}
    >
      {!canScreenShare
        ? "Screen Share Unsupported"
        : isTogglingShare
          ? "Updating..."
          : isScreenShareEnabled
            ? "Stop Sharing"
            : "Share Screen"}
    </Button>
  )
}

function DisconnectedInlineScreenShareButton({
  error,
  isConnecting,
  liveSessionSupported,
  onConnect,
}: {
  error: string | null
  isConnecting: boolean
  liveSessionSupported: boolean
  onConnect: () => Promise<void>
}) {
  const label = !liveSessionSupported
    ? "Screen Share Unsupported"
    : isConnecting
      ? "Connecting Live..."
      : error
        ? "Reconnect Live Share"
        : "Share Screen"

  return (
    <Button
      className="h-9 w-full justify-start rounded-xl"
      onClick={() => {
        void onConnect()
      }}
      disabled={!liveSessionSupported || isConnecting}
      size="sm"
      type="button"
      variant={!liveSessionSupported ? "outline" : "secondary"}
      title={error ?? undefined}
    >
      {label}
    </Button>
  )
}
