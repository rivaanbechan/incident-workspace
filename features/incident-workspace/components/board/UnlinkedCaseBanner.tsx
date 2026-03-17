"use client"

import Link from "next/link"
import { useBoardUI } from "@/features/incident-workspace/components/board/BoardUIContext"

/**
 * UnlinkedCaseBanner — amber top banner shown when the room has no linked case.
 * Mounted inside BoardCanvas above the canvas stage.
 */
export function UnlinkedCaseBanner() {
  const { linkedCaseId } = useBoardUI()

  if (linkedCaseId) {
    return null
  }

  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: "1px solid rgba(251, 191, 36, 0.28)",
        background:
          "linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(254, 243, 199, 0.88))",
        color: "#78350f",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#92400e",
          }}
        >
          Temporary Workspace
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            lineHeight: 1.55,
            fontWeight: 600,
          }}
        >
          This room is not linked to a case yet. Board state, timeline updates,
          findings, datasource saves, and hunt views stay temporary and will not
          be durably persisted.
        </div>
      </div>
      <Link
        href="/cases"
        style={{
          flexShrink: 0,
          alignSelf: "center",
          textDecoration: "none",
          borderRadius: 12,
          background: "#92400e",
          color: "#fffbeb",
          padding: "10px 12px",
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        Create Case
      </Link>
    </div>
  )
}
