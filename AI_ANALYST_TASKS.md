# AI Analyst Integration — MVP

**MVP goal:** Analyst selects an entity → invokes the L1 agent → agent calls VirusTotal → reasoning entity streams onto the canvas → analyst accepts or dismisses proposed entities.

That loop, end to end, working reliably. Nothing else ships in MVP.

**Module structure:**
```
lib/ai/
  ollama.ts              ← Raw Ollama HTTP client. Pure infrastructure.
  concurrency.ts         ← Per-datasource concurrency counter.

features/integrations/   ← Ollama and VirusTotal registered as datasources.

features/agents/
  lib/
    agentPrompts.ts      ← Prompt composition and output format injection
    boardContext.ts      ← focused_entity scope serialisation
    agentTools.ts        ← AgentTool interface
    toolRegistry.ts      ← Resolves agent tool IDs to AgentTool instances
  components/
    AgentAdminPanel.tsx
    ReasoningEntityCard.tsx
    GhostEntityCard.tsx
  pages/
    AgentsPage.tsx

features/incident-workspace/  ← Board calls into features/agents/ for invocation.
                                 No agent logic lives here.
```

**Status legend:** `[ ]` pending · `[x]` completed · `[-]` in progress

---

## Phase 1 — Ollama and VirusTotal as Datasources

Get the two infrastructure pieces registered before any agent logic is written.

- [ ] **Ollama HTTP client in `lib/ai/ollama.ts`**
  Implements `generate(prompt, options): AsyncIterable<string>` for streaming and `listModels(): Promise<string[]>` for the admin UI. Calls `/api/chat` and `/api/tags`. No agent logic here — pure HTTP.

- [ ] **Add `llm` category to `lib/datasources/types.ts`**
  `LLMDatasource` variant: `baseUrl`, `defaultModel`, `supportsToolCalling` (boolean, set by admin), `maxConcurrent` (integer, default 1). No auto-detection — admin checks whether their model supports tool calling and sets the flag manually. Store in the existing `datasources` table.

- [ ] **Register Ollama as an LLM datasource in `features/integrations/`**
  Follow the existing integration pattern. Config fields: base URL (default `http://localhost:11434`), model name (free text — admin types it), `supportsToolCalling` toggle, `maxConcurrent` (integer, default 1). `maxConcurrent` is the number of simultaneous invocations allowed against this Ollama instance across all rooms and all users. Admins who know their hardware can raise it — a dedicated GPU server running `OLLAMA_NUM_PARALLEL=2` can handle more than a laptop can. Appears in the datasource admin panel under a new "AI / LLM" section. Test connection button verifies reachability.

- [ ] **Define `AgentTool` interface in `features/agents/lib/agentTools.ts`**
  Defined here in Phase 1 so enrichment datasources can implement it before any agent logic exists.
  ```ts
  interface AgentTool {
    id: string
    name: string
    description: string
    supportedEntityKinds: EntityKind[]
    execute(entityKind: string, entityValue: string): Promise<EnrichmentResult>
  }

  type EnrichmentResult = {
    title: string
    summary: string
    verdict: "malicious" | "benign" | "unknown"
    payload: Record<string, unknown>
  }
  ```

- [ ] **Add `enrichment` category to `lib/datasources/types.ts`**
  `EnrichmentDatasource` variant — a stored config shape (what lives in the DB): `id`, `orgId`, `apiKey`, `category: "enrichment"`, etc. This is not the same as `AgentTool`. The integration class (e.g. `VirusTotalIntegration`) implements `AgentTool` at runtime; the stored config is what `toolRegistry.ts` uses to instantiate it. Stored in the same `datasources` table.

- [ ] **Register VirusTotal as an enrichment datasource in `features/integrations/`**
  `VirusTotalIntegration` class implements `AgentTool`. Supports `ip`, `domain`, `hash` entity kinds. Calls the appropriate VirusTotal v3 endpoint per kind. Returns: reputation score, malware family tags, community score, vendor verdicts. Config fields: API key. Appears in the datasource admin panel under a new "Enrichment" section. Registers itself in the integration registry so `toolRegistry.ts` can look it up by datasource category.

- [ ] **Write tests for the Ollama client**
  Mock the Ollama HTTP API. Test streaming output, model listing, and connection failure.

