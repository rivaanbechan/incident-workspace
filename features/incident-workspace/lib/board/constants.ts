import type { IncidentActionStatus } from "./types"

export const ACTION_STATUS_LABELS: Record<IncidentActionStatus, string> = {
  blocked: "Blocked",
  done: "Done",
  in_progress: "In Progress",
  open: "Open",
}

export const ACTION_STATUS_ORDER: IncidentActionStatus[] = [
  "open",
  "in_progress",
  "blocked",
  "done",
]
