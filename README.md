# Incident Workspace App Shell

This repository is a modular Next.js app shell for security-focused mini apps.

The shell provides the shared platform:

- routing
- module discovery
- shared layout
- shared contracts
- Postgres-backed platform metadata
- realtime collaboration infrastructure

Each mini app is meant to be built as an isolated feature module, then plugged into the shell through a small manifest and route adapter.

## Current architecture

There are three layers in the repo.

### 1. App shell

The shell is responsible for composing modules, not owning their internals.

Key files:

- [app/page.tsx](/home/rivaan/dev/incident-workspace/app/page.tsx)
- [components/shell/AppShell.tsx](/home/rivaan/dev/incident-workspace/components/shell/AppShell.tsx)
- [lib/modules/types.ts](/home/rivaan/dev/incident-workspace/lib/modules/types.ts)
- [lib/modules/registry.ts](/home/rivaan/dev/incident-workspace/lib/modules/registry.ts)

The shell reads the registered module manifests and renders navigation and entry points from them.

### 2. Feature modules

Each mini app lives under `features/<module-id>/`.

Current modules:

- [features/incident-workspace](/home/rivaan/dev/incident-workspace/features/incident-workspace)
- [features/demo-module](/home/rivaan/dev/incident-workspace/features/demo-module)

Each module owns its own:

- pages
- components
- hooks
- feature-local libraries
- manifest

The shell should not reach into a module's private internals.

### 3. Shared platform infrastructure

Shared code that is intentionally cross-module lives outside features.

Key areas:

- [lib/contracts](/home/rivaan/dev/incident-workspace/lib/contracts)
- [lib/db](/home/rivaan/dev/incident-workspace/lib/db)
- [lib/modules](/home/rivaan/dev/incident-workspace/lib/modules)

Use these shared areas only for code that is truly platform-wide.

## Storage model

This app uses a layered storage design.

- `Postgres`: durable platform and app data
- `Yjs`: collaborative realtime state
- `LiveKit`: live media transport

Today, Postgres is already used for durable shell/module metadata. The intended direction is:

- Postgres for incidents, artifacts, saved views, module metadata, and durable records
- Yjs for collaborative documents and shared live state
- cross-module handoff through shared contracts, not direct feature imports

See:

- [PLATFORM_STORAGE.md](/home/rivaan/dev/incident-workspace/PLATFORM_STORAGE.md)
- [CROSS_MODULE_CONTRACTS.md](/home/rivaan/dev/incident-workspace/CROSS_MODULE_CONTRACTS.md)

## Directory shape

The repo is organized around a thin shell and self-contained modules.

```text
app/
  page.tsx
  demo-module/page.tsx
  board/[roomId]/page.tsx

components/
  shell/

features/
  incident-workspace/
  demo-module/

lib/
  contracts/
  db/
  modules/
```

The `app/` directory should stay thin. Route files there should mostly mount feature-owned pages.

## How a module works

Each module is registered through a manifest with this shape:

```ts
export type AppModuleManifest = {
  defaultHref: string
  description: string
  id: string
  routes: { href: string; label: string }[]
  title: string
}
```

The shell loads manifests from [registry.ts](/home/rivaan/dev/incident-workspace/lib/modules/registry.ts).

The normal pattern for a module is:

```text
features/
  your-module/
    index.ts
    manifest.ts
    pages/
      YourModulePage.tsx
    components/
    hooks/
    lib/
```

`index.ts` should export the manifest or module entrypoint used by the registry.

## How to add a module

### Option 1: build directly in this repo

1. Create `features/<module-id>/`.
2. Add `manifest.ts`.
3. Add `index.ts`.
4. Add a feature-owned page under `pages/`.
5. Add a thin route in `app/` that mounts that feature page.
6. Register the module in [registry.ts](/home/rivaan/dev/incident-workspace/lib/modules/registry.ts).
7. Run `npm run lint` and `npm run build -- --webpack`.

Example files to copy as a template:

- [features/demo-module/manifest.ts](/home/rivaan/dev/incident-workspace/features/demo-module/manifest.ts)
- [features/demo-module/index.ts](/home/rivaan/dev/incident-workspace/features/demo-module/index.ts)
- [features/demo-module/pages/DemoModulePage.tsx](/home/rivaan/dev/incident-workspace/features/demo-module/pages/DemoModulePage.tsx)
- [app/demo-module/page.tsx](/home/rivaan/dev/incident-workspace/app/demo-module/page.tsx)

