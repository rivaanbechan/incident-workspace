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
