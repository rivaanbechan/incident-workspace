# Plan: The Oracle — RAG Knowledge Base

## Overview

**The Oracle** is a two-surface RAG knowledge base for security analysts. ("The Oracle" is intentional — the definite article makes it a named concept, not a product, avoiding any confusion with Oracle Corporation.)

1. **Canvas promotion** — an analyst selects a board entity and promotes it to The Oracle in one click. Investigation findings flow into the knowledge base organically during active incidents.
2. **The Oracle Manager** (`/the-oracle`) — a standalone sidebar feature. Analysts browse, search, delete, re-embed, and upload markdown files directly into The Oracle — no canvas required.

Agents query The Oracle across all cases to surface related prior incidents and threat intelligence during live investigations.

---

## Guiding principles

- **User-curated, not bulk-ingested.** Analysts decide what is worth indexing. Quality over volume.
- **Update in place.** Re-promoting the same entity overwrites the existing Qdrant point (keyed on `entityId`). Latest version always wins, no bloat.
- **Two ingestion paths, one storage layer.** Canvas promotion and direct markdown upload both write to the same Qdrant collection via the same ingestion lib. The Oracle Manager reads and manages both equally.
- **Capability tied to configuration.** Oracle features are only active when the Ollama datasource has Oracle enabled and the embed model is confirmed present. No silent failures.
- **No new UI libraries.** shadcn/ui + Tailwind only.

---

## Architecture overview

```
Canvas promotion path:
  Analyst selects entity → "Add to Oracle"
    └─ useCasePromotion.promoteToOracle(entity)
         └─ POST /api/cases/[caseId]/entities/[entityId]/promote-to-oracle
              ├─ extractChunk(entity) → { title, body }
              ├─ embed(title + "\n" + body)   ← lib/ai/ollama.ts
              ├─ upsert to Qdrant             ← lib/qdrant/client.ts
              └─ return { pointId }
                   └─ entity.oracleIndexed = true written to Yjs map
                        └─ "Oracle" badge renders on canvas card (persists across refresh)

Direct upload path:
  Analyst drops .md file in Oracle Manager → Upload tab
    └─ parseMarkdown(file) → chunks[] (split on ## headings)
         └─ POST /api/oracle/entries (one request per chunk)
              ├─ embed(title + "\n" + body)
              ├─ upsert to Qdrant (UUID as point ID)
              └─ progress: pending → embedding → indexed | error

Agent query path:
  Agent invoked on entity → oracleTool.invoke(query)
    └─ embed(query) → search Qdrant (cross-case, top 5)
         └─ EnrichmentResult[] → streams to canvas via existing SSE pipeline
```

---

## Infrastructure changes

### `docker-compose.yml` — add Qdrant service

```yaml
qdrant:
  image: qdrant/qdrant:latest
  ports:
    - "6333:6333"
  volumes:
    - qdrant_data:/qdrant/storage
  restart: unless-stopped

volumes:
  qdrant_data:
```

**Environment variables to add:**
- `QDRANT_URL` — e.g. `http://qdrant:6333`
- `QDRANT_COLLECTION` — `oracle` (one shared collection, all cases)
- `OLLAMA_EMBED_MODEL` — `nomic-embed-text`

---

## Oracle activation — Ollama datasource integration

The Oracle is **not** always-on. It is activated via a toggle on the Ollama datasource admin panel. This is the single control point for the capability.

### Changes to `DatasourceAdminPanel.tsx` (Ollama section)

Add an **"Enable Oracle (RAG Knowledge Base)"** toggle (shadcn `Switch`).

When toggled on:
1. The server checks Ollama's `/api/tags` for `nomic-embed-text`
2. **Model present** → Oracle is active. Canvas promote button and Oracle sidebar item become visible.
3. **Model missing** → A persistent warning banner appears:
   > **Oracle requires the nomic-embed-text model.**
   > Run `ollama pull nomic-embed-text` in your terminal, then reload.
   > [Dismiss]

The `enabled` flag and `modelReady` status are stored in the Ollama datasource config (already persisted in the datasources table). The Oracle sidebar item and canvas promote button read this flag — they do not render at all if Oracle is not enabled.

