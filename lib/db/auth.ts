import { compare, hash } from "bcryptjs"

import type { AuthenticatedUser, CaseRole, OrgRole } from "@/lib/auth/permissions"
import { createSchemaGuard, dbQuery, generateId, getDbPool } from "@/lib/db/index"

type UserRow = {
  active: boolean
  color: string
  created_at: string
  email: string
  id: string
  name: string
  password_hash: string
  updated_at: string
}

type UserRoleRow = UserRow & {
  organization_id: string
  role: OrgRole
}

type CaseMembershipRow = {
  case_id: string
  role: CaseRole
  room_id: string | null
  user_id: string
}

type OrganizationUserRow = {
  color: string
  created_at: string
  email: string
  id: string
  name: string
  org_role: OrgRole
}

type CaseMemberRow = {
  color: string
  created_at: string
  email: string
  id: string
  name: string
  role: CaseRole
}

const DEFAULT_ORG_ID = "org-default"
const DEFAULT_ORG_SLUG = "default"
const PASSWORD_ROUNDS = 12
const USER_COLORS = ["#ef4444", "#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6"]

function colorForEmail(email: string) {
  let hashValue = 0

  for (const char of email) {
    hashValue = (hashValue * 31 + char.charCodeAt(0)) % USER_COLORS.length
  }

  return USER_COLORS[Math.abs(hashValue) % USER_COLORS.length]
}

function mapUser(row: UserRow) {
  return {
    active: row.active,
    color: row.color,
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    name: row.name,
    passwordHash: row.password_hash,
    updatedAt: row.updated_at,
  }
}

function mapAuthenticatedUser(row: UserRoleRow): AuthenticatedUser {
  return {
    color: row.color,
    email: row.email,
    id: row.id,
    name: row.name,
    orgId: row.organization_id,
    orgRole: row.role,
  }
}

async function seedBootstrapAdmin() {
  const email = process.env.AUTH_BOOTSTRAP_EMAIL?.trim().toLowerCase()
  const password = process.env.AUTH_BOOTSTRAP_PASSWORD?.trim()
  const name = process.env.AUTH_BOOTSTRAP_NAME?.trim() || "Bootstrap Admin"

  if (!email || !password) {
    return
  }

  const existing = await dbQuery<{ id: string }>(
    `
      SELECT id
      FROM app_users
      WHERE email = $1
      LIMIT 1
    `,
    [email],
  )

  if (existing.rows[0]?.id) {
    return
  }

  const passwordHash = await hash(password, PASSWORD_ROUNDS)
  const userId = generateId("user")

  await dbQuery(
    `
      INSERT INTO app_users (
        id,
        email,
        name,
        color,
        password_hash,
        active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
    `,
    [userId, email, name, colorForEmail(email), passwordHash],
  )

  await dbQuery(
    `
      INSERT INTO organization_memberships (
        organization_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'org_admin', NOW(), NOW())
      ON CONFLICT (organization_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        updated_at = NOW()
    `,
    [DEFAULT_ORG_ID, userId],
  )
}

const runAuthSchemaSetup = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS organization_memberships (
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (organization_id, user_id)
    )
  `)

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS case_memberships (
      case_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (case_id, user_id)
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS case_memberships_user_id_idx
    ON case_memberships (user_id, case_id)
  `)

  await dbQuery(
    `
      INSERT INTO organizations (id, slug, title, created_at, updated_at)
      VALUES ($1, $2, 'Default Organization', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
    [DEFAULT_ORG_ID, DEFAULT_ORG_SLUG],
  )

  await seedBootstrapAdmin()
})

export async function ensureAuthSchema() {
  if (!getDbPool()) {
    return
  }

  await runAuthSchemaSetup()
}

export async function getUserByEmail(email: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureAuthSchema()

  const result = await dbQuery<UserRow>(
    `
      SELECT
        id,
        email,
        name,
        color,
        password_hash,
        active,
        created_at::text,
        updated_at::text
      FROM app_users
      WHERE email = $1
      LIMIT 1
    `,
    [email.trim().toLowerCase()],
  )

  const row = result.rows[0]
  return row ? mapUser(row) : null
}

export async function verifyUserPassword(email: string, password: string) {
  const user = await getUserByEmail(email)

  if (!user || !user.active) {
    return null
  }

  const isValid = await compare(password, user.passwordHash)
  return isValid ? user : null
}

export async function getAuthenticatedUserById(userId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureAuthSchema()

  const result = await dbQuery<UserRoleRow>(
    `
      SELECT
        u.id,
        u.email,
        u.name,
        u.color,
        u.password_hash,
        u.active,
        u.created_at::text,
        u.updated_at::text,
        om.organization_id,
        om.role
      FROM app_users u
      INNER JOIN organization_memberships om
        ON om.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  )

  const row = result.rows[0]
  return row && row.active ? mapAuthenticatedUser(row) : null
}

