# Feature Guide — Incident Workspace

This guide covers how to add and remove features. Follow these rules and the codebase will stay clean as it grows.

---

## Table of Contents

### Adding a Feature
1. [The Mental Model](#the-mental-model)
2. [Directory Structure](#directory-structure)
3. [Step 1 — Create your feature directory](#step-1--create-your-feature-directory)
4. [Step 2 — Write the manifest](#step-2--write-the-manifest)
5. [Step 3 — Register the module](#step-3--register-the-module)
6. [Step 4 — Wire the route](#step-4--wire-the-route)
7. [Step 5 — Add a database table](#step-5--add-a-database-table)
8. [Step 6 — Add API routes](#step-6--add-api-routes)
9. [Step 7 — Build the page and components](#step-7--build-the-page-and-components)
10. [Step 8 — Exposing data to other features](#step-8--exposing-data-to-other-features)
11. [Auth quick-reference](#auth-quick-reference)
12. [Rules to never break](#rules-to-never-break)

### Removing a Feature
13. [Before you delete anything](#before-you-delete-anything)
14. [Step 1 — Unregister the module](#step-1--unregister-the-module)
15. [Step 2 — Remove the app route](#step-2--remove-the-app-route)
16. [Step 3 — Remove the API routes](#step-3--remove-the-api-routes)
17. [Step 4 — Remove the feature directory](#step-4--remove-the-feature-directory)
18. [Step 5 — Remove the DB module](#step-5--remove-the-db-module)
19. [Step 6 — Drop the database table](#step-6--drop-the-database-table)
20. [Step 7 — Remove shared contracts](#step-7--remove-shared-contracts)
21. [Step 8 — Remove from aggregates](#step-8--remove-from-aggregates)
22. [Removal checklist](#removal-checklist)

---

## The Mental Model

The app is made up of **feature modules**. Each module is self-contained — it owns its own pages, components, database table(s), and API routes. Modules talk to each other only through:

- **`lib/contracts/`** — shared TypeScript types
- **Exported accessor functions** — typed functions in `lib/db/` that other modules may call
- **The module registry** — `lib/modules/registry.ts` is the only place that knows which features exist

The `app/` directory is intentionally thin. It delegates everything to the feature.

```
features/my-feature/          ← all feature logic lives here
  index.ts                    ← public barrel export
  manifest.ts                 ← shell contract (id, title, routes)
  pages/
    MyFeaturePage.tsx         ← actual page implementation
  components/
    MyWidget.tsx
  lib/
    helpers.ts                ← feature-private utilities

app/my-feature/               ← thin Next.js route
  page.tsx                    ← calls requireAuth, delegates to feature page

lib/db/
  myFeature.ts                ← DB accessor (owns its own table)

app/api/my-feature/
  route.ts                    ← API route (auth + error handling)
```

---

## Directory Structure

Here is the full tree for a feature called `threat-intel`:

```
features/threat-intel/
  index.ts
  manifest.ts
  pages/
    ThreatIntelPage.tsx
  components/
    ThreatIntelCard.tsx

app/threat-intel/
  page.tsx

app/api/threat-intel/
  route.ts

lib/db/
  threatIntel.ts
```

---

## Step 1 — Create your feature directory

```bash
mkdir -p features/threat-intel/pages
mkdir -p features/threat-intel/components
touch features/threat-intel/index.ts
touch features/threat-intel/manifest.ts
```

---

## Step 2 — Write the manifest

The manifest is the shell-facing contract. The shell reads it to show the feature in navigation.

**`features/threat-intel/manifest.ts`**
```typescript
import type { AppModuleManifest } from "@/lib/modules/types"

export function getThreatIntelHref() {
  return "/threat-intel"
}

export const threatIntelModule: AppModuleManifest = {
  defaultHref: getThreatIntelHref(),
  description: "Search and track threat intelligence indicators.",
  id: "threat-intel",
  routes: [
    {
      href: getThreatIntelHref(),
      label: "Open Threat Intel",
    },
  ],
  title: "Threat Intel",
}
```

**`features/threat-intel/index.ts`**
```typescript
export { threatIntelModule, getThreatIntelHref } from "@/features/threat-intel/manifest"
export { ThreatIntelPage } from "@/features/threat-intel/pages/ThreatIntelPage"
```

Rules:
- `id` must be unique across all modules — use kebab-case
- Export href helper functions (e.g. `getThreatIntelHref`) — other features use these when linking, never hardcode paths
- Keep `index.ts` as a clean barrel — only re-export, no logic

---

## Step 3 — Register the module

Add it to **`lib/modules/registry.ts`**:

```typescript
import { threatIntelModule } from "@/features/threat-intel"
// ... existing imports

export const appModules: AppModuleManifest[] = [
  casesModule,
  incidentWorkspaceModule,
  collabHuntGraphModule,
  integrationsModule,
  threatIntelModule,   // ← add here
  demoModule,
]
```

This is the **only** place outside of `features/` that references your feature.

---

## Step 4 — Wire the route

Create a thin Next.js page that handles auth and delegates to your feature:

**`app/threat-intel/page.tsx`**
```typescript
import { ThreatIntelPage } from "@/features/threat-intel"
import { requireOrgPermission } from "@/lib/auth/access"

export default async function Page() {
  const currentUser = await requireOrgPermission("view_all_cases")
  return <ThreatIntelPage currentUser={currentUser} />
}
```

Rules:
- **The `app/` page does auth and nothing else.** All data fetching and rendering logic lives in the feature page component.
- Use the right auth guard (see [Auth quick-reference](#auth-quick-reference)).
- If your page needs data, fetch it here and pass it as props — keep the feature page component typed and testable.

Example with data fetching:

```typescript
export default async function Page() {
  const currentUser = await requireOrgPermission("view_all_cases")
  const indicators = await listThreatIndicators()
  return <ThreatIntelPage currentUser={currentUser} indicators={indicators} />
}
```

---

## Step 5 — Add a database table

Each feature owns its own table(s). Create a DB module in `lib/db/`.

**`lib/db/threatIntel.ts`**
```typescript
import { createSchemaGuard, dbQuery, generateId, getDbPool } from "@/lib/db/index"

// 1. Always use createSchemaGuard — never manage schema promises manually
const ensureThreatIntelSchema = createSchemaGuard(async () => {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS threat_indicators (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await dbQuery(`
    CREATE INDEX IF NOT EXISTS threat_indicators_investigation_idx
    ON threat_indicators (investigation_id, created_at DESC)
  `)
})

// 2. Always use generateId(prefix) — never crypto.randomUUID() directly
export async function createThreatIndicator(input: {
  investigationId: string
  kind: string
  value: string
  confidence: string
}) {
  if (!getDbPool()) {
    throw new Error("DATABASE_URL is not configured.")
  }

  await ensureThreatIntelSchema()

  const id = generateId("indicator")

  await dbQuery(
    `
      INSERT INTO threat_indicators (id, investigation_id, kind, value, confidence, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [id, input.investigationId, input.kind, input.value, input.confidence],
  )

  return getThreatIndicator(id)
}

export async function listThreatIndicators(investigationId: string) {
  if (!getDbPool()) {
    return []
  }

  await ensureThreatIntelSchema()

  const result = await dbQuery<{
    id: string
    investigation_id: string
    kind: string
    value: string
    confidence: string
    created_at: string
  }>(
    `
      SELECT id, investigation_id, kind, value, confidence, created_at::text
      FROM threat_indicators
      WHERE investigation_id = $1
      ORDER BY created_at DESC
    `,
    [investigationId],
  )

  return result.rows.map((row) => ({
    confidence: row.confidence,
    createdAt: row.created_at,
    id: row.id,
    investigationId: row.investigation_id,
    kind: row.kind,
    value: row.value,
  }))
}

export async function getThreatIndicator(id: string) {
  // ... similar pattern
}
```

### DB rules

| Rule | Why |
|------|-----|
| Use `createSchemaGuard` | Idempotent, race-safe schema init. Never use a raw `let schemaPromise` pattern. |
| Use `generateId("prefix")` | Prefixed IDs (e.g. `indicator-abc123`) make logs and debugging far easier. |
| Return `[]` / `null` when `!getDbPool()` | The app boots without a database for local dev without Postgres. |
| Throw when `!getDbPool()` on write paths | Writes should fail loudly if the DB is missing. |
| Only query your own tables | Never write SQL against another module's tables. Call their exported functions instead. |
| Map rows to typed objects before returning | Never return raw `pg` row objects. Map them in the DB module. |

---

## Step 6 — Add API routes

**`app/api/threat-intel/route.ts`**
```typescript
import { NextResponse } from "next/server"

import { requireApiOrgPermission } from "@/lib/auth/access"
import { createThreatIndicator, listThreatIndicators } from "@/lib/db/threatIntel"

export async function GET(request: Request) {
  const authResult = await requireApiOrgPermission("view_all_cases")

  if (authResult.error) {
    return authResult.error
  }

  const { searchParams } = new URL(request.url)
  const investigationId = searchParams.get("investigationId")

  if (!investigationId) {
    return NextResponse.json({ error: "investigationId is required." }, { status: 400 })
  }

  try {
    const indicators = await listThreatIndicators(investigationId)
    return NextResponse.json(indicators)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load indicators." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const authResult = await requireApiOrgPermission("view_all_cases")

  if (authResult.error) {
    return authResult.error
  }

  const payload = (await request.json()) as {
    investigationId?: string
    kind?: string
    value?: string
    confidence?: string
  }

  if (!payload.investigationId || !payload.kind || !payload.value?.trim()) {
    return NextResponse.json(
      { error: "investigationId, kind, and value are required." },
      { status: 400 },
    )
  }

  try {
    const indicator = await createThreatIndicator({
      confidence: payload.confidence ?? "low",
      investigationId: payload.investigationId,
      kind: payload.kind,
      value: payload.value.trim(),
    })
    return NextResponse.json(indicator)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create indicator." },
      { status: 500 },
    )
  }
}
```

### API route rules

- **Always auth first** — the very first thing every handler does is call an auth helper.
- **Always wrap DB calls in try/catch** — unhandled DB errors will crash the route with a 500 and no body.
- **Validate input before touching the DB** — return 400 early for missing or invalid fields.
- **Keep routes thin** — no business logic in the route. Call a DB function or a lib helper.

---

## Step 7 — Build the page and components

**`features/threat-intel/pages/ThreatIntelPage.tsx`**
```tsx
import type { AuthenticatedUser } from "@/lib/auth/permissions"

type ThreatIntelPageProps = {
  currentUser: AuthenticatedUser
  // pass server-fetched data as props — don't fetch inside server components
}

export function ThreatIntelPage({ currentUser }: ThreatIntelPageProps) {
  return (
    <div>
      <h1>Threat Intel</h1>
      {/* your components here */}
    </div>
  )
}
```

### Component rules

- **Server components** (no `"use client"`) — fetch data in the `app/` page and pass as props. Keep these simple.
- **Client components** (`"use client"`) — fetch data via `fetch("/api/...")`. Use `useEffect` for polling if needed (see `InvestigationArtifactsPanel` as a reference).
- **Feature components stay inside their feature** — `features/threat-intel/components/` is private to that feature. Do not import another feature's components directly.
- **Shared UI lives in `components/ui/`** — buttons, badges, cards, etc. are already there. Use them.

---

## Step 8 — Exposing data to other features

If another feature (e.g. the Cases detail page) needs to display a count of your threat indicators, follow the aggregation pattern — **never reach into another feature's DB module directly**.

### Option A — Export a count/stub function from your DB module

```typescript
// lib/db/threatIntel.ts
export async function countThreatIndicatorsByInvestigationIds(investigationIds: string[]) {
  if (!getDbPool() || investigationIds.length === 0) {
    return new Map<string, number>()
  }

  await ensureThreatIntelSchema()

  const result = await dbQuery<{ count: number; investigation_id: string }>(
    `
      SELECT investigation_id, COUNT(*)::int AS count
      FROM threat_indicators
      WHERE investigation_id = ANY($1::text[])
      GROUP BY investigation_id
    `,
    [investigationIds],
  )

  return new Map(result.rows.map((row) => [row.investigation_id, row.count] as const))
}
```

### Option B — Add the count to `lib/db/investigationAggregates.ts`

If the count should appear on the case list/detail (in `InvestigationAggregateCounts`), add it to `investigationAggregates.ts`:

1. Add the field to `InvestigationAggregateCounts` in `lib/contracts/investigations.ts`
2. Import your new count function in `lib/db/investigationAggregates.ts`
3. Add it to the `Promise.all` batch
4. Map it in the result

`investigationAggregates.ts` is the designated place for cross-module aggregation. Keep individual DB modules unaware of each other.

### Sharing types

If another feature needs to reference your data type, define it in `lib/contracts/`:

```typescript
// lib/contracts/threatIntel.ts
export type ThreatIndicatorKind = "ip" | "domain" | "hash" | "url"

export type ThreatIndicator = {
  confidence: string
  createdAt: string
  id: string
  investigationId: string
  kind: ThreatIndicatorKind
  value: string
}
```

---

## Auth quick-reference

### Page routes (server components)

| Helper | Use when |
|--------|----------|
| `requireAuthenticatedUser()` | Any logged-in user can access |
| `requireOrgPermission("view_all_cases")` | Needs a specific org-level permission |
| `requireCasePermissionByCaseId(caseId, "view")` | Page is scoped to a specific case |
| `requireCasePermissionByRoomId(roomId, "edit")` | Page is scoped to a room |

All of these **redirect** to `/login` or `/unauthorized` if the check fails — they never return null.

### API routes

| Helper | Use when |
|--------|----------|
| `requireApiOrgPermission("view_all_cases")` | Org-level check, returns `{ error, user }` |
| `requireApiCasePermissionByCaseId(caseId, "edit")` | Case-level check by case ID |
| `requireApiCasePermissionByRoomId(roomId, "view")` | Case-level check by room ID |

API helpers **return** an error response instead of redirecting. Always check and return it:

```typescript
const authResult = await requireApiOrgPermission("view_all_cases")
if (authResult.error) return authResult.error
```

### Org permissions

| Permission | Who has it |
|-----------|-----------|
| `view_all_cases` | `org_admin`, `integration_admin` |
| `create_case` | `org_admin`, `investigator` |
| `manage_integrations` | `org_admin`, `integration_admin` |
| `manage_org_memberships` | `org_admin` |
| `view_admin` | `org_admin` |

---

## Rules to never break

### 1. Features never import from other features

```typescript
// ❌ Never do this
import { CaseDetailPanel } from "@/features/cases/components/CaseDetailPanel"

// ✅ If you need shared UI, it belongs in components/ui/ or components/shell/
```

### 2. DB modules never query each other's tables directly

```typescript
// ❌ Never do this inside threatIntel.ts
await dbQuery("SELECT * FROM investigations WHERE id = $1", [id])

// ✅ Import the exported function
import { getInvestigationById } from "@/lib/db/investigations"
const investigation = await getInvestigationById(id)
```

### 3. Never create a circular dependency between DB modules

If module A imports from module B, module B must not import from module A. If you find yourself needing this, you need a third module that sits above both — like `investigationAggregates.ts` does.

### 4. App routes stay thin

```typescript
// ❌ Never do this in app/my-feature/page.tsx
export default async function Page() {
  const user = await requireAuthenticatedUser()
  const data = await db.query("SELECT ...")  // business logic in route
  const filtered = data.filter(...)          // more logic
  return <div>{filtered.map(...)}</div>      // rendering in route
}

// ✅ Delegate everything
export default async function Page() {
  const user = await requireAuthenticatedUser()
  const data = await listMyThings()
  return <MyFeaturePage currentUser={user} data={data} />
}
```

### 5. Always use createSchemaGuard and generateId

```typescript
// ❌ Never manage schema promises manually
let schemaReady: Promise<void> | null = null
async function ensureSchema() {
  if (schemaReady) return schemaReady
  schemaReady = setupSchema().catch((e) => { schemaReady = null; throw e })
  return schemaReady
}

// ✅ Always use the shared helper
const ensureSchema = createSchemaGuard(async () => {
  await dbQuery(`CREATE TABLE IF NOT EXISTS ...`)
})

// ❌ Never use raw UUIDs
const id = crypto.randomUUID()

// ✅ Always use prefixed IDs
const id = generateId("indicator")
```

### 6. Always try/catch in API routes

```typescript
// ❌ Unguarded — a DB error becomes an unhandled crash
const result = await createThreatIndicator(input)
return NextResponse.json(result)

// ✅ Always wrap
try {
  const result = await createThreatIndicator(input)
  return NextResponse.json(result)
} catch (error) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to create indicator." },
    { status: 500 },
  )
}
```

### 7. Register in the module registry — that's the only global coupling

The only place `lib/modules/registry.ts` should be touched when adding a feature is to add your module to the `appModules` array. If you find yourself adding feature-specific logic anywhere else in `lib/`, stop and reconsider.

---

## Checklist

When adding a new feature, work through this list in order:

- [ ] `features/my-feature/manifest.ts` — id, title, description, routes, href helper
- [ ] `features/my-feature/index.ts` — barrel export
- [ ] `lib/modules/registry.ts` — add to `appModules`
- [ ] `app/my-feature/page.tsx` — thin route with auth guard
- [ ] `lib/db/myFeature.ts` — DB module with `createSchemaGuard`, `generateId`, typed accessors
- [ ] `app/api/my-feature/route.ts` — auth first, validate input, try/catch around DB calls
- [ ] `features/my-feature/pages/MyFeaturePage.tsx` — page component
- [ ] If exposing data to other features — export a typed accessor function, or add to `investigationAggregates.ts`
- [ ] If sharing types — add to `lib/contracts/`
- [ ] Run `npx tsc --noEmit` — must pass clean before rebuilding containers

---

---

# Removing a Feature

Removing a feature is the reverse of adding one, but the order matters. Work outside-in — stop exposing the feature first, then clean up the internals, and handle the database last.

> **Database tables are the exception.** TypeScript will tell you when all code references are gone. The database will not. Read [Step 6](#step-6--drop-the-database-table) carefully before running any `DROP TABLE`.

---

## Before you delete anything

Ask these questions first:

1. **Does any other feature import from this feature's `index.ts` or `manifest.ts`?**
   Search for the feature id and path: `grep -r "features/threat-intel" .`
   Every import must be removed before the directory is deleted.

2. **Does any other DB module call an exported function from this feature's DB module?**
   Search: `grep -r "from \"@/lib/db/threatIntel\"" .`

3. **Does `lib/db/investigationAggregates.ts` reference this feature?**
   If so, the count/summary field must be removed from `InvestigationAggregateCounts` in `lib/contracts/investigations.ts` too.

4. **Are there shared types in `lib/contracts/` that only this feature uses?**
   If so, they can be deleted. If other features use them, leave them.

5. **Does the database table hold data you need to keep or migrate?**
   If production data exists, write a migration script before dropping the table.

---

## Step 1 — Unregister the module

Remove the entry from **`lib/modules/registry.ts`**:

```typescript
// ❌ Remove this import
import { threatIntelModule } from "@/features/threat-intel"

export const appModules: AppModuleManifest[] = [
  casesModule,
  incidentWorkspaceModule,
  collabHuntGraphModule,
  integrationsModule,
  // ❌ Remove this line
  threatIntelModule,
  demoModule,
]
```

This immediately makes the feature invisible to the shell. Do this first so nothing in the running app tries to navigate to a route you're about to delete.

---

## Step 2 — Remove the app route

Delete the Next.js page directory:

```bash
rm -rf app/threat-intel/
```

If the feature had nested routes (e.g. `app/threat-intel/[indicatorId]/`), remove the entire tree.

---

## Step 3 — Remove the API routes

Delete the API route directory:

```bash
rm -rf app/api/threat-intel/
```

Check for any other API routes that called into this feature's DB module — search for imports of `@/lib/db/threatIntel` across `app/api/` and remove those calls too.

---

## Step 4 — Remove the feature directory

```bash
rm -rf features/threat-intel/
```

Before running this, make sure no other feature imports from it. If TypeScript is clean after removing the registry entry and routes, it's safe to delete.

---

## Step 5 — Remove the DB module

```bash
rm lib/db/threatIntel.ts
```

First confirm nothing imports it:

```bash
grep -r "from \"@/lib/db/threatIntel\"" .
```

This must return no results before you delete the file. If anything still imports it, fix those references first — TypeScript will also catch this when you run `npx tsc --noEmit`.

---

## Step 6 — Drop the database table

**This is the only irreversible step. Do not skip reading this section.**

The schema guard (`createSchemaGuard`) creates tables with `CREATE TABLE IF NOT EXISTS` on first use. When you delete the DB module, the table is no longer managed by application code — but it still exists in Postgres. It will just sit there unused until you explicitly drop it.

### Option A — You want to permanently delete the data

Connect to the database and drop the table:

```sql
DROP TABLE IF EXISTS threat_indicators;
```

For the local dev environment:

```bash
docker exec -it incident-workspace-postgres psql -U incident -d incident_workspace \
  -c "DROP TABLE IF EXISTS threat_indicators;"
```

If the table has foreign key relationships (e.g. `REFERENCES investigations(id) ON DELETE CASCADE`), those will be handled automatically by the cascade. If other tables reference yours, Postgres will error — check with `\d threat_indicators` first.

### Option B — You want to keep the data (archival)

Leave the table in place and document it. The app will never touch it again once the DB module is gone. You can always export it later:

```bash
docker exec -it incident-workspace-postgres psql -U incident -d incident_workspace \
  -c "\COPY threat_indicators TO '/tmp/threat_indicators_archive.csv' CSV HEADER"
```

### Option C — Production environment

Never run `DROP TABLE` directly against production. Write a migration script, review it, and run it during a maintenance window. Back up first.

---

## Step 7 — Remove shared contracts

If you added types to `lib/contracts/` that are only used by this feature, delete them:

```bash
rm lib/contracts/threatIntel.ts
```

If the type file is referenced from `lib/contracts/index.ts`, remove that export too.

If other features use the same types, **do not delete them** — decouple those types from the feature first by keeping them in `lib/contracts/` under a more generic name.

---

## Step 8 — Remove from aggregates

If you added count data to `lib/db/investigationAggregates.ts`:

1. Remove the import of your count function
2. Remove it from the `Promise.all` call
3. Remove the field from the result mapping
4. Remove the field from `InvestigationAggregateCounts` in `lib/contracts/investigations.ts`
5. Fix any UI that was rendering that count field

TypeScript will surface every usage of the removed field — fix them all before the build is clean.

---

## Removal checklist

Work through this in order. Run `npx tsc --noEmit` after each step to catch stray references early.

- [ ] Grep for all references to the feature path and module id — understand the full blast radius before touching anything
- [ ] `lib/modules/registry.ts` — remove import and `appModules` entry
- [ ] `app/[feature-route]/` — delete the page directory
- [ ] `app/api/[feature-route]/` — delete the API route directory
- [ ] `features/[feature-name]/` — delete the feature directory
- [ ] `lib/db/[featureName].ts` — delete the DB module (confirm no imports remain first)
- [ ] `lib/contracts/[featureName].ts` — delete if only used by this feature
- [ ] `lib/db/investigationAggregates.ts` — remove count function import and field if applicable
- [ ] `lib/contracts/investigations.ts` — remove aggregate count field if applicable
- [ ] Run `npx tsc --noEmit` — must pass completely clean
- [ ] Drop the database table — only after TypeScript is clean and you've decided on Option A/B/C above
- [ ] Rebuild containers: `docker compose build && docker compose up -d`
