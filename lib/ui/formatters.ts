/**
 * formatTimestamp — medium date + short time, locale-aware.
 * Used wherever a human-readable timestamp is needed across features.
 */
export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

/**
 * formatTimestampCompact — no year, 24 h-style.
 * Used in dense layouts where vertical space is limited (case detail stats row, etc.)
 */
export function formatTimestampCompact(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value))
}