This means no docker-compose model pull step is needed. The admin enables it intentionally and is guided to pull the model if missing.

---

## RBAC — Oracle permissions

Oracle permissions are configurable per role from the admin panel. Admins assign which roles can do what. The Oracle Manager settings tab (or the existing admin roles page) exposes these controls.

### Permission levels

| Permission | What it allows |
|------------|---------------|
| `oracle:view` | Browse and search Oracle entries |
| `oracle:contribute` | Upload markdown + promote canvas entities |
| `oracle:delete` | Delete individual entries |
| `oracle:admin` | Re-embed single, Re-embed all, configure Oracle settings |

**Default at activation:**
- Admins → all permissions
- All other roles → none (admin grants explicitly)

### Implementation

- Oracle permission checks use `hasOrgPermission` from `lib/auth/permissions.ts`
- A new `OraclePermission` type is added to `lib/auth/permissions.ts`
- API routes check the relevant permission before each operation
- The Oracle Manager UI conditionally renders controls based on the session user's permissions

---

## Markdown chunking strategy

Large markdown files are split into multiple Qdrant points — one per `##` section heading. This gives finer-grained retrieval: an agent searching for "lateral movement" finds the relevant section, not the entire document. `###` and deeper headings are treated as body content within the parent `##` chunk — splitting at that depth creates thin, context-poor chunks that hurt retrieval quality.

### Chunking rules

1. Split on `##` headings (H2) only. `###` and deeper are part of the body.
2. The `##` heading text becomes the chunk `title`.
3. Everything between that heading and the next `##` (or EOF) becomes the `body`.
4. If the file has no `##` headings, treat the whole file as one chunk (use `# heading` or filename as title).
5. Chunks with an empty body after trimming are skipped.
6. All chunks from the same file share a `filename` and `uploadedBy` in their payload.

### Best practices guidance in Upload tab

The Upload tab shows a collapsible info panel (shadcn `Collapsible`) explaining chunking behaviour:

> **How Oracle indexes your markdown files**
>
> Oracle splits your file into one chunk per `##` section. Each chunk is embedded and stored separately, so agents can retrieve precise sections rather than entire documents.
>
> **Best practice: structure your files with clear `##` sections.**
>
> ```markdown
> # Threat Report: Cobalt Strike C2
>
> ## Overview
> Cobalt Strike is a commercial adversary simulation framework...
>
> ## Indicators of Compromise
> - IP: 192.168.1.100
> - Domain: evil.example.com
>
> ## Recommended Response
> Isolate affected hosts, rotate credentials...
> ```
>
> This file would create 3 indexed chunks: Overview, Indicators of Compromise, and Recommended Response.

---

## Badge persistence across refresh

The `oracleIndexed: true` flag is written directly to the entity's **Yjs map** on successful promotion. This means:
- The badge persists across page refreshes (Yjs syncs from the server)
- All collaborators on the same board see the badge immediately
- No separate DB lookup needed on load

Implementation: in `useCasePromotion.promoteToOracle`, after a successful API response, write `entity.set("oracleIndexed", true)` to the Yjs shared map. The entity card sub-components read `entity.oracleIndexed` and render the badge accordingly.

---

## Re-embed all — approach

The **Re-embed all** button in the Oracle Manager triggers a sequential re-embedding of every point in the collection. Sequential (not concurrent) to avoid overwhelming Ollama.

### Flow

1. Admin clicks "Re-embed all" → confirmation dialog (shadcn `AlertDialog`):
   > "This will re-embed all N entries using the current model. This may take several minutes. Continue?"
2. On confirm: `POST /api/the-oracle/re-embed-all`
3. Server scrolls all points, re-embeds one at a time, upserts each
4. Response is **SSE** (reuses the existing SSE pattern from agent invocation):
   - Streams `{ done: number, total: number, current: string }` events
   - Client shows a progress bar in the Oracle Manager Re-embed tab
