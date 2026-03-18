"use client"

import {
  RoomAudioRenderer,
  useLocalParticipant,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react"
import type { TrackReference } from "@livekit/components-react"
import { Track } from "livekit-client"
import { createPortal } from "react-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { LiveShareViewerOverlay } from "./LiveShareViewerOverlay"
import type { ActiveScreenShare, LiveShareView } from "./liveSessionUtils"
import { supportsScreenShare } from "./liveSessionUtils"

export function LiveSessionViewer({
  activeShareView,
  isViewerEnabled = true,
  onActiveShareViewChange,
  onScreenSharesChange,
  onSpeakersChange,
  showControls = true,
}: {
  activeShareView: LiveShareView
  isViewerEnabled?: boolean
  onActiveShareViewChange: (view: LiveShareView) => void
  onScreenSharesChange: (screenShares: ActiveScreenShare[]) => void
  onSpeakersChange?: (participantIds: string[]) => void
  showControls?: boolean
}) {
  const { isMicrophoneEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant()
  const speakingParticipants = useSpeakingParticipants()
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
    onSpeakersChange?.(speakingParticipants.map((p) => p.identity))
  }, [speakingParticipants, onSpeakersChange])

  const handleToggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch {
      // ignore mic toggle errors
    }
  }

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
      <LiveShareViewerOverlay
        activeScreenShares={activeScreenShares}
        activeShareView={activeShareView}
        focusedTrack={focusedTrack ?? null}
        onActiveShareViewChange={onActiveShareViewChange}
        screenTracks={screenTracks}
      />
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

          <button
            onClick={() => {
              void handleToggleMic()
            }}
            style={{
              width: "100%",
              marginTop: 10,
              border: "none",
              borderRadius: 12,
              background: isMicrophoneEnabled ? "#ef4444" : "#ffffff",
              color: isMicrophoneEnabled ? "#ffffff" : "#0f172a",
              padding: "12px 14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isMicrophoneEnabled ? "Mute Mic" : "Unmute Mic"}
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
              ? "Voice is active — use the mic button to mute. Published screen shares appear in the live viewer stack. Use 0 for gallery and 1-9 to focus a share."
              : "This browser can join the live session with voice, but it cannot publish a screen share."}
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
