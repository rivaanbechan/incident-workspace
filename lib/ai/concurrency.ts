/**
 * Per-datasource concurrency counter.
 * Single source of truth for active LLM invocations across all rooms and users.
 */

const activeCount = new Map<string, number>()

/**
 * Increment the active count for a datasource.
 * Returns true if the new count is within the allowed max, false otherwise.
 * When false is returned the counter is NOT incremented — no slot was acquired.
 */
export function acquire(datasourceId: string, max: number): boolean {
  const current = activeCount.get(datasourceId) ?? 0

  if (current >= max) {
    return false
  }

  activeCount.set(datasourceId, current + 1)
  return true
}

/**
 * Decrement the active count for a datasource.
 * Must be called in a finally block to guarantee release.
 */
export function release(datasourceId: string): void {
  const current = activeCount.get(datasourceId) ?? 0
  const next = Math.max(0, current - 1)

  if (next === 0) {
    activeCount.delete(datasourceId)
  } else {
    activeCount.set(datasourceId, next)
  }
}

/** Returns current active count — useful for testing. */
export function getActiveCount(datasourceId: string): number {
  return activeCount.get(datasourceId) ?? 0
}
