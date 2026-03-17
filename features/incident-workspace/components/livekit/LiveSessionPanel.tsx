"use client"

import { Button } from "@/components/ui/button"
import type { PresenceUser } from "@/features/incident-workspace/lib/board/types"
import { LiveKitRoom, useLocalParticipant } from "@livekit/components-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  type LiveKitSession,
  type TokenResponse,
  isMobileBrowser,
  resolveBrowserLiveKitUrl,
  supportsScreenShare,
} from "./liveSessionUtils"
import { LiveSessionViewer } from "./LiveSessionViewer"

// Re-export shared types for backward compatibility
export type { ActiveScreenShare, LiveShareView } from "./liveSessionUtils"

type LiveSessionPanelProps = {
  activeShareView: import("./liveSessionUtils").LiveShareView
  inlineTrigger?: boolean
  isViewerEnabled?: boolean
  onActiveShareViewChange: (view: import("./liveSessionUtils").LiveShareView) => void
  onScreenSharesChange: (screenShares: import("./liveSessionUtils").ActiveScreenShare[]) => void
  onSpeakersChange?: (participantIds: string[]) => void
  roomId: string
  user: PresenceUser
}

function ConnectedInlineScreenShareButton({
  onError,
}: {
  onError: (message: string | null) => void
}) {
  const { isMicrophoneEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant()
  const [isTogglingShare, setIsTogglingShare] = useState(false)
  const [isTogglingMic, setIsTogglingMic] = useState(false)
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

  const handleMicClick = async () => {
    try {
      setIsTogglingMic(true)
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch (nextError) {
      onError(
        nextError instanceof Error ? nextError.message : "Unable to toggle microphone.",
      )
    } finally {
      setIsTogglingMic(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
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
      <Button
        className="h-9 w-full justify-start rounded-xl"
        onClick={() => {
          void handleMicClick()
        }}
        disabled={isTogglingMic}
        size="sm"
        type="button"
        variant={isMicrophoneEnabled ? "destructive" : "secondary"}
      >
        {isTogglingMic ? "Updating..." : isMicrophoneEnabled ? "Mute Mic" : "Unmute Mic"}
      </Button>
    </div>
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

export function LiveSessionPanel({
  activeShareView,
  inlineTrigger = false,
  isViewerEnabled = true,
  onActiveShareViewChange,
  onScreenSharesChange,
  onSpeakersChange,
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
            audio={true}
          >
            <ConnectedInlineScreenShareButton onError={setError} />
            <LiveSessionViewer
              activeShareView={activeShareView}
              isViewerEnabled={isViewerEnabled}
              onActiveShareViewChange={onActiveShareViewChange}
              onScreenSharesChange={onScreenSharesChange}
              onSpeakersChange={onSpeakersChange}
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
                onSpeakersChange={onSpeakersChange}
                showControls
              />
            </div>
          ) : (
            <LiveSessionViewer
              activeShareView={activeShareView}
              isViewerEnabled={isViewerEnabled}
              onActiveShareViewChange={onActiveShareViewChange}
              onScreenSharesChange={onScreenSharesChange}
              onSpeakersChange={onSpeakersChange}
              showControls={false}
            />
          )}
        </LiveKitRoom>
      ) : null}
    </div>
  )
}
