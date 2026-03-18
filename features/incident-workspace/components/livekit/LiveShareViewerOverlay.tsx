"use client"

import { VideoTrack } from "@livekit/components-react"
import type { TrackReference } from "@livekit/components-react"
import type { ActiveScreenShare, LiveShareView } from "./liveSessionUtils"

type Props = {
  activeScreenShares: ActiveScreenShare[]
  activeShareView: LiveShareView
  focusedTrack: TrackReference | null
  onActiveShareViewChange: (view: LiveShareView) => void
  screenTracks: TrackReference[]
}

export function LiveShareViewerOverlay({
  activeScreenShares,
  activeShareView,
  focusedTrack,
  onActiveShareViewChange,
  screenTracks,
}: Props) {
  return (
    <div
      onClick={() => onActiveShareViewChange({ mode: "none" })}
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(2, 6, 23, 0.82)",
        display: "grid", placeItems: "center", padding: 24,
      }}
    >
      {activeShareView.mode === "gallery" ? (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: "min(94vw, 1600px)", maxHeight: "92vh", borderRadius: 24, overflow: "hidden",
            background: "rgba(15, 23, 42, 0.94)", boxShadow: "0 24px 80px rgba(15, 23, 42, 0.45)",
            padding: 18, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ color: "hsl(var(--foreground))", fontSize: 18, fontWeight: 800 }}>Gallery mode</div>
            <button
              onClick={() => onActiveShareViewChange({ mode: "none" })}
              style={{
                border: "none", borderRadius: 999, background: "hsl(var(--muted) / 0.5)",
                color: "hsl(var(--foreground))", padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
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
              if (!trackId) return null
              return (
                <button
                  key={trackId}
                  onClick={() => onActiveShareViewChange({ mode: "focused", openedFromGallery: true, trackId })}
                  style={{
                    border: "none", borderRadius: 18, background: "hsl(var(--background))",
                    overflow: "hidden", padding: 0, cursor: "pointer", textAlign: "left",
                    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.24)",
                    width: activeScreenShares.length === 1 ? "min(100%, 1120px)" : "100%",
                  }}
                >
                  <div style={{ aspectRatio: "16 / 9", background: "#020617" }}>
                    <VideoTrack trackRef={trackRef} style={{ width: "100%", height: "100%", objectFit: "contain", background: "hsl(var(--background))" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 12, fontWeight: 700 }}>
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
            maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 32px)",
            aspectRatio: "16 / 9", borderRadius: 20, overflow: "hidden",
            boxShadow: "0 24px 80px rgba(15, 23, 42, 0.45)", background: "hsl(var(--background))",
          }}
        >
          <VideoTrack trackRef={focusedTrack} style={{ width: "100%", height: "100%", objectFit: "contain", background: "hsl(var(--background))" }} />
          <div style={{ position: "absolute", top: 16, left: 16, borderRadius: 999, background: "rgba(15, 23, 42, 0.72)", color: "#f8fafc", padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>
            {focusedTrack.participant.name || focusedTrack.participant.identity}
          </div>
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
            <button
              onClick={() => onActiveShareViewChange({ mode: "gallery" })}
              style={{ border: "none", borderRadius: 999, background: "rgba(15, 23, 42, 0.72)", color: "#f8fafc", padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Gallery
            </button>
            <button
              onClick={() => onActiveShareViewChange({ mode: "none" })}
              style={{ border: "none", borderRadius: 999, background: "rgba(15, 23, 42, 0.72)", color: "#f8fafc", padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
