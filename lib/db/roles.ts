import { PERMISSION_REGISTRY } from "@/lib/auth/permissionRegistry"
import { createSchemaGuard, dbQuery, generateId, getDbPool } from "@/lib/db/index"

const DEFAULT_ORG_ID = "org-default"

export type AppRole = {
  id: string
  orgId: string
  name: string
  label: string
  isSystem: boolean
  createdAt: string
}

type OrgRoleRow = {
  id: string
  org_id: string
  name: string
  label: string
  is_system: boolean
  created_at: string
}

type RolePermissionRow = {
  id: string
  org_id: string
  role_name: string
  permission_id: string
  granted: boolean
  updated_by: string
  updated_at: string
}

export type ResolvedRolePermissions = Record<
  string,
  { granted: boolean; source: "db" | "default" }
>

const SYSTEM_ROLES: { name: string; label: string }[] = [
  { name: "org_admin", label: "Administrator" },
  { name: "investigator", label: "Investigator" },
  { name: "integration_admin", label: "Integration Admin" },
  { name: "viewer", label: "Viewer" },
  { name: "case_owner", label: "Case Owner" },
  { name: "case_editor", label: "Case Editor" },
  { name: "case_viewer", label: "Case Viewer" },
]

const ensureRolesSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS org_roles (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      label TEXT NOT NULL,
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (org_id, name)
    )
  `)

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS org_role_permissions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      granted BOOLEAN NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (org_id, role_name, permission_id)
    )
  `)

  for (const role of SYSTEM_ROLES) {
    await dbQuery(
      `
        INSERT INTO org_roles (id, org_id, name, label, is_system, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
        ON CONFLICT (org_id, name) DO NOTHING
      `,
      [generateId("role"), DEFAULT_ORG_ID, role.name, role.label],
    )
  }
})

function mapRole(row: OrgRoleRow): AppRole {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    label: row.label,
    isSystem: row.is_system,
    createdAt: row.created_at,
  }
}

export async function getRolesForOrg(orgId: string = DEFAULT_ORG_ID): Promise<AppRole[]> {
  if (!getDbPool()) {
    return []
  }

  await ensureRolesSchema()

  const result = await dbQuery<OrgRoleRow>(
    `
      SELECT id, org_id, name, label, is_system, created_at::text
      FROM org_roles
      WHERE org_id = $1
      ORDER BY
        CASE name
          WHEN 'org_admin' THEN 0
          WHEN 'investigator' THEN 1
          WHEN 'integration_admin' THEN 2
          WHEN 'viewer' THEN 3
          WHEN 'case_owner' THEN 4
          WHEN 'case_editor' THEN 5
          WHEN 'case_viewer' THEN 6
          ELSE 10
        END,
        label ASC
    `,
    [orgId],
  )

  return result.rows.map(mapRole)
}

export async function getPermissionsForRole(
  orgId: string,
  roleName: string,
): Promise<ResolvedRolePermissions> {
  if (!getDbPool()) {
    return {}
  }

  await ensureRolesSchema()

  const result = await dbQuery<RolePermissionRow>(
    `
      SELECT id, org_id, role_name, permission_id, granted, updated_by, updated_at::text
      FROM org_role_permissions
      WHERE org_id = $1 AND role_name = $2
    `,
    [orgId, roleName],
  )

  const dbOverrides = new Map<string, boolean>()

  for (const row of result.rows) {
    dbOverrides.set(row.permission_id, row.granted)
  }

  const resolved: ResolvedRolePermissions = {}

  for (const def of Object.values(PERMISSION_REGISTRY)) {
    const dbRow = dbOverrides.get(def.id)

    if (dbRow !== undefined) {
      resolved[def.id] = { granted: dbRow, source: "db" }
    } else {
      resolved[def.id] = {
        granted: def.defaultRoles.includes(roleName),
        source: "default",
      }
    }
  }

  return resolved
}

export async function setPermission(
  orgId: string,
  roleName: string,
  permissionId: string,
  granted: boolean,
  updatedBy: string,
): Promise<void> {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureRolesSchema()

  await dbQuery(
    `
      INSERT INTO org_role_permissions (id, org_id, role_name, permission_id, granted, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (org_id, role_name, permission_id) DO UPDATE SET
        granted = EXCLUDED.granted,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `,
    [generateId("rp"), orgId, roleName, permissionId, granted, updatedBy],
  )
}

export async function resetPermission(
  orgId: string,
  roleName: string,
  permissionId: string,
): Promise<void> {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureRolesSchema()

  await dbQuery(
    `
      DELETE FROM org_role_permissions
      WHERE org_id = $1 AND role_name = $2 AND permission_id = $3
    `,
    [orgId, roleName, permissionId],
  )
}

export async function createRole(
  orgId: string,
  name: string,
  label: string,
): Promise<AppRole> {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureRolesSchema()

  const id = generateId("role")

  const result = await dbQuery<OrgRoleRow>(
    `
      INSERT INTO org_roles (id, org_id, name, label, is_system, created_at)
      VALUES ($1, $2, $3, $4, false, NOW())
      RETURNING id, org_id, name, label, is_system, created_at::text
    `,
    [id, orgId, name.trim(), label.trim()],
  )

  return mapRole(result.rows[0])
}

export async function deleteRole(orgId: string, roleId: string): Promise<void> {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureRolesSchema()

  const result = await dbQuery<{ is_system: boolean }>(
    `SELECT is_system FROM org_roles WHERE id = $1 AND org_id = $2`,
    [roleId, orgId],
  )

  if (!result.rows[0]) {
    throw new Error("Role not found.")
  }

  if (result.rows[0].is_system) {
    throw new Error("System roles cannot be deleted.")
  }

  await dbQuery(
    `DELETE FROM org_roles WHERE id = $1 AND org_id = $2`,
    [roleId, orgId],
  )
}
