# Collaborative Hunt Graph Module

This directory contains the `collab-hunt-graph` mini app.

If you are an AI agent or engineer working here, treat this as a self-contained feature module inside the larger app shell.

## What this module owns

This module owns the collaborative hunt graph experience:

- room-scoped graph page
- Sigma.js graph rendering
- datasource adapter contract and module-local adapter registry
- shared graph room state through Yjs
- saved graph views
- graph-side promotion of findings into shared room artifacts

Primary entrypoints:

- [index.ts](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/index.ts)
- [manifest.ts](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/manifest.ts)
- [pages/HuntGraphRoomPage.tsx](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/pages/HuntGraphRoomPage.tsx)

Important internals:

- [components/HuntGraphRoomClient.tsx](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/components/HuntGraphRoomClient.tsx)
- [hooks/useHuntGraphRoom.ts](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/hooks/useHuntGraphRoom.ts)
- [lib/adapters.ts](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/lib/adapters.ts)
- [lib/storage.ts](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/lib/storage.ts)
- [lib/types.ts](/home/rivaan/dev/incident-workspace/features/collab-hunt-graph/lib/types.ts)

## Current UX model

This module is a collaborative investigation surface, not a generic graph demo.

Current behavior:

- room-scoped graph sessions
- shared pins, notes, filters, and graph data
- local-only transient behavior like camera interaction
- saved views persisted in Postgres
- graph findings can be promoted into the incident workspace through shared artifacts

Do not optimize only for “cool graph visuals.” The useful product behavior is shared investigation and handoff.

## What lives outside this module on purpose

These are shared/platform concerns and should only be touched if the task truly requires it:

- thin route adapter in `app/hunt/[roomId]/page.tsx`
- thin API routes in `app/api/hunt/...`
- shared contracts in `lib/contracts/`
- shared database helpers in `lib/db/`
- shell/module registry in `lib/modules/`

Examples:

- changing graph rendering or filters: stay in this module
- adding a new datasource adapter: stay in this module
- changing shared artifact contract shape: may require `lib/contracts/`
- changing shared artifact persistence: may require `lib/db/`

## Rules for working here

Prefer staying inside this feature unless the change is genuinely shared infrastructure.

Do:

- keep graph behavior inside this module
- keep datasource adapter logic inside `lib/adapters.ts` or nearby feature-local files
- preserve the room-scoped collaboration model
- preserve the saved-view model unless the task explicitly changes it
- use shared contracts for cross-module handoff

Do not:

- import private code from `incident-workspace`
- couple the graph directly to another module’s internal UI
- move graph-specific logic into the shell

If this module needs to hand off findings to another module, do it through durable artifacts and shared contracts, not direct feature imports.

## Current important behaviors

- the graph is room-scoped by `roomId`
- graph collaboration state uses Yjs
- saved graph views use Postgres
- the adapter contract is module-local and intentionally pluggable
- the current adapter is mocked/local and meant to be replaced or supplemented
- graph promotion into the incident workspace uses shared room artifacts

## Safe improvement areas

Good tasks to do entirely inside this module:

- graph rendering and layout quality
- Sigma.js interaction behavior
- filters, notes, and selection UX
- saved-view UX
- adapter registry improvements
- real datasource adapter implementations
- graph command/interaction improvements

Tasks that may require shared changes:

- changing cross-module artifact handoff
- changing shared artifact schema
- changing route contract or deep-link contract
- changing shell/module manifest behavior

## Validation

After changes affecting this module, usually run:

```bash
npm run lint
npm run build -- --webpack
docker compose up -d --build app
```

## Working assumption for agents

Unless the task clearly requires shared infrastructure, assume you should solve it by editing only files under:

```text
features/collab-hunt-graph/
```

That is the intended module boundary.
