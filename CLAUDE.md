# CLAUDE.md — Agent Guide

This file is read automatically by Claude Code at the start of every session. It gives you the minimum context needed to work effectively in this repo without exploring the whole codebase.

---

## What this is

A Next.js 16 + TypeScript app shell for security-focused collaborative mini-apps. The primary module is **incident-workspace** — a real-time collaborative board for incident response teams (think Miro + PagerDuty).

**Tech stack:**
- Next.js 16 (App Router), React 18, TypeScript 5
- Yjs for real-time CRDT sync (collaborative board state)
- LiveKit for audio/video/screen sharing
- PostgreSQL for durable storage (via `pg` pool, no ORM)
- next-auth v5 for authentication
- Tailwind CSS + shadcn/ui components
- Vitest + @testing-library/react for tests

**Running locally (dev, port 3000):** `docker compose up -d --build`
**Running locally (HTTPS at https://incident.local):**
```
docker compose build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
**Tests:** `npx vitest run`
**Type check:** `npx tsc --noEmit`

---

## Architecture in 3 layers

```
app/                    ← Thin Next.js routes. Mount feature pages. Keep this lean.
features/<module>/      ← Self-contained mini-apps. Each owns its pages/components/hooks/lib.
lib/                    ← Shared platform infrastructure (db, auth, contracts, modules).
```

**Rule:** modules must not import each other's internals. Cross-module data flows through `lib/contracts/` types and durable IDs.

---

## The incident-workspace board

The board is the most complex part of the codebase. Understand this before touching it.

### State layer (`useBoardRoom` + sub-hooks)

`features/incident-workspace/components/board/useBoardRoom.ts` is the coordinator. It calls 6 focused domain hooks and returns a flat object consumed by context providers:

| Hook | Owns |
|------|------|
| `useYjsRoom` | WebSocket connection, Yjs doc sync, presence |
| `useEntityManager` | Entity CRUD, selected entity state |
| `useConnectionManager` | Connection CRUD |
| `useTimelineManager` | Incident log CRUD |
| `useActionManager` | Action items CRUD |
| `useRoomMeta` | Incident summary, roles, camera, stage rect |

### UI orchestration (`BoardShell`)

`BoardShell.tsx` (810 lines) is the top-level board component. It calls `useBoardRoom` plus 10 additional focused hooks:

| Hook | Owns |
|------|------|
| `useDragAndResize` | Pointer event state machine (drag/pan/resize/wheel) |
| `useConnectionFlow` | Connection drafting lifecycle |
| `useKeyboardShortcuts` | All keyboard handlers (Escape, Tab, a/c/f/s, s-fullscreen) |
| `useEntityActions` | Entity labels, feed templates, reveal/log/create-action helpers |
| `useViewportNavigation` | `focusEntityOnCanvas`, `fitCanvasToScreen`, auto-fit effects |
| `useQuickCapture` | Quick-capture palette state |
| `useEntityCreation` | Entity factory handlers (note, zone, incident card, etc.) |
| `useCasePromotion` | Promote board entities to durable case records |
| `useScreenShares` | LiveKit screen share state |
| `useNotifications` | Toast notifications for assigned tasks |

### Context layer (what components read)

`BoardShell` populates 3 React contexts. Components and sub-components read from these instead of receiving props:

| Context | Contains |
|---------|----------|
| `BoardUIContext` | Camera, visual mode, fullscreen, connection draft state, panning, zone editing |
| `BoardSelectionContext` | Selected entity/entities, selection actions, delete, promote |
| `BoardEntitiesContext` | Entities, connections, actions, log, CRUD operations, presence |

### Rendering layer

`BoardEntityRenderer.tsx` — dispatcher. Reads context, computes shared interaction handlers, delegates to 5 typed sub-components:
- `ZoneEntityCard`, `NoteEntityCard`, `IncidentEntityCard`, `StatusMarkerEntityCard`, `ScreenTileEntityCard`

Each sub-component receives typed props only. No context reads inside sub-components.

### Board data flow (top to bottom)

```
useBoardRoom (coordinator)
  └─ 6 domain hooks → flat return object
       └─ BoardShell (UI orchestration)
            └─ 10 UI hooks
                 └─ 3 context providers
                      └─ BoardCanvas → BoardEntityRenderer → [5 card sub-components]
                      └─ BoardSideRail → YourTasksPanel / InvestigationArtifactsPanel
```

---

## Shared infrastructure

| Path | Purpose |
|------|---------|
| `lib/db/index.ts` | `dbQuery`, `getDbPool` — raw SQL helpers |
| `lib/db/datasources.ts` | Datasource CRUD |
| `lib/db/investigations.ts` | Investigation/case CRUD |
| `lib/db/caseRecords.ts` | Case record CRUD |
| `lib/auth/access.ts` | `requireApiCasePermissionByCaseId` — use this in all case API routes |
| `lib/auth/permissions.ts` | `hasOrgPermission`, `hasCasePermission` — pure permission functions |
| `lib/contracts/validations.ts` | Type guard validators for API input (kind, sourceType, entityRefs) |
| `lib/api/client.ts` | `apiRequest<T>()` — the only place raw `fetch` should be called client-side |

**Always use `apiRequest<T>()` for client-side API calls.** Never write a raw `fetch()`.

---

## Testing

**232 tests across 20 files.** All tests live in `__tests__/` subdirectories next to the code they test.

```
npx vitest run                    # run all tests
npx vitest run --reporter=verbose # with test names
npx tsc --noEmit                  # type check
```

**Patterns:**
- Import explicitly from `"vitest"` — never use globals: `import { describe, it, expect, vi } from "vitest"`
- Yjs hooks: use real `Y.Doc` instances, mock `y-websocket` with `vi.mock`
- Context-consuming components: wrap with context provider mocks in tests
- Board entity card sub-components: no context needed — they receive all data as props
- API route handlers: import and call directly with mock `Request` objects; mock DB functions with `vi.mock`
- `jsdom` normalises hex colours to `rgb()` — assert `rgb(...)` not `#rrggbb` in style tests

---

## Coding conventions

- **No raw `fetch()`** in client code — use `lib/api/client.ts`
- **No Zod** — use plain TypeScript type guards from `lib/contracts/validations.ts`
- **No ORM** — use `dbQuery` from `lib/db/index.ts` with parameterised SQL
- **Context over props** — deep board components read from the 3 context hooks, not prop chains
- **Sub-components are pure** — entity card sub-components receive all data as typed props, no context reads
- **Explicit vitest imports** in all test files
- **`"use client"`** at the top of any component that uses React state, effects, or event handlers

---

## Agent instructions by area

Use these scoped reading lists to minimise context consumption when working on specific parts of the app.

### Adding a new feature module

Read first:
- `README.md` (module registration pattern)
- `lib/modules/types.ts` (AppModuleManifest shape)
- `lib/modules/registry.ts` (how modules are registered)
- `features/demo-module/` (copy as template)

### Extending the board — new entity type

Read first:
- `features/incident-workspace/lib/board/types.ts` (BoardEntity union type)
- `features/incident-workspace/components/board/boardCore.ts` (factory functions, serialisation)
- `features/incident-workspace/components/board/BoardEntityRenderer.tsx` (dispatcher)
- One existing card sub-component as reference (e.g. `NoteEntityCard.tsx`)
- `features/incident-workspace/components/board/useEntityCreation.ts` (add factory call here)

### Extending the board — new domain hook

Read first:
- `features/incident-workspace/components/board/useBoardRoom.ts` (coordinator — wire your hook here)
- The closest existing domain hook as reference (e.g. `useActionManager.ts`)
- `features/incident-workspace/components/board/BoardEntitiesContext.tsx` (if your hook's state needs to be context-accessible)

### Extending the board — new UI behaviour (keyboard, drag, etc.)

Read first:
- `features/incident-workspace/components/board/BoardShell.tsx` (see which hook family it belongs to)
- The relevant hook: `useKeyboardShortcuts.ts`, `useDragAndResize.ts`, `useConnectionFlow.ts`, `useEntityActions.ts`, or `useViewportNavigation.ts`

### Extending the board — new side panel or rail section

Read first:
- `features/incident-workspace/components/board/BoardSideRail.tsx`
- `features/incident-workspace/components/board/boardShellShared.ts` (RailPanel type)
- `features/incident-workspace/components/board/BoardShell.tsx` lines 560–610 (context assembly + JSX)

### API routes (case/board data)

Read first:
- `lib/auth/access.ts` (always use `requireApiCasePermissionByCaseId`)
- `lib/contracts/validations.ts` (use existing validators before adding new ones)
- An existing route as reference: `app/api/cases/[caseId]/records/route.ts`
- `lib/db/caseRecords.ts` (DB layer pattern)

### Database layer

Read first:
- `lib/db/index.ts` (`dbQuery`, `getDbPool`, `createSchemaGuard`)
- An existing db file as reference: `lib/db/datasources.ts` (shows full CRUD + schema guard pattern)

### Datasource integrations

Read first:
- `lib/datasources/types.ts` (StoredDatasourceInstallation, DatasourceConfigurationInput)
- `lib/db/datasources.ts` (storage layer)
- `features/integrations/components/DatasourceAdminPanel.tsx` (admin UI)
- `features/incident-workspace/components/board/DatasourceSearchPanel.tsx` (board-side query UI)

### Board canvas rendering / camera

Read first:
- `features/incident-workspace/components/board/boardCore.ts` (`screenToBoard`, `boardToScreen`, `clamp`)
- `features/incident-workspace/components/board/BoardCanvas.tsx`
- `features/incident-workspace/components/board/useViewportNavigation.ts`
- `features/incident-workspace/components/board/useDragAndResize.ts`

### Collab / Yjs sync

Read first:
- `features/incident-workspace/components/board/useYjsRoom.ts` (WebSocket + sync engine)
- `features/incident-workspace/components/board/boardCore.ts` (serialise/parse helpers)
- `features/incident-workspace/lib/board/types.ts` (all Yjs-serialised types)

### Writing tests for board components

Read first:
- `features/incident-workspace/components/board/__tests__/NoteEntityCard.test.tsx` (sub-component test pattern)
- `features/incident-workspace/components/board/__tests__/useActionManager.test.ts` (domain hook test pattern with real Y.Doc)
- `features/incident-workspace/components/board/__tests__/BoardSideRail.test.tsx` (component with mocked child imports)
- `vitest.config.ts` (jsdom environment, globals: true)

---

## What not to do

- Do not import `features/incident-workspace/` internals from any other feature module
- Do not add raw `fetch()` calls — use `apiRequest<T>()` from `lib/api/client.ts`
- Do not add inline validators in API routes — extend `lib/contracts/validations.ts`
- Do not write to `BoardCanvas` props for new board features — use context instead
- Do not put business logic in `app/` route files — keep them as thin mounters
- Do not use vitest globals without explicit imports in test files