5. Admin can navigate away — the operation runs to completion server-side regardless of whether the SSE connection stays open. No cancellation mechanism. Re-embedding is idempotent — if it completes it is harmless; if interrupted it will be retried from scratch on the next "Re-embed all".
6. On completion: toast "Re-embed complete — N entries updated."

### Why sequential, why no cancel

Concurrent embed requests to Ollama at scale queue internally anyway and cause timeouts. Sequential is predictable. Cancellation is not implemented — the operation is idempotent, so running to completion is always safe. Cancellation complexity is not worth it at this stage.

---

## Data types

### `KBChunkPayload` — shared across both ingestion paths

```ts
type KBChunkPayload = {
  title: string
  body: string
  source: "canvas" | "upload"

  // canvas fields (source === "canvas")
  caseId?: string
  entityId?: string
  entityType?: string          // "note" | "incident_card" | "zone" | "reasoning"
  incidentSummary?: string

  // upload fields (source === "upload")
  filename?: string
  chunkIndex?: number          // position within the file (0-based)

  // always present
  contributedBy: string        // userId
  contributedAt: string        // ISO timestamp
}
```

### `QdrantPoint`

```ts
type QdrantPoint = {
  id: string          // entityId (canvas) | UUID (upload chunk)
  vector: number[]
  payload: KBChunkPayload
}

type QdrantSearchResult = {
  id: string
  score: number
  payload: KBChunkPayload
}
```

---

## New files

### `lib/qdrant/client.ts` (~90 lines)

Raw HTTP client. No SDK.

```
ensureCollection(name, vectorSize)   create collection if missing (lazy, on first upsert)
upsert(collection, point)            insert or overwrite by ID
search(collection, vector, topK)     nearest-neighbour, returns QdrantSearchResult[]
scroll(collection, offset?, limit)   paginate all points
delete(collection, pointId)          remove single point
get(collection, pointId)             fetch single point (used by re-embed)
```

### `lib/qdrant/ingestion.ts` (~80 lines)

```ts
// Canvas path — entity ID is the stable point key
export async function promoteEntityToOracle(
  entity: BoardEntity,
  meta: { caseId: string; contributedBy: string; incidentSummary: string }
): Promise<{ pointId: string }>

// Upload path — UUID per chunk
export async function ingestChunk(
  chunk: { title: string; body: string },
  meta: { source: "upload"; filename: string; chunkIndex: number; contributedBy: string }
): Promise<{ pointId: string }>

// Shared extraction helper
export function extractChunk(entity: BoardEntity): { title: string; body: string }

// Markdown splitting
export function splitMarkdown(content: string, filename: string): Array<{ title: string; body: string }>
```

### `lib/qdrant/reembed.ts` (~60 lines)

Isolated so the SSE route stays thin.

```ts
export async function reembedAll(
  onProgress: (done: number, total: number, current: string) => void
): Promise<{ total: number }>
```

Scrolls all points, re-embeds sequentially, upserts each.

### `lib/ai/ollama.ts` — add `embed` method

```ts
export async function embed(text: string): Promise<number[]>
// POST /api/embeddings, model: OLLAMA_EMBED_MODEL
```

### `features/agents/lib/tools/oracleTool.ts` (~40 lines)

```ts
export const oracleTool: AgentTool = {
  id: "oracle_search",
  name: "Oracle Search",
  description: "Search The Oracle for prior incidents and threat intelligence across all cases",
  async invoke(query: string): Promise<EnrichmentResult[]> {
    const vector = await embed(query)
    const results = await qdrantClient.search(ORACLE_COLLECTION, vector, 5)
    return results.map(r => ({
      label: r.payload.title,
      summary: r.payload.body,
      source: "oracle",
      meta: { caseId: r.payload.caseId, score: r.score }
    }))
  }
}
```

### API routes

| Route | Method | Handler |
|-------|--------|---------|
| `/api/cases/[caseId]/entities/[entityId]/promote-to-oracle` | POST | Canvas promotion |
| `/api/the-oracle/entries` | GET | List/paginate entries |
| `/api/the-oracle/entries` | POST | Direct upload chunk |
| `/api/the-oracle/entries/[pointId]` | DELETE | Delete entry |
| `/api/the-oracle/entries/[pointId]/re-embed` | POST | Re-embed single |
| `/api/the-oracle/re-embed-all` | POST | SSE bulk re-embed |