export async function listOrganizationUsers() {
  if (!getDbPool()) {
    return []
  }

  await ensureAuthSchema()

  const result = await dbQuery<OrganizationUserRow>(
    `
      SELECT
        u.id,
        u.email,
        u.name,
        u.color,
        u.created_at::text,
        om.role AS org_role
      FROM app_users u
      INNER JOIN organization_memberships om
        ON om.user_id = u.id
      WHERE om.organization_id = $1
      ORDER BY LOWER(u.name) ASC, LOWER(u.email) ASC
    `,
    [DEFAULT_ORG_ID],
  )

  return result.rows.map((row) => ({
    color: row.color,
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    name: row.name,
    orgRole: row.org_role,
  }))
}

export async function createOrganizationUser(input: {
  email: string
  name: string
  orgRole: OrgRole
  password: string
}) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureAuthSchema()

  const existing = await getUserByEmail(input.email)

  if (existing) {
    throw new Error("A user with this email already exists.")
  }

  const userId = generateId("user")
  const passwordHash = await hash(input.password, PASSWORD_ROUNDS)
  const email = input.email.trim().toLowerCase()

  await dbQuery(
    `
      INSERT INTO app_users (
        id,
        email,
        name,
        color,
        password_hash,
        active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
    `,
    [userId, email, input.name.trim(), colorForEmail(email), passwordHash],
  )

  await dbQuery(
    `
      INSERT INTO organization_memberships (
        organization_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())
    `,
    [DEFAULT_ORG_ID, userId, input.orgRole],
  )
}

export async function updateOrganizationMembershipRole(userId: string, orgRole: OrgRole) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureAuthSchema()

  await dbQuery(
    `
      UPDATE organization_memberships
      SET role = $3, updated_at = NOW()
      WHERE organization_id = $1 AND user_id = $2
    `,
    [DEFAULT_ORG_ID, userId, orgRole],
  )
}

export async function listCaseMemberships(caseId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureAuthSchema()

  const result = await dbQuery<CaseMemberRow>(
    `
      SELECT
        u.id,
        u.email,
        u.name,
        u.color,
        u.created_at::text,
        cm.role
      FROM case_memberships cm
      INNER JOIN app_users u
        ON u.id = cm.user_id
      WHERE cm.case_id = $1
      ORDER BY
        CASE cm.role
          WHEN 'case_owner' THEN 0
          WHEN 'case_editor' THEN 1
          ELSE 2
        END,
        LOWER(u.name) ASC
    `,
    [caseId],
  )

  return result.rows.map((row) => ({
    color: row.color,
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    name: row.name,
    role: row.role,
  }))
}

export async function getCaseMembership(caseId: string, userId: string) {
  if (!getDbPool()) {
    return null
  }

  await ensureAuthSchema()

  const result = await dbQuery<CaseMembershipRow>(
    `
      SELECT
        cm.case_id,
        cm.user_id,
        cm.role,
        investigations.room_id
      FROM case_memberships cm
      LEFT JOIN investigations
        ON investigations.id = cm.case_id
      WHERE cm.case_id = $1 AND cm.user_id = $2
      LIMIT 1
    `,
    [caseId, userId],
  )

  return result.rows[0] ?? null
}

export async function listCaseIdsForUser(userId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureAuthSchema()

  const result = await dbQuery<{ case_id: string }>(
    `
      SELECT case_id
      FROM case_memberships
      WHERE user_id = $1
    `,
    [userId],
  )

  return result.rows.map((row) => row.case_id)
}

export async function upsertCaseMembership(input: {
  caseId: string
  role: CaseRole
  userId: string
}) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureAuthSchema()

  await dbQuery(
    `
      INSERT INTO case_memberships (
        case_id,
        user_id,
        role,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (case_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        updated_at = NOW()
    `,
    [input.caseId, input.userId, input.role],
  )
}

export async function deleteCaseMembership(caseId: string, userId: string) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureAuthSchema()

  await dbQuery(
    `
      DELETE FROM case_memberships
      WHERE case_id = $1 AND user_id = $2
    `,
    [caseId, userId],
  )
}
