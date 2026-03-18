import { mockedSigmaAdapter } from "@/features/collab-hunt-graph/lib/mockAdapter"
import type { HuntGraphAdapter } from "@/features/collab-hunt-graph/lib/types"

// Registry of all available graph adapters.
// Add real datasource adapters here alongside the mock.
const adapters: HuntGraphAdapter[] = [mockedSigmaAdapter]

export function getHuntGraphAdapters(): HuntGraphAdapter[] {
  return adapters
}

export function getHuntGraphAdapter(adapterId: string | null): HuntGraphAdapter | null {
  if (!adapterId) return null
  return adapters.find((a) => a.id === adapterId) ?? null
}
