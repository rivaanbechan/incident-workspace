# Plan: Admin RBAC Controls

## Overview

The platform currently has permission functions (`hasOrgPermission`, `hasCasePermission`) but no admin UI to inspect or configure them. Roles and their capabilities are invisible — admins cannot see what a given role can do, analysts do not know what they have access to, and adding new feature permissions requires hardcoded defaults with no way to adjust them without a code change.

This plan introduces:

1. **A permission registry** — a single source of truth listing every capability in the platform, grouped by feature domain.
2. **A role management UI** in the admin area — admins can see all roles, see exactly which permissions each role has, and toggle permissions on/off per role.
3. **A DB-backed role-permission table** — replaces scattered hardcoded defaults with durable, org-scoped configuration.
4. **A migration path** — existing hardcoded permission checks are preserved during the transition; the DB layer augments them progressively.

---

## Guiding principles

- **Registry-first.** Every permission that exists in the platform must be declared in the registry before it can be assigned. The registry is the audit trail for what capabilities the platform has.
- **Org-scoped.** Roles and their permissions are per-org. One org's admin cannot affect another's.
- **Additive only for MVP.** We do not remove or restructure existing `hasOrgPermission` / `hasCasePermission` checks. We add a DB layer that the existing functions consult. This keeps the blast radius small.
- **Both axes in one matrix.** Org-level and case-level permissions are both shown in the RBAC matrix. The matrix defines *defaults* per role. Per-case user overrides (already supported) remain possible on top of these defaults.
- **Extend, don't replace.** An Admin area already exists in the sidebar. This plan extends it with a Roles & Permissions page — it does not rebuild the admin shell.
- **Visible by default.** The admin UI shows all permissions, even ones that are not yet configurable — marked as "system-managed" so admins understand the full picture.
- **No new UI libraries.** shadcn/ui + Tailwind only.

---

## Current permission landscape

Based on `lib/auth/permissions.ts` and `lib/auth/access.ts`, the platform currently has two permission axes:

### Org-level permissions (`hasOrgPermission`)
Control what a user can do across the organisation — managing agents, integrations, admin settings, etc.

### Case-level permissions (`hasCasePermission`)
Control what a user can do within a specific case — viewing, editing, managing members, etc.

Both are currently checked against hardcoded role sets in code. There is no UI to inspect or change them.

---

## Permission registry design

The registry is a static TypeScript object defined in `lib/auth/permissionRegistry.ts`. It is the canonical list of every capability in the platform. The DB stores overrides; the registry provides the defaults and metadata.

### Structure

```ts
type PermissionDefinition = {
  id: string               // e.g. "cases:view", "oracle:contribute"
  label: string            // human-readable name
  description: string      // what this permission allows
  domain: PermissionDomain // grouping for UI
  axis: "org" | "case"     // which permission function checks it
  defaultRoles: string[]   // roles that have this by default (transition period)
  systemManaged: boolean   // if true, shown in UI but not toggleable
}

type PermissionDomain =
  | "cases"
  | "board"
  | "agents"
  | "oracle"
  | "integrations"
  | "investigations"
  | "admin"
```

### Initial permission catalogue

The `axis` column indicates where the permission is enforced:
- **org** — applies platform-wide, checked by `hasOrgPermission`
- **case (default)** — applies within cases, checked by `hasCasePermission`. Configurable as role defaults here; per-case overrides remain possible.

#### Cases
| ID | Label | Default roles | Axis |
|----|-------|--------------|------|
| `cases:view` | View cases | all | case (default) |
| `cases:edit` | Edit case details | editor, admin | case (default) |
| `cases:manage_members` | Manage case members | admin | case (default) |
| `cases:close` | Close / archive cases | admin | case (default) |

#### Board
| ID | Label | Default roles | Axis |
|----|-------|--------------|------|
| `board:view` | View the incident board | all | case (default) |
| `board:edit` | Edit entities on the board | editor, admin | case (default) |
| `board:promote_to_record` | Promote board entities to case records | editor, admin | case (default) |
| `board:promote_to_oracle` | Promote board entities to The Oracle | editor, admin | case (default) |

