import type { InvestigationSeverity, InvestigationStatus } from "@/lib/contracts/investigations"

export { formatTimestampCompact as formatTimestamp } from "@/lib/ui/formatters"

export function getSeverityBadgeVariant(
  severity: InvestigationSeverity,
): "critical" | "warning" | "success" {
  switch (severity) {
    case "critical":
      return "critical"
    case "high":
    case "medium":
      return "warning"
    case "low":
    default:
      return "success"
  }
}

export function getStatusBadgeVariant(
  status: InvestigationStatus,
): "muted" | "success" | "info" | "default" {
  switch (status) {
    case "closed":
      return "muted"
    case "mitigated":
      return "success"
    case "monitoring":
      return "info"
    case "open":
    default:
      return "default"
  }
}

export function getActionStatusBadgeVariant(
  status: string,
): "critical" | "success" | "info" | "muted" {
  switch (status) {
    case "blocked":
      return "critical"
    case "done":
      return "success"
    case "in_progress":
      return "info"
    case "open":
    default:
      return "muted"
  }
}

export function formatTimelineDay(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "long",
    weekday: "short",
  }).format(new Date(value))
}

export function getTimelineTypeLabel(type: string) {
  switch (type) {
    case "action": return "Action"
    case "decision": return "Decision"
    case "evidence": return "Evidence"
    case "finding": return "Finding"
    case "hypothesis": return "Hypothesis"
    case "mitigation": return "Mitigation"
    case "owner_change": return "Owner Change"
    case "comms": return "Comms"
    case "case_created": return "Case Created"
    case "metadata_updated": return "Case Updated"
    case "archived": return "Case Archived"
    case "restored": return "Case Restored"
    case "timeline-event": return "Timeline Event"
    default: return "Update"
  }
}

export function getTimelineTone(type: string): { accent: string; tint: string } {
  switch (type) {
    case "action": return { accent: "#b91c1c", tint: "rgba(185, 28, 28, 0.14)" }
    case "decision": return { accent: "#2563eb", tint: "rgba(37, 99, 235, 0.14)" }
    case "evidence": return { accent: "#d97706", tint: "rgba(217, 119, 6, 0.14)" }
    case "finding": return { accent: "#0f766e", tint: "rgba(15, 118, 110, 0.14)" }
    case "hypothesis": return { accent: "#7c3aed", tint: "rgba(124, 58, 237, 0.14)" }
    case "mitigation": return { accent: "#16a34a", tint: "rgba(22, 163, 74, 0.14)" }
    case "owner_change": return { accent: "#d97706", tint: "rgba(217, 119, 6, 0.14)" }
    case "comms": return { accent: "#0891b2", tint: "rgba(8, 145, 178, 0.14)" }
    case "case_created":
    case "metadata_updated":
    case "archived":
    case "restored": return { accent: "hsl(var(--muted-foreground))", tint: "hsl(var(--muted) / 0.55)" }
    case "timeline-event": return { accent: "#2563eb", tint: "rgba(37, 99, 235, 0.14)" }
    default: return { accent: "#2563eb", tint: "rgba(37, 99, 235, 0.14)" }
  }
}

export function getTimelineBadgeVariant(
  type: string,
): "critical" | "warning" | "info" | "default" | "success" | "muted" {
  switch (type) {
    case "action": return "critical"
    case "decision": return "critical"
    case "evidence": return "warning"
    case "finding": return "info"
    case "hypothesis": return "default"
    case "mitigation": return "success"
    case "owner_change": return "warning"
    case "comms": return "info"
    case "case_created":
    case "metadata_updated":
    case "archived":
    case "restored": return "muted"
    case "timeline-event": return "info"
    default: return "info"
  }
}

export function getSourceBadgeVariant(source: string): "default" | "success" | "muted" {
  switch (source) {
    case "artifact": return "default"
    case "record": return "success"
    default: return "muted"
  }
}

export function getSourceLabel(source: string) {
  switch (source) {
    case "artifact": return "Artifact"
    case "record": return "Promoted"
    default: return "Case"
  }
}
