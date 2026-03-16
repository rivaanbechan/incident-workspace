# Cases Module

This directory contains the `cases` mini app.

It owns the durable case index and read-heavy case detail workflow.

## What this module owns

- case list page
- case detail page
- case creation flow
- case metadata editing
- durable investigation overview and navigation
- archive and permanent delete actions

Primary entrypoints:

- [index.ts](/home/rivaan/dev/incident-workspace/features/cases/index.ts)
- [manifest.ts](/home/rivaan/dev/incident-workspace/features/cases/manifest.ts)
- [pages/CasesIndexPage.tsx](/home/rivaan/dev/incident-workspace/features/cases/pages/CasesIndexPage.tsx)
- [pages/CaseDetailPage.tsx](/home/rivaan/dev/incident-workspace/features/cases/pages/CaseDetailPage.tsx)

## What lives outside this module

- shared investigation contracts in `lib/contracts/`
- shared investigation persistence in `lib/db/investigations.ts`
- shared artifact persistence in `lib/db/artifacts.ts`
- thin route adapters in `app/cases/...`
- module registry in `lib/modules/registry.ts`

## Working rules

- keep case UI inside this module
- keep durable investigation schema in shared platform code
- deep-link to workspace and other apps rather than importing their internals
- treat the detail page as read-heavy, not a second live workspace
- keep aggregate reads based on shared durable records, not room component state

## Current architectural rule

- `cases` owns the durable investigation index
- `incident-workspace` owns live collaboration in the linked room
- shared `lib/` code owns the actual investigation records and aggregate reads