#### Agents
| ID | Label | Default roles | Axis |
|----|-------|--------------|------|
| `agents:view` | View configured agents | all | org |
| `agents:invoke` | Invoke agents on the board | editor, admin | case (default) |
| `agents:manage` | Create / edit / delete agents | admin | org |

#### The Oracle
| ID | Label | Default roles | Axis |
|----|-------|--------------|------|
| `oracle:view` | Browse Oracle entries | all | org |
| `oracle:contribute` | Upload markdown + promote from canvas | editor, admin | org |
| `oracle:delete` | Delete Oracle entries | admin | org |
| `oracle:reembed` | Re-embed individual entries | admin | org |
| `oracle:reembed_all` | Bulk re-embed all entries | admin | org |

#### Integrations
| ID | Label | Default roles | Axis |
|----|-------|--------------|------|
| `integrations:view` | View installed datasources | all | org |
| `integrations:manage` | Install / configure / remove datasources | admin | org |

#### Investigations
| ID | Label | Default roles | Axis |
|----|-------|--------------|------|
| `investigations:view` | View investigations | all | org |
| `investigations:manage` | Create / edit / archive investigations | editor, admin | org |

#### Admin
| ID | Label | Default roles | Axis |
|----|-------|--------------|------|
| `admin:view` | Access the admin area | admin | org |
| `admin:manage_roles` | Configure role permissions | admin | org |
| `admin:manage_members` | Manage org members | admin | org |

---

## Data model

### New table: `org_roles`

Stores the roles that exist for an org. Some roles are seeded on org creation.

```sql
CREATE TABLE org_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,             -- e.g. "analyst", "viewer", "admin"
  label       TEXT NOT NULL,             -- display name
  is_system   BOOLEAN NOT NULL DEFAULT false, -- system roles cannot be deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);
```

### New table: `org_role_permissions`

Stores which permissions are enabled for each role. Absence of a row means the permission falls back to the registry default.

```sql
CREATE TABLE org_role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role_name     TEXT NOT NULL,
  permission_id TEXT NOT NULL,           -- matches PermissionDefinition.id
  granted       BOOLEAN NOT NULL,        -- explicit grant or explicit deny
  updated_by    UUID NOT NULL,           -- userId of admin who made the change
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, role_name, permission_id)
);
```

### Default system roles seeded on org creation

| role_name | label | is_system |
|-----------|-------|-----------|
| `admin` | Administrator | true |
| `editor` | Editor | true |
| `viewer` | Viewer | true |

Admins can create custom roles on top of these.

---

## Updated permission resolution

**Important:** `hasOrgPermission` and `hasCasePermission` in `lib/auth/permissions.ts` are currently **pure synchronous functions**. Changing them to async DB-querying functions would break every call site in the codebase — that is not additive, it is a breaking refactor.

Instead, the DB lookup happens one level up at the **boundary layer** (`lib/auth/access.ts`), where calls are already async. A new helper resolves the full permission set for a user+org once per request and passes the resolved set down:

```
resolveOrgPermissions(userId, orgId): Promise<Set<string>>
  1. Look up user's role in org
  2. Fetch all org_role_permissions rows for (orgId, roleName)
  3. For every permission in the registry:
     - If a DB row exists → use row.granted
     - If no row → use permissionRegistry[permissionId].defaultRoles.includes(roleName)
  4. Return Set<string> of all granted permission IDs

hasOrgPermission(resolvedPermissions: Set<string>, permissionId: string): boolean
  → pure, synchronous, no DB call
```

`requireApiCasePermissionByCaseId` (already async) calls `resolveOrgPermissions` once at the top of each request and passes the resolved set to `hasOrgPermission`. Existing pure call sites are unchanged — they continue to work with hardcoded logic until migrated.

**Migration path:** New routes use `resolveOrgPermissions`. Existing routes continue using the current pure functions unchanged. Over time, routes are migrated to the new pattern. Zero forced changes at deploy time.

---

## New files

### `lib/auth/permissionRegistry.ts` (~120 lines)

The static catalogue of all permissions. Exports:
- `permissionRegistry: Record<string, PermissionDefinition>`
- `getPermissionsByDomain(): Record<PermissionDomain, PermissionDefinition[]>`
- `getDefaultRoles(permissionId: string): string[]`

