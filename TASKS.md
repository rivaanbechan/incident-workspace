# Product Task List

Each task is self-contained and designed to be picked up independently by an agent or developer.
Before starting any task, read the relevant section of `CLAUDE.md` to scope your context.

---

## TASK-001 — Enable voice (audio) in live sessions

**Status:** Done
**Area:** `features/incident-workspace/components/livekit/LiveSessionPanel.tsx`

**Context:**
LiveKit is integrated and used for screen sharing, but `LiveKitRoom` is mounted with `audio={false}` on both connection paths (inline trigger and panel). `RoomAudioRenderer` is already in the component tree and will play back audio once publishing is enabled.

**What to build:**
- Change `audio={false}` to `audio={true}` on both `LiveKitRoom` mounts
- Add a mute/unmute toggle button in the live session panel UI
- Show a visual indicator (e.g. coloured dot or mic icon) next to presence avatars in the board header when a participant is speaking — LiveKit provides `useIsSpeaking` for this
- Update the tooltip/description text in the panel to mention voice

**Files to read first:**
- `features/incident-workspace/components/livekit/LiveSessionPanel.tsx`
- `features/incident-workspace/components/board/BoardHeader.tsx` (presence avatar rendering)

---

## TASK-002 — Incident intake via webhook (PagerDuty / OpsGenie / generic)

**Status:** Not started
**Area:** `app/api/webhooks/`, `features/incident-workspace/`

**Context:**
Currently incidents are created manually. Teams need incidents to be created automatically when an alert fires in their alerting tool, so responders can join immediately without friction.

**What to build:**
- A new API route `app/api/webhooks/incident/route.ts` that accepts a POST with a signed payload
- Validate the request using `CASE_WEBHOOK_SECRET` (already in env)
- Parse the payload into an incident title, severity, and source (support a generic schema; PagerDuty and OpsGenie can be added as named variants)
- Create a new case/room using the existing DB layer (`lib/db/investigations.ts`)
- Return the new room URL so the caller can post it to Slack/Teams
- Add a `POST /api/webhooks/incident` entry to `CLAUDE.md` under shared infrastructure

**Files to read first:**
- `lib/auth/access.ts` (webhook secret validation pattern)
- `lib/db/investigations.ts`
- `app/api/cases/[caseId]/records/route.ts` (existing route pattern)

---

## TASK-003 — Slack notification on incident creation

**Status:** Not started
**Area:** `lib/integrations/slack.ts` (new), `features/incident-workspace/`

**Context:**
When an incident room is created (manually or via webhook), responders need to be notified. Slack is the most common channel for this. This task adds an outbound Slack webhook notification when a room is created.

**What to build:**
- Add `SLACK_WEBHOOK_URL` to env (optional — skip silently if not set)
- Create `lib/integrations/slack.ts` with a `postIncidentCreated({ title, severity, roomUrl })` helper that POSTs to the Slack incoming webhook
- Call it from the incident creation flow
- Message should include: incident title, severity, a direct link to the board room, and the creating user's name

**Files to read first:**
- `lib/db/investigations.ts` (where rooms are created)
- `features/incident-workspace/pages/IncidentWorkspaceRoomPage.tsx`

---

## TASK-004 — In-board "page someone in" action

**Status:** Not started
**Area:** `features/incident-workspace/components/board/BoardSideRail.tsx`

**Context:**
During an incident, the IC needs to pull in subject matter experts. Currently there's no way to do this from within the board — you have to switch to Slack. This task adds a simple "page someone" panel to the side rail that sends a notification to a user.

**What to build:**
- New rail panel tab "Page In" in `BoardSideRail`
- Search/select users from the org (use existing org member API or add one)
- Sends them an in-app notification (toast + persisted) with a direct link to the board
- Optionally send a Slack DM if `SLACK_WEBHOOK_URL` or a bot token is configured
- The notification should appear as a toast for the recipient if they're already in the app (the `useNotifications` hook already handles task assignment toasts — extend this pattern)

**Files to read first:**
- `features/incident-workspace/components/board/BoardSideRail.tsx`
- `features/incident-workspace/components/board/boardShellShared.ts` (RailPanel type)
- `features/incident-workspace/components/board/useNotifications.ts`
- `features/incident-workspace/components/board/BoardShell.tsx` lines 560–610 (context assembly)

---

## TASK-005 — Post-incident review (PIR) workflow

**Status:** Not started
**Area:** `features/incident-workspace/`, `lib/db/`

**Context:**
After an incident is resolved, teams need to run a post-incident review. The board already captures a timeline, action items, roles, and case records — all the raw material for a PIR. This task adds a structured PIR export/page.

**What to build:**
- A "Close Incident" button on the board that transitions the incident to `resolved` status
- A PIR page at `app/cases/[caseId]/review/page.tsx` that renders a structured report:
  - Incident summary (title, severity, duration, roles)
  - Timeline of events (from `incidentLog`)
  - Action items and their status
  - Promoted case records (evidence, findings)