- [ ] **Write tests for the VirusTotal integration**
  Mock VirusTotal v3 API responses for each supported entity kind. Test verdict mapping and error handling (rate limit, not found, invalid key).

---

## Phase 2 — Agent Definition and Admin

The minimum admin surface to create and configure an agent.

- [ ] **Create `features/agents/lib/toolRegistry.ts`**
  `getToolsForAgent(agentId): AgentTool[]` — loads the agent's configured tool IDs, fetches the corresponding `EnrichmentDatasource` configs from the DB, looks up the matching integration class in the integration registry (e.g. `VirusTotalIntegration` for category `"virustotal"`), and instantiates each class with its stored config to produce a live `AgentTool`. Returns an empty array (not an error) if no tools are configured or a tool ID no longer exists.

- [ ] **Define `Agent` type in `lib/contracts/agents.ts`**
  Fields: `id`, `orgId`, `name`, `personaPrompt`, `tools` (array of enrichment datasource IDs), `llmDatasourceId`, `modelId`, `createdAt`, `updatedAt`.

- [ ] **DB migration: create `agents` table**
  Columns: `id`, `org_id`, `name`, `persona_prompt`, `tools` (JSONB), `llm_datasource_id`, `model_id`, `created_at`, `updated_at`. Follow the existing numbered migration convention.

- [ ] **Create `lib/db/agents.ts`**
  CRUD: `createAgent`, `getAgentById`, `listAgentsByOrg`, `updateAgent`, `deleteAgent`. Schema guard included. Follows existing `lib/db/datasources.ts` pattern.

- [ ] **API routes for agent CRUD**
  `GET / POST /api/agents` — list and create.
  `GET / PATCH / DELETE /api/agents/[agentId]` — individual operations.
  All routes require org admin permission.

- [ ] **Create `features/agents/components/AgentAdminPanel.tsx`**
  List existing agents. Create/edit form: name, persona prompt textarea (pre-filled with the L1 enrichment persona below), tool selection (multi-select from configured enrichment datasources), LLM datasource selector, model name field. Delete with confirmation.

  Pre-fill the persona prompt with:
  ```
  You are an L1 security analyst. Your job is to enrich the provided indicator of compromise
  using the available tools and deliver a clear verdict with your reasoning.
  Call each relevant tool, then summarise what you found. Be concise and direct.
  State your confidence level (high / medium / low) and your verdict (malicious / benign / unknown).
  ```
  Admin owns this prompt entirely and can edit it freely.

- [ ] **Create `features/agents/pages/AgentsPage.tsx`**
  Admin page for managing agents. Mounted at `/agents`. Only accessible to org admins.

- [ ] **Write tests for agent CRUD routes**
  Test list, create, get, update, delete. Test that non-admin requests are rejected.

- [ ] **Write tests for `toolRegistry.ts`**
  Verify correct resolution of tool IDs, empty array on missing tools, no error on deleted datasource.

---

## Phase 3 — Invocation and Canvas Flow

The core loop. This is the only thing that matters for the MVP.

### Board type extensions

These must land before any canvas rendering work. They touch `features/incident-workspace/`.

- [ ] **Add `reasoning` and `ghost` entity variants to `lib/board/types.ts`**
  `ReasoningEntity` fields: `agentId`, `agentName`, `invokingUserId`, `focusEntityId`, `narrative` (`Y.Text` — not a plain string, see below), `toolCallSummary`, `status` (`running` | `complete` | `cancelled` | `error`).
  `GhostEntity` fields: `reasoningEntityId`, `proposedKind`, `label`, `summary`, `invokingUserId`.
  Add `derived_from` to the connection kind union.

  **Use `Y.Text` for `narrative`.** Appending to a plain string in Yjs requires replacing the entire value on each token, which is inefficient and can produce merge conflicts if updates race. `Y.Text` supports efficient character-level appending and is the correct Yjs primitive for streaming text. The `ReasoningEntityCard` reads it via `.toString()` and re-renders as it grows.

  **Ghost entities are not written to the Yjs doc.** They are local React state for the invoking analyst only, managed by the SSE consumer hook. On accept they become real board entities in Yjs. This avoids multi-user ghost sync complexity entirely in MVP.

