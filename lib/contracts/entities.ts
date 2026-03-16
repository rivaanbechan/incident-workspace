// Universal entity references let modules talk about the same real-world thing
// without importing each other's internal data models.
export type EntityKind =
  | "account"
  | "alert"
  | "cloud-resource"
  | "domain"
  | "file"
  | "host"
  | "identity"
  | "ip"
  | "process"
  | "service"
  | "url"
  | "user"

// Keep this intentionally generic. Module-specific metadata belongs in the
// artifact payload or feature-local types, not in the shared contract itself.
export type EntityRef = {
  id: string
  kind: EntityKind
  label: string
  sourceModule?: string
}