- A "Export as Markdown" button that generates a copy-pasteable PIR document
- Store `resolvedAt` timestamp on the case record

**Files to read first:**
- `lib/db/investigations.ts`
- `lib/db/caseRecords.ts`
- `features/incident-workspace/components/board/BoardSideRail.tsx` (where a "close" action could live)
- `features/incident-workspace/lib/caseRecordPromotion.ts`

---

## TASK-006 — Incident search and history page

**Status:** Not started
**Area:** `features/incident-workspace/pages/`, `lib/db/investigations.ts`

**Context:**
Once incidents are resolved there's no way to browse or search past incidents. Teams need this for follow-up, audits, and learning from previous events.

**What to build:**
- An incident history page at `app/cases/page.tsx` (or extend the existing cases list if one exists)
- Search by title, date range, severity, and status (open / resolved)
- Each row links to the board room and (once TASK-005 is done) the PIR page
- Pagination — don't load all cases at once
- Add a `status` and `resolvedAt` column to the investigations table if not present

**Files to read first:**
- `lib/db/investigations.ts`
- `lib/db/index.ts` (`dbQuery` pattern)
- `lib/auth/access.ts`

---

## TASK-007 — Runbook / playbook support

**Status:** Not started
**Area:** `lib/db/runbooks.ts` (new), `features/incident-workspace/components/board/BoardSideRail.tsx`

**Context:**
Teams follow predefined runbooks during incidents (e.g. "database outage runbook", "payment failure runbook"). Right now there's no way to attach a runbook to an incident or track progress through it.

**What to build:**
- A `runbooks` table: `id`, `org_id`, `title`, `steps` (JSONB array of `{ id, label, done }`), `created_at`
- CRUD API routes under `app/api/runbooks/`
- A runbook admin page where runbooks can be created/edited
- A "Runbooks" panel in the board side rail that lets the IC attach a runbook to the current incident and check off steps in real time (steps stored in Yjs `metaMap` so all participants see progress)

**Files to read first:**
- `lib/db/datasources.ts` (full CRUD + schema guard pattern to copy)
- `features/incident-workspace/components/board/BoardSideRail.tsx`
- `features/incident-workspace/components/board/boardShellShared.ts`
- `features/incident-workspace/components/board/useRoomMeta.ts` (metaMap pattern)

---

## TASK-008 — Deeper datasource integrations (Datadog, CloudWatch)

**Status:** Not started
**Area:** `lib/datasources/`, `features/incident-workspace/components/board/DatasourceSearchPanel.tsx`

**Context:**
The datasource framework exists and the board has a search panel. During an incident, engineers need to query logs and metrics without leaving the board. This task adds Datadog and CloudWatch as first-class datasource types.

**What to build:**
- `lib/datasources/datadog/index.ts` — queries Datadog Logs API and Metrics API; returns structured results
- `lib/datasources/cloudwatch/index.ts` — queries CloudWatch Logs Insights; returns structured results
- Register both in the datasource type registry
- Update `DatasourceSearchPanel` to render log results (timestamp + message rows) and basic metric sparklines
- Results should be pin-able to the board as a `note` entity with the query + result snippet embedded

**Files to read first:**
- `lib/datasources/types.ts`
- `lib/db/datasources.ts`
- `features/incident-workspace/components/board/DatasourceSearchPanel.tsx`
- `features/integrations/components/DatasourceAdminPanel.tsx`

---

## TASK-009 — SSO / SAML authentication

**Status:** Not started
**Area:** `lib/auth/`, `app/api/auth/`

**Context:**
Enterprise teams require SSO. next-auth v5 supports SAML/OIDC providers. This task adds an OIDC provider option (covers Okta, Azure AD, Google Workspace) and a SAML provider option.

**What to build:**
- Add OIDC provider to next-auth config (env-gated: `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET`)
- Add SAML provider support via `@auth/core` or a compatible SAML library
- On first SSO login, auto-provision the user into the org
- Document the env vars needed in `.env.example`

**Files to read first:**
- `lib/auth/` (entire directory)
- `app/api/auth/` (next-auth route handler)

---

## TASK-010 — Mobile read-only view

**Status:** Not started
**Area:** `features/incident-workspace/pages/`, `features/incident-workspace/components/`

**Context:**
The canvas board is desktop-only (pointer events, drag/resize). But on-call engineers who get paged at night need to at least see incident status, timeline, and action items on their phone. This task adds a mobile-optimised read-only summary view.

**What to build:**
- Detect mobile user agent on the board room page
- Render a mobile view instead of the canvas: incident summary card, live timeline feed, action items checklist, presence list (who's in the room)
- Real-time updates via the same Yjs connection (read-only: no entity creation, no drag)
- A "Switch to desktop" link at the bottom for when they're at a computer

**Files to read first:**
- `features/incident-workspace/pages/IncidentWorkspaceRoomPage.tsx`
- `features/incident-workspace/components/board/useBoardRoom.ts` (the data layer works on mobile — just the canvas UI doesn't)
- `features/incident-workspace/components/board/BoardEntitiesContext.tsx`
