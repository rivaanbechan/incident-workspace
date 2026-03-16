# Incident Workspace Module

This directory contains the `incident-workspace` mini app.

If you are an AI agent or engineer working here, treat this as a self-contained feature module inside the larger app shell.

## What this module owns

This module owns the collaborative incident room experience:

- board canvas
- board entities
- incident log
- shared findings panel presentation
- LiveKit board integration
- board keyboard command layer

Primary entrypoints:

- [index.ts](/home/rivaan/dev/incident-workspace/features/incident-workspace/index.ts)
- [manifest.ts](/home/rivaan/dev/incident-workspace/features/incident-workspace/manifest.ts)
- [pages/IncidentWorkspaceRoomPage.tsx](/home/rivaan/dev/incident-workspace/features/incident-workspace/pages/IncidentWorkspaceRoomPage.tsx)

Important internals:

- [components/board/BoardShell.tsx](/home/rivaan/dev/incident-workspace/features/incident-workspace/components/board/BoardShell.tsx)
- [components/board/useBoardRoom.ts](/home/rivaan/dev/incident-workspace/features/incident-workspace/components/board/useBoardRoom.ts)
- [components/board/useBoardCommands.ts](/home/rivaan/dev/incident-workspace/features/incident-workspace/components/board/useBoardCommands.ts)
- [components/livekit/LiveSessionPanel.tsx](/home/rivaan/dev/incident-workspace/features/incident-workspace/components/livekit/LiveSessionPanel.tsx)
- [lib/board/types.ts](/home/rivaan/dev/incident-workspace/features/incident-workspace/lib/board/types.ts)

## Current UX model

This module is intentionally mixed-modality:

- mouse-first visual board by default
- optional keyboard command layer for power users
- collaborative room state through Yjs
- media/session behavior through LiveKit

Do not assume this is a pure text workflow. It is a visual collaborative workspace first.

## What lives outside this module on purpose

These are shared/platform concerns and should only be touched if the task truly requires it:

- thin route adapter in `app/board/[roomId]/page.tsx`
- shared contracts in `lib/contracts/`
- shared database helpers in `lib/db/`
- shell/module registry in `lib/modules/`

Examples:

- changing board entity rendering: stay in this module
- changing room artifact persistence schema: may require `lib/db/`
- changing module registration: requires `lib/modules/`

## Rules for working here

Prefer staying inside this feature unless the change is genuinely shared infrastructure.

Do:

- keep board logic inside `components/board/`
- keep LiveKit board behavior inside this module
- reuse existing room actions from `useBoardRoom`
- reuse existing command actions from `useBoardCommands`
- preserve collaborative behavior when changing UI

Do not:

- import private code from other feature modules
- move feature-specific logic into the shell
- couple this module directly to another module's internal components

If this module needs to exchange data with another module, use shared contracts and durable IDs instead of direct feature imports.

## Current important behaviors

- board entities are collaborative and stored in Yjs
- incident log entries are collaborative and stored in Yjs
- promoted findings are displayed in this module but persisted through shared storage
- screen-share tiles are created from LiveKit activity
- desktop keyboard shortcuts are optional accelerators, not the default interaction model

## Safe improvement areas

Good tasks to do entirely inside this module:

- board layout and usability
- new board entity affordances
- keyboard shortcuts and command UX
- incident log UX
- shared findings presentation
- LiveKit panel UX
- selection, focus, drag, resize, and camera behavior

Tasks that may require shared changes:

- new persistent artifact types
- cross-module handoff changes
- route contract changes
- shell-level navigation or module manifest changes

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
features/incident-workspace/
```

That is the intended module boundary.