### `lib/db/roles.ts` (~100 lines)

DB layer for role and permission management:

```ts
getRolesForOrg(orgId): Promise<OrgRole[]>
getPermissionsForRole(orgId, roleName): Promise<ResolvedRolePermissions>
// ResolvedRolePermissions = { [permissionId]: { granted: boolean, source: "db" | "default" } }

setPermission(orgId, roleName, permissionId, granted, updatedBy): Promise<void>
resetPermission(orgId, roleName, permissionId): Promise<void>  // removes the override row

createRole(orgId, name, label): Promise<OrgRole>
deleteRole(orgId, roleId): Promise<void>  // only non-system roles
```

### `app/api/admin/roles/route.ts` (~40 lines)

`GET` — list all roles for the org
`POST` — create a custom role

Both require `admin:manage_roles` permission.

### `app/api/admin/roles/[roleName]/permissions/route.ts` (~50 lines)

`GET` — get all permissions for a role (resolved: DB override or default)
`PATCH` — set or reset a permission for a role

PATCH body: `{ permissionId: string; granted: boolean | null }`
- `true` — explicitly grant
- `false` — explicitly deny
- `null` — reset to registry default (removes the DB override row)

This three-state design is essential: without `null`, admins cannot return a permission to its default after overriding it.

Requires `admin:manage_roles`.

### `app/api/admin/permissions/route.ts` (~30 lines)

`GET` — return the full permission registry grouped by domain. Used by the UI to render the permission matrix. No write. Requires `admin:view`.

---

## Admin UI — extending `features/admin/`

An Admin area already exists in the sidebar. This plan adds a **Roles & Permissions** page to it. We extend the existing admin shell — no new sidebar entry or module registration needed.

### New route added to existing admin area
- Route: `/admin/roles`
- Tab/nav label: **Roles & Permissions**
- Visibility: requires `admin:manage_roles`

### `features/admin/pages/RolesPage.tsx` — the main view

Two-panel layout:
- **Left panel** — role list. Each role shows name, member count, system badge if applicable. Selecting a role loads the right panel. "New Role" button at the bottom.
- **Right panel** — permission matrix for the selected role.

### Permission matrix (`RolePermissionMatrix.tsx`)

Permissions are grouped by domain, displayed in two sections:

**Org-level** — capabilities across the platform (Cases, Board, Agents, The Oracle, Integrations, Admin)
**Case-level (defaults)** — what this role can do inside any case by default. Per-case user overrides remain possible on top of these defaults. A header note explains: *"These are defaults. Individual case members can be granted higher access on a per-case basis."*

Each permission row shows:

| Permission | Description | Axis | Toggle |
|------------|-------------|------|--------|
| Oracle: View | Browse Oracle entries | Org | ● (on) |
| Oracle: Contribute | Upload + promote from canvas | Org | ○ (off) |
| Board: Edit | Edit entities on the board | Case default | ● (on) |
| Cases: Manage Members | Manage case members | Case default | ○ (off) |

Toggle states:
- **On (blue)** — explicitly granted in DB
- **Off** — explicitly denied or not granted
- **Default (grey indicator)** — no DB row, showing the system default. Tooltip: *"This is the default for this role. Toggle to override."*

System-managed permissions (`systemManaged: true`) show a lock icon and are not toggleable — tooltip explains why.

Changes are saved immediately (optimistic update + `PATCH` to API). A toast confirms each change.

### Member list note

Member-to-role assignment already exists in the platform. This plan does not change that surface. However, the role list left panel will show the member count per role and link to the existing member management page — so admins can see "Editors: 4 members" and navigate to adjust membership if needed. If the existing roles need reworking (renaming, restructuring), that can be done via the custom role creation flow in this UI — create the new role, assign members, deprecate the old one.

### File structure

```
features/admin/
  pages/
    AdminPage.tsx                 ← shell + tabs (~60 lines)
    RolesPage.tsx                 ← two-panel layout (~150 lines)
  components/
    RoleList.tsx                  ← left panel role list (~100 lines)
    RolePermissionMatrix.tsx      ← domain section orchestrator (~150 lines)
    PermissionDomainSection.tsx   ← one collapsible domain group (~80 lines)
    PermissionRow.tsx             ← single permission toggle row (~80 lines)
    NewRoleDialog.tsx             ← create custom role dialog (~80 lines)
  hooks/
    useRoles.ts                   ← fetch roles, create, delete (~70 lines)
    useRolePermissions.ts         ← fetch + patch permissions, optimistic update (~90 lines)
```

