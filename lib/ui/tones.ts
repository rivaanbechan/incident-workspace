export type Tone = { accent: string; tint: string }

/**
 * Severity-based surface tone — use for investigation/case cards.
 */
export function getSeveritySurfaceTone(severity: string): Tone {
  switch (severity) {
    case "critical":
      return { accent: "#b91c1c", tint: "rgba(185, 28, 28, 0.14)" }
    case "high":
      return { accent: "#dc2626", tint: "rgba(220, 38, 38, 0.12)" }
    case "medium":
      return { accent: "#d97706", tint: "rgba(217, 119, 6, 0.14)" }
    case "low":
    default:
      return { accent: "#16a34a", tint: "rgba(22, 163, 74, 0.12)" }
  }
}