- [ ] **Add factory functions and serialisers to `boardCore.ts`**
  `createReasoningEntity(agentId, agentName, invokingUserId, focusEntityId, position)` — status `running`.
  Add `derived_from` to the connection serialiser. Ghost entities need no serialiser — they are local state only.

- [ ] **Wire `reasoning` type into `BoardEntityRenderer.tsx`**
  Dispatch to `ReasoningEntityCard.tsx` in `features/agents/components/`. This is the only import that crosses the boundary from `features/incident-workspace/` into `features/agents/` and is intentional.

### Context and prompt

- [ ] **Implement `focused_entity` scope in `features/agents/lib/boardContext.ts`**
  `serialiseBoardForScope(focusEntityId, entities, connections)` — returns the selected entity serialised as structured text the model can read. Cap at ~2 000 tokens. This is the only scope needed for MVP — the architecture accommodates more later but do not build them now.

- [ ] **Implement prompt composition in `features/agents/lib/agentPrompts.ts`**
  `buildSystemPrompt(agent, tools, boardContext)` — assembles: agent's persona prompt + available tool descriptions + serialised board context + the non-negotiable output format instruction appended last:
  ```
  When proposing changes to the investigation board, output a JSON block
  tagged ```actions with an array of {type, label, summary} objects.
  All other output is free-form narrative.
  ```

### Invocation route and streaming

- [ ] **Datasource concurrency guard in `lib/ai/concurrency.ts`**
  In-memory `Map<datasourceId, number>` tracking active invocations per LLM datasource. `acquire(datasourceId, max): boolean` — increments the counter and returns `true` if the new count is within `max`, returns `false` otherwise. `release(datasourceId)` — decrements on stream end, error, or cancel. Must be called in a `finally` block to guarantee release. This module is the single source of truth for datasource-level concurrency across all rooms and all users.

- [ ] **Agent invocation API route**
  `POST /api/cases/[caseId]/agents/[agentId]/invoke`
  Required permission: case write access (not admin-only — any analyst with write access can invoke).
  Request body: `{ focusEntity: BoardEntity }` — the client sends the full entity object it already has from context. The route does not read board state from the DB or from Yjs; it receives what it needs to serialise from the client. This keeps the route stateless and avoids any server-side Yjs access.
  Flow: load agent → acquire datasource concurrency slot (`acquire(agent.llmDatasourceId, datasource.maxConcurrent)`) → if acquire returns `false`, return 409 `{ error: "model is at capacity — try again shortly" }` → validate request body → serialise `focusEntity` into board context → resolve tools → build system prompt → call Ollama → stream response back to client via SSE → `release()` in finally. If `supportsToolCalling` is true on the model, use the Ollama `/api/chat` `tools` array; otherwise fall back to prompt-based tool calling. Either way, collect tool results, append them, and call Ollama again until the model produces a final text response.

- [ ] **SSE consumer hook `useAgentInvocation.ts` in `features/agents/lib/`**
  `useAgentInvocation({ createEntity, createConnection, yDoc })` — accepts injected callbacks rather than importing board hooks directly. `createEntity` and `createConnection` are passed in by the board component that mounts this hook, wired from `useEntityManager` and `useConnectionManager`. This keeps `features/agents/` decoupled from `features/incident-workspace/` internals.
  Calls the invocation route and consumes the SSE stream. As narrative tokens arrive, appends them to the reasoning entity's `Y.Text` narrative field via `yDoc`. As `actions` JSON blocks are parsed from the stream, adds proposed entities to local React state (not Yjs). Exposes `{ status, ghostEntities, invoke, cancel }`. `cancel()` closes the SSE connection, sets the reasoning entity status to `cancelled` in Yjs (so all participants see it), and clears all pending ghost entities from local state. The concurrency slot releases automatically via the `finally` block in the invocation route.

  **Buffer the stream when parsing `actions` blocks.** The closing triple-backtick of an `actions` block will often arrive in a later SSE event than the opening one. Maintain a rolling string buffer across events. When the buffer contains a complete ` ```actions ... ``` ` block, parse it and flush the ghost entities. Append everything outside `actions` blocks to the narrative `Y.Text` as it arrives. Include error recovery for malformed JSON — if parsing fails, treat the block as narrative text rather than crashing.

- [ ] **"Ask Agent" button in `EntitySelectionPanel`**
  Only shown when the selected entity's kind is in the union of `supportedEntityKinds` across all of the agent's configured tools. If no configured agent supports the selected entity kind, the button is hidden entirely — not disabled, hidden. Showing it for unsupported entity kinds (notes, zones) would be misleading.

  **Single agent:** button reads "Ask [Agent Name]" and invokes immediately on click.

  **Multiple agents:** button reads "[Last Used Agent Name] ▾" and invokes the last-used agent immediately on click. A dropdown chevron opens a list of all configured agents that support the current entity kind. Selecting from the dropdown updates the last-used agent and invokes immediately — selection and invocation are one action, no extra confirmation. Last-used agent stored in `localStorage` keyed by `orgId`. On first use with no history, default to the first agent in the list.

  **Two-layer concurrency UX:**
  1. If any `reasoning` entity with `status === "running"` exists in the current room's Yjs doc, disable the button with label "Agent running…". Derived from Yjs state — no extra mechanism needed.
  2. If the datasource is at capacity (another room is using it), the server returns 409. Show a toast ("model is at capacity — try again shortly"), do not create a reasoning entity, re-enable the button immediately.

### Canvas rendering

- [ ] **`ReasoningEntityCard.tsx` in `features/agents/components/`**
  Renders the reasoning entity on the canvas. Collapsed default: agent name, status indicator, tool call summary. Expanded: full streaming narrative. Collapses and expands on click. While `status === "running"`, narrative appends in real time. Visually distinct from analyst-created entities — clear AI origin styling.

  **Cancel button:** while `status === "running"`, render a small Cancel button on the card. Only the invoking analyst sees it (compare `invokingUserId` against the current user). Clicking it calls `cancel()` from `useAgentInvocation`. On cancel: the SSE connection closes, the reasoning entity status transitions to `cancelled` in Yjs (visible to all participants), and all pending ghost entities are cleared from local state. The concurrency slot is released via the `finally` block in the invocation route — no extra client action needed for that.

- [ ] **`GhostEntityCard.tsx` in `features/agents/components/`**
  Renders proposed entities as local preview cards (muted style, dashed border) with Accept and Dismiss buttons. Only rendered for the invoking analyst.

  **Ghost entities need a canvas overlay rendering path.** Because they are local React state and not in the Yjs doc, they cannot go through `BoardEntityRenderer` (which dispatches from Yjs entities only). Instead, render them in a `<div>` overlay that sits above the canvas, positioned using the same camera transform used by the board (`boardToScreen` from `boardCore.ts`). Each ghost entity has a board-space position (computed relative to the reasoning entity at spawn time); apply the current camera to convert to screen coordinates. The board component that holds `useAgentInvocation` state is responsible for rendering this overlay — `GhostEntityCard` is the card component it renders within it.

### Accept and dismiss

Accept and dismiss are client-side operations only — no API routes needed. Board entity creation in this codebase is a client-side Yjs write via the domain hooks in `useBoardRoom`; API routes do not write to Yjs. Introducing routes here would add a layer that doesn't exist anywhere else in the board.

- [ ] **Accept handler in `useAgentInvocation.ts`**
  `accept(ghost)` — calls the injected `createEntity` callback with the ghost's `proposedKind`, `label`, and `summary` (same as any analyst-created entity). Then calls the injected `createConnection` callback to add a `derived_from` connection from the new entity to the reasoning entity. Removes the ghost from local state.

- [ ] **Dismiss handler in `useAgentInvocation.ts`**
  `dismiss(ghost)` — removes the ghost from local state. Appends a short note to the reasoning entity's `Y.Text` narrative: `"Dismissed: [label]"`. No API call, no persistence beyond the Yjs doc.

- [ ] **Reasoning entity spawns at a sensible position**
  Offset 280px to the right of the focus entity. Ghost entities cluster below the reasoning entity. Uses the same placement logic as existing entity creation (see `useEntityCreation.ts`).

- [ ] **Timeline entry on invocation complete**
  When the reasoning entity transitions to `complete` or `error`, write a timeline entry via `useTimelineManager`: agent name, invoking analyst, focus entity label, number of proposals accepted vs total.

### Tests

- [ ] **Write tests for prompt composition**
  Verify output format instruction is always appended last. Verify tool descriptions are injected. Verify `focused_entity` scope returns only the focus entity.

- [ ] **Write tests for the invocation route**
  Mock Ollama and VirusTotal. Test: context serialised → tools called → SSE stream returned. Test that non-write-access requests are rejected.

- [ ] **Write tests for `useAgentInvocation.ts`**
  Test the SSE stream buffer: narrative tokens appended correctly to `Y.Text`; `actions` block split across multiple SSE events parsed as a single complete block; malformed JSON in an `actions` block falls back to narrative text. Test accept: entity created with correct kind/label and `derived_from` connection added. Test dismiss: ghost removed from state, dismissal note appended to narrative.

---

## Deferred — Not MVP

These are deliberately out of scope. Do not build them now.

| Item | Why deferred |
|---|---|
| Additional context scopes (`entity_neighbourhood`, `hypothesis_set`, `recent_timeline`, `full_board`) | Only needed for templates that aren't shipping in MVP |
| Hypothesis Analyst, Threat Intel Summariser, Shift Handoff Writer, Custom templates | Local 7-8B model quality doesn't reliably support these use cases yet; L1 enrichment is the mechanically sound starting point |
| Agent template selector and "reset to template" in admin UI | One template in MVP — selector adds complexity for no benefit |
| AbuseIPDB, GreyNoise integrations | VirusTotal validates the pattern; add more integrations post-MVP |
| Ghost entities visible to all participants (multi-user) | Ghost entities are local state in MVP; add Yjs sync post-MVP once the flow is proven |
| Agent running indicator for other participants | Follows from multi-user ghost sync |
| Agent hotkey | Polish; add in post-MVP pass |
| IOC auto-detection | Standalone feature; not a dependency for the core loop |
| Enrichment result caching | Premature optimisation for MVP |
| Token usage monitoring and truncation warnings | Polish; add when context limits become a real problem |
| Queue for capacity-limited requests | Disabled button + 409 toast is sufficient UX; a queue adds complexity with little benefit for local LLM usage patterns |
| Ollama connection status indicator in board UI | Nice-to-have; not blocking the core loop |
| MCP bridge | Future extension point; do not design for it yet |

---

## File Size and Structure Rules

**No file should exceed 300 lines.** If a file is approaching this during implementation, stop and extract before continuing. This is a hard rule, not a soft guideline.

**One responsibility per file.** DB queries in one file, business logic in another, UI in another. If you find yourself writing "and also..." when describing what a file does, split it.

**A task is not complete if it produces a file over 300 lines.** Extraction is part of the task.

---

## Coding Standards

- **shadcn/ui for all UI primitives.** No raw `<button>` or `<input>` elements in new components.
- **Tailwind for layout and spacing.** No inline styles in agent feature components.
- **`apiRequest<T>()` for all client-side API calls.** No raw `fetch()`.
- **No Zod, no ORM.** Type guards from `lib/contracts/validations.ts`, raw SQL via `dbQuery`.
- **Explicit vitest imports.** `import { describe, it, expect, vi } from "vitest"` in every test file.
- **Check `components/shell/` first** before building any new UI element.

---

## Key Architectural Decisions

**Ghost entities are local state in MVP.** They live in the invoking analyst's React state, not the Yjs doc. On accept they are written to Yjs as real entities. This sidesteps multi-user sync complexity. If the UX is validated, promote them to Yjs in a post-MVP iteration.

**One context scope for MVP.** `focused_entity` only. The architecture in `boardContext.ts` can accommodate more scopes later — just don't build what isn't needed yet.

**One template, fully editable.** Ship a single L1 enrichment persona pre-fill. No template system, no template selector. Admin edits the prompt directly. Add template infrastructure when there are multiple templates worth shipping.

**Local LLMs only.** No cloud LLM API calls. Incident data stays in the environment. Non-negotiable.

**Ollama is a datasource.** Configured and stored exactly like Splunk or VirusTotal. An agent references it by `llmDatasourceId`. This means other local LLM providers can be added later without changing the agent model.