`RolePermissionMatrix` is split into `RolePermissionMatrix` (orchestrator) + `PermissionDomainSection` (one collapsible group per domain) to stay safely under 300 lines. With 7 domains × multiple permissions each, a single file would easily exceed the limit.

---

## Modified files

| File | Change |
|------|--------|
| `lib/auth/permissions.ts` | Add `resolveOrgPermissions(userId, orgId)` async helper. Existing pure functions unchanged. |
| `lib/auth/access.ts` | `requireApiCasePermissionByCaseId` calls `resolveOrgPermissions` and passes resolved set to permission checks |
| `lib/db/index.ts` | No change — `dbQuery` already supports the new tables |
| Existing admin shell | Extend to add Roles & Permissions nav entry pointing to `/admin/roles` |

---

## Migration — existing hardcoded checks

No existing permission checks are removed. The updated `hasOrgPermission` function:
1. Tries the DB first
2. Falls back to the same hardcoded logic as today if no DB row exists

This means the system is fully backward compatible at deploy time. Admins can then customise from the UI at their own pace.

---

## Build order

### Phase 1 — Data layer
1. DB migration — `org_roles` + `org_role_permissions` tables + seed default roles
2. `lib/auth/permissionRegistry.ts` — full permission catalogue
3. `lib/db/roles.ts` — DB CRUD for roles and permissions
4. `lib/auth/permissions.ts` — update resolution logic to consult DB

### Phase 2 — API
5. `app/api/admin/permissions/route.ts` — GET registry
6. `app/api/admin/roles/route.ts` — GET + POST roles
7. `app/api/admin/roles/[roleName]/permissions/route.ts` — GET + PATCH

### Phase 3 — Admin UI
8. `features/admin/hooks/useRoles.ts`
9. `features/admin/hooks/useRolePermissions.ts`
10. `features/admin/components/PermissionRow.tsx`
11. `features/admin/components/PermissionDomainSection.tsx`
12. `features/admin/components/RolePermissionMatrix.tsx`
13. `features/admin/components/RoleList.tsx`
14. `features/admin/components/NewRoleDialog.tsx`
15. `features/admin/pages/RolesPage.tsx`
16. Extend existing admin shell to add the Roles & Permissions nav entry at `/admin/roles`

### Phase 4 — Tests
17. Unit tests: `permissionRegistry.ts`, `lib/db/roles.ts`, `resolveOrgPermissions`
18. API route tests: all 3 admin routes (including PATCH with `granted: null` reset case)
19. Hook tests: `useRoles`, `useRolePermissions`
20. Component tests: `PermissionRow`, `PermissionDomainSection`

---

## Resolved decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Admin area | Already exists in sidebar — extend with a Roles & Permissions page at `/admin/roles`, do not rebuild the shell |
| 2 | Member-role assignment | Already handled. Role list shows member count + link to existing member management. Custom roles can be used to rework existing role structure without breaking current members. |
| 3 | Case-level permissions | Included in the matrix as "Case defaults" section. Defines what a role gets by default in any case. Per-case user overrides remain possible on top. |
| 4 | Compatibility | `hasOrgPermission` / `hasCasePermission` stay pure and synchronous. DB resolution happens via new `resolveOrgPermissions` at the async boundary layer. No forced migration of existing call sites. |
| 5 | Custom roles | Admins can create custom roles. System roles (admin, editor, viewer) cannot be deleted, only extended. |
| 6 | Oracle permissions | Defined in registry under `oracle:*` domain, managed here alongside all other permissions — no special handling needed. |
| 7 | PATCH reset | PATCH body supports `granted: boolean \| null` — `null` removes the DB override and returns the permission to its registry default. Without this, overrides cannot be undone. |
| 8 | Matrix file size | `RolePermissionMatrix` split into orchestrator + `PermissionDomainSection` sub-component. 7 domains × ~4 permissions each would exceed 300 lines in a single file. |
