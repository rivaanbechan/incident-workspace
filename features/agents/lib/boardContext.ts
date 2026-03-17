import type { BoardEntity, BoardConnection } from "@/features/incident-workspace/lib/board/types"

const MAX_CONTEXT_CHARS = 8_000 // ~2 000 tokens at ~4 chars/token

/**
 * Serialises a single entity as structured text for the LLM context window.
 * `focused_entity` scope only — the only scope needed for MVP.
 */
export function serialiseBoardForScope(
  focusEntityId: string,
  entities: BoardEntity[],
  connections: BoardConnection[],
): string {
  const entity = entities.find((e) => e.id === focusEntityId)

  if (!entity) {
    return `[No entity found with id "${focusEntityId}"]`
  }

  const lines: string[] = []

  lines.push(`=== FOCUSED ENTITY ===`)
  lines.push(`id: ${entity.id}`)
  lines.push(`type: ${entity.type}`)

  if ("title" in entity && typeof entity.title === "string") {
    lines.push(`title: ${entity.title}`)
  }

  if ("body" in entity && typeof entity.body === "string" && entity.body.trim()) {
    lines.push(`body: ${entity.body.trim()}`)
  }

  if ("label" in entity && typeof entity.label === "string") {
    lines.push(`label: ${entity.label}`)
  }

  if ("severity" in entity) {
    lines.push(`severity: ${entity.severity}`)
  }

  if ("status" in entity && entity.type === "incidentCard") {
    lines.push(`status: ${entity.status}`)
  }

  if ("mapKind" in entity && entity.mapKind) {
    lines.push(`category: ${entity.mapKind}`)
  }

  // Include connected entities as context
  const relatedConnections = connections.filter(
    (c) => c.sourceEntityId === focusEntityId || c.targetEntityId === focusEntityId,
  )

  if (relatedConnections.length > 0) {
    lines.push(``)
    lines.push(`=== CONNECTIONS ===`)

    for (const conn of relatedConnections) {
      const otherId =
        conn.sourceEntityId === focusEntityId ? conn.targetEntityId : conn.sourceEntityId
      const otherEntity = entities.find((e) => e.id === otherId)
      const otherLabel =
        otherEntity && "title" in otherEntity ? otherEntity.title : otherId

      const direction = conn.sourceEntityId === focusEntityId ? "->" : "<-"
      lines.push(`${direction} [${conn.type}] ${otherLabel}`)
    }
  }

  const result = lines.join("\n")

  return result.length > MAX_CONTEXT_CHARS
    ? result.slice(0, MAX_CONTEXT_CHARS) + "\n[...truncated]"
    : result
}
