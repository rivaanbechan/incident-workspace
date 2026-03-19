export type PermissionDomain =
  | "agents"
  | "admin"
  | "board"
  | "cases"
  | "integrations"
  | "investigations"
  | "oracle"

export type PermissionDefinition = {
  id: string
  label: string
  description: string
  domain: PermissionDomain
  axis: "org" | "case"
  defaultRoles: string[]
  systemManaged: boolean
}

const ALL_ORG_ROLES = ["org_admin", "investigator", "integration_admin", "viewer"]
const ALL_CASE_ROLES = ["case_owner", "case_editor", "case_viewer"]

export const PERMISSION_REGISTRY: Record<string, PermissionDefinition> = {
  // Cases — case-level defaults
  "cases:view": {
    id: "cases:view",
    label: "View cases",
    description: "Access and view case details",
    domain: "cases",
    axis: "case",
    defaultRoles: ALL_CASE_ROLES,
    systemManaged: false,
  },
  "cases:edit": {
    id: "cases:edit",
    label: "Edit case details",
    description: "Modify case title, status, and metadata",
    domain: "cases",
    axis: "case",
    defaultRoles: ["case_owner", "case_editor"],
    systemManaged: false,
  },
  "cases:manage_members": {
    id: "cases:manage_members",
    label: "Manage case members",
    description: "Add, remove, and change roles of case members",
    domain: "cases",
    axis: "case",
    defaultRoles: ["case_owner"],
    systemManaged: false,
  },
  "cases:close": {
    id: "cases:close",
    label: "Close / archive cases",
    description: "Mark a case as closed or archive it",
    domain: "cases",
    axis: "case",
    defaultRoles: ["case_owner"],
    systemManaged: false,
  },

  // Board — case-level defaults
  "board:view": {
    id: "board:view",
    label: "View the incident board",
    description: "Access the collaborative incident board",
    domain: "board",
    axis: "case",
    defaultRoles: ALL_CASE_ROLES,
    systemManaged: false,
  },
  "board:edit": {
    id: "board:edit",
    label: "Edit entities on the board",
    description: "Create, move, and modify board entities",
    domain: "board",
    axis: "case",
    defaultRoles: ["case_owner", "case_editor"],
    systemManaged: false,
  },
  "board:promote_to_record": {
    id: "board:promote_to_record",
    label: "Promote board entities to case records",
    description: "Save board notes and entities as durable case records",
    domain: "board",
    axis: "case",
    defaultRoles: ["case_owner", "case_editor"],
    systemManaged: false,
  },
  "board:promote_to_oracle": {
    id: "board:promote_to_oracle",
    label: "Promote board entities to The Oracle",
    description: "Contribute board content to the organisation knowledge base",
    domain: "board",
    axis: "case",
    defaultRoles: ["case_owner", "case_editor"],
    systemManaged: false,
  },

  // Agents — mixed
  "agents:view": {
    id: "agents:view",
    label: "View configured agents",
    description: "See which agents are available in the organisation",
    domain: "agents",
    axis: "org",
    defaultRoles: ALL_ORG_ROLES,
    systemManaged: false,
  },
  "agents:invoke": {
    id: "agents:invoke",
    label: "Invoke agents on the board",
    description: "Run agents against board content during an incident",
    domain: "agents",
    axis: "case",
    defaultRoles: ["case_owner", "case_editor"],
    systemManaged: false,
  },
  "agents:manage": {
    id: "agents:manage",
    label: "Create / edit / delete agents",
    description: "Configure agent integrations for the organisation",
    domain: "agents",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: false,
  },

  // Oracle — org-level
  "oracle:view": {
    id: "oracle:view",
    label: "Browse Oracle entries",
    description: "Search and read the organisation knowledge base",
    domain: "oracle",
    axis: "org",
    defaultRoles: ALL_ORG_ROLES,
    systemManaged: false,
  },
  "oracle:contribute": {
    id: "oracle:contribute",
    label: "Contribute to The Oracle",
    description: "Upload markdown and promote content to the knowledge base",
    domain: "oracle",
    axis: "org",
    defaultRoles: ["org_admin", "investigator"],
    systemManaged: false,
  },
  "oracle:delete": {
    id: "oracle:delete",
    label: "Delete Oracle entries",
    description: "Remove entries from the organisation knowledge base",
    domain: "oracle",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: false,
  },
  "oracle:reembed": {
    id: "oracle:reembed",
    label: "Re-embed individual entries",
    description: "Trigger re-embedding for a single Oracle entry",
    domain: "oracle",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: false,
  },
  "oracle:reembed_all": {
    id: "oracle:reembed_all",
    label: "Bulk re-embed all entries",
    description: "Trigger bulk re-embedding for all Oracle entries",
    domain: "oracle",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: false,
  },

  // Integrations — org-level
  "integrations:view": {
    id: "integrations:view",
    label: "View installed datasources",
    description: "See which datasource integrations are configured",
    domain: "integrations",
    axis: "org",
    defaultRoles: ALL_ORG_ROLES,
    systemManaged: false,
  },
  "integrations:manage": {
    id: "integrations:manage",
    label: "Install / configure / remove datasources",
    description: "Manage datasource integrations for the organisation",
    domain: "integrations",
    axis: "org",
    defaultRoles: ["org_admin", "integration_admin"],
    systemManaged: false,
  },

  // Investigations — org-level
  "investigations:view": {
    id: "investigations:view",
    label: "View investigations",
    description: "List and access investigations",
    domain: "investigations",
    axis: "org",
    defaultRoles: ALL_ORG_ROLES,
    systemManaged: false,
  },
  "investigations:manage": {
    id: "investigations:manage",
    label: "Create / edit / archive investigations",
    description: "Create and manage the lifecycle of investigations",
    domain: "investigations",
    axis: "org",
    defaultRoles: ["org_admin", "investigator"],
    systemManaged: false,
  },

  // Admin — org-level
  "admin:view": {
    id: "admin:view",
    label: "Access the admin area",
    description: "View the administration pages",
    domain: "admin",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: true,
  },
  "admin:manage_roles": {
    id: "admin:manage_roles",
    label: "Configure role permissions",
    description: "View and modify role permissions in the RBAC matrix",
    domain: "admin",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: false,
  },
  "admin:manage_members": {
    id: "admin:manage_members",
    label: "Manage org members",
    description: "Create users and update organisation membership roles",
    domain: "admin",
    axis: "org",
    defaultRoles: ["org_admin"],
    systemManaged: true,
  },
}

export function getPermissionsByDomain(): Record<PermissionDomain, PermissionDefinition[]> {
  const grouped: Record<PermissionDomain, PermissionDefinition[]> = {
    agents: [],
    admin: [],
    board: [],
    cases: [],
    integrations: [],
    investigations: [],
    oracle: [],
  }

  for (const def of Object.values(PERMISSION_REGISTRY)) {
    grouped[def.domain].push(def)
  }

  return grouped
}

export function getDefaultRoles(permissionId: string): string[] {
  return PERMISSION_REGISTRY[permissionId]?.defaultRoles ?? []
}