### Option 2: build standalone first, then copy it in

1. Build the mini app in a separate Next.js project.
2. Keep the real feature code under `features/<module-id>/` in that standalone project.
3. Keep shell-specific code out of the standalone app.
4. Copy the feature folder into this repo's `features/`.
5. Add `manifest.ts`, `index.ts`, a thin `app/` route, and a registry entry.

Use these docs for that workflow:

- [STANDALONE_MINI_APP_STARTER.md](/home/rivaan/dev/incident-workspace/STANDALONE_MINI_APP_STARTER.md)
- [STANDALONE_DB_MINI_APP_TEMPLATE.md](/home/rivaan/dev/incident-workspace/STANDALONE_DB_MINI_APP_TEMPLATE.md)
- [MINI_APP_WORKFLOW.md](/home/rivaan/dev/incident-workspace/MINI_APP_WORKFLOW.md)

## How to delete a module

To remove a module cleanly:

1. Delete its thin route from `app/`.
2. Remove its export/import from [registry.ts](/home/rivaan/dev/incident-workspace/lib/modules/registry.ts).
3. Delete its feature folder under `features/<module-id>/`.
4. Remove any module-specific docs if they exist.
5. If it created durable database records or migrations, remove or deprecate those intentionally rather than leaving orphaned state.
6. Run `npm run lint` and `npm run build -- --webpack`.

In practice, the minimum code removal is:

- delete `features/<module-id>/`
- delete its `app/.../page.tsx`
- remove it from [registry.ts](/home/rivaan/dev/incident-workspace/lib/modules/registry.ts)

## Rules that keep modules from getting tangled

- Do not import one module's private files from another module.
- Put cross-module types in [lib/contracts](/home/rivaan/dev/incident-workspace/lib/contracts).
- Put shared storage helpers in [lib/db](/home/rivaan/dev/incident-workspace/lib/db).
- Keep `app/` thin.
- Keep shell concerns in the shell, not inside modules.
- Keep module internals inside `features/<module-id>/`.

If a module needs to hand off data to another module, do it through shared contracts and durable IDs, not direct component imports.

## Running the app

For local Docker-based development:

```bash
docker compose up -d --build
```

For a production-style deployment behind HTTPS:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Useful commands:

```bash
npm run lint
npm run build -- --webpack
docker compose ps
```

## External case intake

The shared platform layer now includes a webhook for automatic case creation from upstream systems.

- route: `POST /api/webhooks/cases`
- purpose: create or reuse a durable case and linked room, then return the URLs
- idempotency key: `source.system + source.externalId`
- ownership: shared platform code, not the `cases` or `incident-workspace` modules

Configure:

- `CASE_WEBHOOK_SECRET`
- `APP_BASE_URL` for correct absolute URLs in webhook responses

Main local services:

- app: `http://localhost:3000`
- collab websocket: `ws://localhost:1234`
- LiveKit: `ws://localhost:7880`
- Postgres: `localhost:5432`

Production-style entrypoints:

- app: `https://$APP_DOMAIN`
- collab websocket: `wss://$COLLAB_DOMAIN`
- LiveKit signaling: `wss://$LIVEKIT_DOMAIN`
- LiveKit RTC: `7881/tcp` and `7882/udp`

See:

- [SELF_HOSTING.md](/home/rivaan/dev/incident-workspace/SELF_HOSTING.md)
- [SESSION_HANDOFF.md](/home/rivaan/dev/incident-workspace/SESSION_HANDOFF.md)

## Recommended reading order

If you are new to this repo, read these in order:

1. [README.md](/home/rivaan/dev/incident-workspace/README.md)
2. [MINI_APP_WORKFLOW.md](/home/rivaan/dev/incident-workspace/MINI_APP_WORKFLOW.md)
3. [PLATFORM_STORAGE.md](/home/rivaan/dev/incident-workspace/PLATFORM_STORAGE.md)
4. [CROSS_MODULE_CONTRACTS.md](/home/rivaan/dev/incident-workspace/CROSS_MODULE_CONTRACTS.md)

If you are building a mini app in another repo first, start with:

1. [STANDALONE_MINI_APP_STARTER.md](/home/rivaan/dev/incident-workspace/STANDALONE_MINI_APP_STARTER.md)
2. [STANDALONE_DB_MINI_APP_TEMPLATE.md](/home/rivaan/dev/incident-workspace/STANDALONE_DB_MINI_APP_TEMPLATE.md)