All routes check the appropriate `OraclePermission` via `hasOrgPermission`.

### The Oracle Manager feature module

```
features/the-oracle/
  pages/
    OraclePage.tsx              ← root page, tabs (~80 lines)
    OracleEntriesTab.tsx        ← browse/search/delete (~200 lines)
    OracleUploadTab.tsx         ← markdown upload UI (~150 lines)
    OracleReembedTab.tsx        ← re-embed single/all + progress (~120 lines)
  components/
    OracleEntryCard.tsx         ← single entry row (~80 lines)
    OracleUploadQueue.tsx       ← per-chunk progress list (~100 lines)
    OracleReembedProgress.tsx   ← SSE progress bar (~60 lines)
    OracleBestPractices.tsx     ← collapsible guidance panel (~60 lines)
  hooks/
    useOracleEntries.ts         ← fetch + paginate + delete state (~80 lines)
    useOracleUpload.ts          ← file parse + sequential upload state machine (~90 lines)
    useOracleReembed.ts         ← SSE consumer for re-embed progress (~60 lines)
```

> **Note:** There is no Settings tab here. Oracle RBAC permissions (view / contribute / delete / admin) are managed in the existing admin area alongside all other org role controls. This is a dependency on a **separate plan: Admin RBAC Controls** — that plan will cover exposing all feature-level permissions (including Oracle's) in the admin UI. Oracle permissions default to admin-only until that plan is implemented.

**Sidebar registration:**
- Icon: `Eye` (Lucide) — fitting for "The Oracle"
- Label: **The Oracle**
- Route: `/the-oracle`
- Visibility: only renders when Oracle is enabled in Ollama datasource config

---

## Modified files

| File | Change |
|------|--------|
| `lib/auth/permissions.ts` | Add `OraclePermission` type + oracle permission checks |
| `lib/ai/ollama.ts` | Add `embed()` method |
| `lib/datasources/ollama.ts` | Add `oracleEnabled: boolean`, `embedModelReady: boolean` to config type |
| `features/integrations/components/DatasourceAdminPanel.tsx` | Add Oracle toggle + model-missing banner |
| `features/agents/lib/toolRegistry.ts` | Register `oracleTool` |
| `features/incident-workspace/components/board/useCasePromotion.ts` | Add `promoteToOracle(entity)`, write `oracleIndexed` to Yjs map |
| `features/incident-workspace/components/board/BoardSelectionContext.tsx` | Expose `promoteToOracle` |
| `features/incident-workspace/components/board/EntitySelectionPanel.tsx` | Add "Add to Oracle" button + badge (only when Oracle enabled) |
| `lib/modules/registry.ts` | Register Oracle module |

---

## Entity title + body extraction

| Entity type | title | body |
|-------------|-------|------|
| `note` | `entity.label` or first line | `entity.content` |
| `incident_card` | `entity.label` | `entity.description` |
| `zone` | `entity.label` | `entity.description` |
| `reasoning` | `entity.label` | `entity.narrative` |

If `body` is empty after extraction, only `title` is embedded.

---

## Visual feedback on canvas

- **"Oracle"** badge (shadcn `Badge`, violet to match the agent/reasoning colour scheme) on the entity card
- Badge driven by `entity.oracleIndexed` from Yjs map — persists across refresh and is visible to all collaborators
- A shadcn toast confirms success or surfaces errors
- Canvas promote button is hidden when Oracle is not enabled in the datasource config

---

## File size check

All new files are within the 300-line hard limit. No exceptions anticipated.

---

## Build order

### Phase 1 — Core infrastructure
1. `docker-compose.yml` — Qdrant service + env vars
2. `lib/ai/ollama.ts` — `embed()` method
3. `lib/qdrant/client.ts` — full HTTP client
4. `lib/qdrant/ingestion.ts` — `promoteEntityToOracle`, `ingestChunk`, `extractChunk`, `splitMarkdown`
5. `lib/qdrant/reembed.ts` — `reembedAll`
6. `lib/auth/permissions.ts` — `OraclePermission` type

### Phase 2 — Ollama datasource Oracle toggle
7. `lib/datasources/ollama.ts` — add `oracleEnabled`, `embedModelReady` to config
8. `DatasourceAdminPanel.tsx` — Oracle toggle + model-missing banner

### Phase 3 — Canvas promotion
9. `app/api/cases/[caseId]/entities/[entityId]/promote-to-oracle/route.ts`
10. `useCasePromotion.ts` — `promoteToOracle` + Yjs `oracleIndexed` write
11. `BoardSelectionContext.tsx` — expose `promoteToOracle`
12. `EntitySelectionPanel.tsx` — "Add to Oracle" button + badge

### Phase 4 — Oracle Manager API
13. `app/api/the-oracle/entries/route.ts` — GET + POST
14. `app/api/the-oracle/entries/[pointId]/route.ts` — DELETE
15. `app/api/the-oracle/entries/[pointId]/re-embed/route.ts` — POST
16. `app/api/the-oracle/re-embed-all/route.ts` — SSE POST

### Phase 5 — Oracle Manager UI
17. `features/the-oracle/hooks/useOracleEntries.ts`
18. `features/the-oracle/hooks/useOracleUpload.ts`
19. `features/the-oracle/hooks/useOracleReembed.ts`
20. `features/the-oracle/components/OracleEntryCard.tsx`
21. `features/the-oracle/components/OracleUploadQueue.tsx`
22. `features/the-oracle/components/OracleReembedProgress.tsx`
23. `features/the-oracle/components/OracleBestPractices.tsx`
24. `features/the-oracle/pages/OracleEntriesTab.tsx`
25. `features/the-oracle/pages/OracleUploadTab.tsx`
26. `features/the-oracle/pages/OracleReembedTab.tsx`
27. `features/the-oracle/pages/OraclePage.tsx`
28. `lib/modules/registry.ts` — register The Oracle module + sidebar entry

### Phase 6 — Agent tool
29. `features/agents/lib/tools/oracleTool.ts`
30. `features/agents/lib/toolRegistry.ts` — register

### Phase 7 — Tests
31. Unit tests: `lib/qdrant/client.ts`, `ingestion.ts`, `reembed.ts`
32. API route tests: all 6 Oracle routes + promote-to-oracle route
33. Hook tests: `useOracleEntries`, `useOracleUpload`, `useOracleReembed`
34. Component tests: `OracleEntryCard`, `OracleUploadQueue`, `OracleBestPractices`

---

## Resolved decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Badge persistence | Store `oracleIndexed: true` in Yjs entity map — persists across refresh, visible to all collaborators |
| 2 | Canvas entity deletion | Leave the Oracle point in place — the knowledge outlives the canvas entity |
| 3 | Collection scope | One shared collection (`oracle`) across all cases; `caseId` in payload for context |
| 4 | Agent search scope | Cross-case search — agents query the full Oracle |
| 5 | Embed model readiness | Ollama datasource toggle + model-missing banner with pull instructions; no docker pull step |
| 6 | Permissions | Oracle RBAC (`view / contribute / delete / admin`) managed in the existing admin area. **Dependency: Admin RBAC Controls plan** (separate). Until that plan is implemented, Oracle routes default to `view_admin` only. |
| 7 | Markdown chunking | Split on `##` only. `###` and deeper are body content. No configurable depth — `##` is the right boundary. Best practices guidance in Upload tab. |
| 8 | Re-embed all | Sequential SSE with live progress bar. No cancellation — operation is idempotent and runs to completion server-side. |
| 9 | Feature name | **"The Oracle"** — proper noun with "The" distinguishes it from Oracle Corporation. Route: `/the-oracle`. Module: `features/the-oracle/`. |

---

## Dependencies

- **Admin RBAC Controls plan** (not yet written) — exposes per-feature permission assignment in the admin area. Oracle permissions will be managed there once that plan is implemented. This plan can be built and shipped without it; Oracle will simply be admin-only until RBAC controls are in place.
