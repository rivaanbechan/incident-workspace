"use client"

import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import {
  buildSavedEvidenceSetCasePromotionInput,
  createCaseRecordViaApi,
} from "@/features/incident-workspace/lib/caseRecordPromotion"
import type {
  DatasourceInstallation,
  DatasourceSearchResult,
  DatasourceSearchRow,
  SavedDatasourceResultSet,
} from "@/lib/datasources"
import { EmptyState } from "@/components/shell/EmptyState"
import { FormField } from "@/components/shell/FormField"
import { useToast } from "@/components/shell/ToastProvider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { getIntegrationsHref } from "@/features/integrations/manifest"
import Link from "next/link"
import { apiRequest } from "@/lib/api/client"
import { formatTimestamp } from "@/lib/ui/formatters"
import { useCallback, useEffect, useRef, useState } from "react"

type DatasourceSearchPanelProps = {
  linkedCaseId?: string | null
  onAddTimelineEntry: (input: { body: string; linkedEntityIds?: string[]; type: "update" }) => void
  roomId: string
  selectedEntityLabel?: string | null
}

type DatasourceCatalogResponse = {
  datasources: DatasourceInstallation[]
}

const QUERY_TEMPLATES: Array<{ label: string; value: string }> = [
  { label: "— Load a template —", value: "" },
  { label: "Recent events (24h)", value: "index=* earliest=-24h | head 50" },
  {
    label: "Auth failures (EventCode 4625)",
    value: "index=* sourcetype=WinEventLog:Security EventCode=4625 | table _time host user src_ip | head 50",
  },
  {
    label: "Process creation (EventCode 4688)",
    value: "index=* sourcetype=WinEventLog:Security EventCode=4688 | table _time host user process_name cmd_line | head 50",
  },
  {
    label: "PowerShell execution",
    value: 'index=* (Process_Command_Line=*powershell* OR cmd_line=*powershell* OR CommandLine=*powershell*) | head 50',
  },
  {
    label: "Network connections (Zeek/Bro)",
    value: "index=* sourcetype=zeek:conn | table _time id.orig_h id.resp_h id.resp_p proto | head 50",
  },
  {
    label: "Failed logins — top offenders",
    value: "index=* (action=failure OR EventCode=4625) | stats count by user src_ip | sort -count | head 25",
  },
  {
    label: "Hash lookup (replace HASH)",
    value: 'index=* (md5="HASH" OR sha256="HASH") | head 50',
  },
  {
    label: "MITRE ATT&CK technique (replace T1XXX)",
    value: 'index=* (mitre_technique_id="T1XXX" OR technique_id="T1XXX") | head 50',
  },
  {
    label: "Top network talkers",
    value: "index=* sourcetype=netflow | stats sum(bytes) as bytes by src_ip | sort -bytes | head 25",
  },
  {
    label: "Lateral movement indicators",
    value: "index=* EventCode IN (4624 4625 4648) src_ip!=dest_ip | head 50",
  },
  {
    label: "DNS queries",
    value: "index=* sourcetype=stream:dns | table _time src_ip query record_type | head 50",
  },
  {
    label: "Registry modifications",
    value: "index=* (EventCode=4657 OR sourcetype=*registry*) | table _time host user registry_path registry_value_name | head 50",
  },
]

// Long values like SHA256 hashes (64 chars) will blow out badge width. Truncate for display only.
function truncateLabel(label: string, max = 32): string {
  if (label.length <= max) return label
  return `${label.slice(0, 10)}…${label.slice(-8)}`
}

function uniqueEntities(rows: DatasourceSearchRow[]) {
  const seen = new Set<string>()

  return rows.flatMap((row) =>
    row.relatedEntities.filter((entity) => {
      if (seen.has(entity.id)) {
        return false
      }

      seen.add(entity.id)
      return true
    }),
  )
}

function buildResultSetTitle(datasource: DatasourceInstallation, rows: DatasourceSearchRow[]) {
  const leadTitle = rows[0]?.title ?? "Datasource result set"
  return `${datasource.title}: ${leadTitle}`
}

function buildResultSetSummary(
  datasource: DatasourceInstallation,
  query: string,
  rows: DatasourceSearchRow[],
) {
  const summaryLead = rows.slice(0, 2).map((row) => row.summary).join(" | ")
  return `${datasource.title} query "${query.trim()}" returned ${rows.length} result${
    rows.length === 1 ? "" : "s"
  }. ${summaryLead}`.trim()
}

function buildSavedResultArtifact(input: {
  datasource: DatasourceInstallation
  query: string
  roomId: string
  rows: DatasourceSearchRow[]
  earliestTime: string
  latestTime: string
}) {
  const relatedEntities = uniqueEntities(input.rows)
  const artifactId = crypto.randomUUID()

  const artifact: InvestigationArtifact = {
    createdAt: Date.now(),
    deepLink: input.rows[0]?.sourceUrl
      ? {
          href: input.rows[0].sourceUrl,
          moduleId: "incident-workspace",
        }
      : undefined,
    id: artifactId,
    kind: "evidence",
    payload: {
      datasourceId: input.datasource.id,
      datasourceTitle: input.datasource.title,
      earliestTime: input.earliestTime,
      latestTime: input.latestTime,
      query: input.query,
      roomId: input.roomId,
      rows: input.rows,
      vendor: input.datasource.vendor,
    },
    relatedEntities,
    sourceModule: input.datasource.vendor,
    summary: buildResultSetSummary(input.datasource, input.query, input.rows),
    title: buildResultSetTitle(input.datasource, input.rows),
  }

  return {
    artifact,
    relatedEntities,
  }
}

function buildTimelineBody(input: {
  datasource: DatasourceInstallation
  query: string
  relatedEntities: string[]
  rows: DatasourceSearchRow[]
}) {
  const headline = `${input.datasource.title} search captured ${input.rows.length} result${
    input.rows.length === 1 ? "" : "s"
  }.`
  const entitiesLine =
    input.relatedEntities.length > 0
      ? `Linked entities: ${input.relatedEntities.slice(0, 5).join(", ")}`
      : "Linked entities: none extracted"
  const resultLead = input.rows[0]?.summary ?? "No result summary available."

  return `${headline}\nQuery: ${input.query.trim()}\n${entitiesLine}\nLead result: ${resultLead}`
}

function RawEventView({ raw }: { raw: Record<string, unknown> }) {
  const rawText = typeof raw._raw === "string" ? raw._raw.trim() : null
  const fields = Object.entries(raw).filter(([key]) => !key.startsWith("_"))

  return (
    <div className="grid gap-3">
      {rawText ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Raw event
          </div>
          <pre className="whitespace-pre-wrap break-all rounded-md bg-muted/60 p-2 font-mono text-[11px] leading-5 text-foreground">
            {rawText}
          </pre>
        </div>
      ) : null}
      {fields.length > 0 ? (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Fields
          </div>
          <div className="grid gap-0.5">
            {fields.map(([key, value]) => (
              <div key={key} className="flex gap-2 font-mono text-[11px] leading-5">
                <span className="shrink-0 text-muted-foreground">{key}</span>
                <span className="break-all text-foreground">
                  {typeof value === "string" ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DatasourceSearchPanel({
  linkedCaseId,
  onAddTimelineEntry,
  roomId,
  selectedEntityLabel = null,
}: DatasourceSearchPanelProps) {
  const [datasources, setDatasources] = useState<DatasourceInstallation[]>([])
  const [datasourceId, setDatasourceId] = useState("splunk")
  const [query, setQuery] = useState("index=* earliest=-24h | head 25")
  const [earliestTime, setEarliestTime] = useState("-24h")
  const [latestTime, setLatestTime] = useState("now")
  const [limit, setLimit] = useState("25")
  const [currentOffset, setCurrentOffset] = useState(0)
  const [searchResult, setSearchResult] = useState<DatasourceSearchResult | null>(null)
  const [savedResultSets, setSavedResultSets] = useState<SavedDatasourceResultSet[]>([])
  const [searchStatus, setSearchStatus] = useState(
    "Configure a global datasource, then run a search. Results stay ephemeral until you save them.",
  )
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isSavingResultSet, setIsSavingResultSet] = useState(false)
  const [isAddingTimelineEntry, setIsAddingTimelineEntry] = useState(false)
  const [promotingRowId, setPromotingRowId] = useState<string | null>(null)
  const [promotingResultSetId, setPromotingResultSetId] = useState<string | null>(null)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const { showToast } = useToast()

  // Cancel any in-flight search when the component unmounts (e.g. user switches tab)
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const selectedDatasource =
    datasources.find((datasource) => datasource.id === datasourceId) ?? null

  const pageSize = Math.max(1, Number(limit) || 25)
  const currentPage = Math.floor(currentOffset / pageSize)
  const totalCount = searchResult?.totalCount ?? null
  const totalPages = totalCount !== null ? Math.ceil(totalCount / pageSize) : null

  const loadSavedResultSets = useCallback(async () => {
    const payload = await apiRequest<SavedDatasourceResultSet[]>(
      `/api/rooms/${roomId}/datasource-results`,
      { cache: "no-store" },
    )
    setSavedResultSets(payload)
  }, [roomId])

  const loadCatalog = useCallback(async () => {
    try {
      setIsLoadingCatalog(true)
      const payload = await apiRequest<DatasourceCatalogResponse>("/api/datasources", {
        cache: "no-store",
      })
      const enabledDatasources = payload.datasources.filter((datasource) => datasource.enabled)
      setDatasources(enabledDatasources)

      const nextDatasource =
        enabledDatasources.find((datasource) => datasource.id === datasourceId) ??
        enabledDatasources[0] ??
        null

      if (nextDatasource) {
        setDatasourceId(nextDatasource.id)
      }
    } catch (error) {
      setSearchStatus(
        error instanceof Error ? error.message : "Unable to load datasource catalog.",
      )
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [datasourceId])

  useEffect(() => {
    void Promise.all([loadCatalog(), loadSavedResultSets()]).catch(() => {})
  }, [loadCatalog, loadSavedResultSets])

  const runSearch = async (offset: number) => {
    if (!selectedDatasource) {
      setSearchStatus("No enabled datasources are available. Configure one in Integrations.")
      return
    }

    // Cancel any previous in-flight search before starting a new one
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setIsSearching(true)
      setExpandedRowId(null)
      setSearchStatus("Running datasource search. Results remain ephemeral until you save them.")
      const result = await apiRequest<DatasourceSearchResult>(
        `/api/datasources/${selectedDatasource.id}/search`,
        {
          body: JSON.stringify({
            caseId: linkedCaseId,
            earliestTime,
            latestTime,
            limit: pageSize,
            offset,
            query,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        },
      )
      setSearchResult(result)
      setCurrentOffset(offset)

      const pageInfo =
        result.totalCount > result.rowCount
          ? ` (page ${Math.floor(offset / pageSize) + 1} of ${Math.ceil(result.totalCount / pageSize)}, ${result.totalCount} total)`
          : ""

      setSearchStatus(
        result.rowCount > 0
          ? `Returned ${result.rowCount} result${result.rowCount === 1 ? "" : "s"} in ${result.executionTimeMs}ms${pageInfo}. Save the set or add it to the timeline if it matters.`
          : "Search completed with no matching results.",
      )
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setSearchStatus("Search cancelled.")
        return
      }
      setSearchResult(null)
      setSearchStatus(
        error instanceof Error ? error.message : "Unable to execute datasource search.",
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = () => {
    setCurrentOffset(0)
    void runSearch(0)
  }

  const handleNextPage = () => {
    const nextOffset = currentOffset + pageSize
    void runSearch(nextOffset)
  }

  const handlePrevPage = () => {
    const prevOffset = Math.max(0, currentOffset - pageSize)
    void runSearch(prevOffset)
  }

  const handlePivotOnEntity = () => {
    if (!selectedEntityLabel) return
    const escaped = selectedEntityLabel.replace(/"/g, '\\"')
    setQuery(`index=* "${escaped}" | head 50`)
    setCurrentOffset(0)
    void runSearch(0)
  }

  const handlePromote = async (row: DatasourceSearchRow) => {
    if (!selectedDatasource) {
      setSearchStatus("Datasource is not configured.")
      return
    }

    try {
      setPromotingRowId(row.id)
      const artifact: InvestigationArtifact = {
        createdAt: Date.now(),
        deepLink: row.sourceUrl
          ? {
              href: row.sourceUrl,
              moduleId: "incident-workspace",
            }
          : undefined,
        id: crypto.randomUUID(),
        kind: "evidence",
        payload: {
          datasourceId: selectedDatasource.id,
          datasourceTitle: selectedDatasource.title,
          earliestTime,
          latestTime,
          query,
          raw: row.raw,
          roomId,
          sourceUrl: row.sourceUrl,
          vendor: selectedDatasource.vendor,
        },
        relatedEntities: row.relatedEntities,
        sourceModule: selectedDatasource.vendor,
        summary: row.summary,
        title: row.title,
      }

      await apiRequest(`/api/rooms/${roomId}/artifacts`, {
        body: JSON.stringify({ artifact }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      setSearchStatus(`Promoted "${row.title}" into the investigation artifacts feed.`)
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : "Unable to promote result.")
    } finally {
      setPromotingRowId(null)
    }
  }

  const handleSaveResultSet = async () => {
    if (!selectedDatasource || !searchResult || searchResult.rows.length === 0) {
      setSearchStatus("Run a search with results before saving an evidence set.")
      return
    }

    try {
      setIsSavingResultSet(true)
      const { artifact } = buildSavedResultArtifact({
        datasource: selectedDatasource,
        earliestTime,
        latestTime,
        query,
        roomId,
        rows: searchResult.rows,
      })
      await apiRequest(`/api/rooms/${roomId}/datasource-results`, {
        body: JSON.stringify({
          artifact,
          datasourceId: selectedDatasource.id,
          datasourceTitle: selectedDatasource.title,
          earliestTime,
          latestTime,
          query,
          relatedEntities: artifact.relatedEntities,
          resultCount: searchResult.rowCount,
          rows: searchResult.rows,
          summary: artifact.summary,
          title: artifact.title,
          vendor: selectedDatasource.vendor,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      await loadSavedResultSets()
      setSearchStatus(
        `Saved ${searchResult.rowCount} result${searchResult.rowCount === 1 ? "" : "s"} as a room evidence set.`,
      )
    } catch (error) {
      setSearchStatus(
        error instanceof Error ? error.message : "Unable to save datasource result set.",
      )
    } finally {
      setIsSavingResultSet(false)
    }
  }

  const handleAddToTimeline = async () => {
    if (!selectedDatasource || !searchResult || searchResult.rows.length === 0) {
      setSearchStatus("Run a search with results before adding it to the timeline.")
      return
    }

    try {
      setIsAddingTimelineEntry(true)
      const entities = uniqueEntities(searchResult.rows)
      onAddTimelineEntry({
        body: buildTimelineBody({
          datasource: selectedDatasource,
          query,
          relatedEntities: entities.map((entity) => entity.label),
          rows: searchResult.rows,
        }),
        linkedEntityIds: entities.map((entity) => entity.id),
        type: "update",
      })
      setSearchStatus("Added the current search context to the incident timeline.")
    } finally {
      setIsAddingTimelineEntry(false)
    }
  }

  const selectSavedResultSet = (savedResultSet: SavedDatasourceResultSet) => {
    setDatasourceId(savedResultSet.datasourceId)
    setQuery(savedResultSet.query)
    setEarliestTime(savedResultSet.earliestTime ?? "")
    setLatestTime(savedResultSet.latestTime ?? "")
    setCurrentOffset(0)
    setSearchResult({
      executionTimeMs: 0,
      rowCount: savedResultSet.resultCount,
      totalCount: savedResultSet.resultCount,
      rows: savedResultSet.rows,
    })
    setSearchStatus(`Loaded saved evidence set "${savedResultSet.title}".`)
  }

  const handlePromoteSavedResultSetToCase = async (
    savedResultSet: SavedDatasourceResultSet,
  ) => {
    if (!linkedCaseId) {
      showToast({
        message: "Link this room to a case before promoting durable records.",
        tone: "error",
      })
      return
    }

    try {
      setPromotingResultSetId(savedResultSet.id)
      await createCaseRecordViaApi(
        buildSavedEvidenceSetCasePromotionInput({
          caseId: linkedCaseId,
          resultSet: savedResultSet,
          roomId,
        }),
      )
      showToast({
        message: `Promoted "${savedResultSet.title}" into the case.`,
        tone: "success",
      })
    } catch (error) {
      showToast({
        message:
          error instanceof Error ? error.message : "Unable to promote evidence set.",
        tone: "error",
      })
    } finally {
      setPromotingResultSetId(null)
    }
  }

  return (
    <aside className="grid min-h-0 w-full gap-3">
      <Card className="border-border/50 bg-background/70 shadow-none">
        <CardHeader className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                Analyst Search
              </CardDescription>
              <CardTitle className="mt-2 text-base">Datasource exploration</CardTitle>
            </div>
            {searchResult ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{searchResult.rowCount} rows</Badge>
                {totalPages !== null && totalPages > 1 ? (
                  <Badge variant="secondary">
                    Page {currentPage + 1} / {totalPages}
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
          <CardDescription className="text-sm leading-6">{searchStatus}</CardDescription>
          <CardDescription className="text-xs leading-6">
            Global datasource credentials live in{" "}
            <Link href={getIntegrationsHref()} className="font-semibold text-foreground">
              Integrations
            </Link>
            . This rail only consumes enabled datasource instances.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0">
          {!isLoadingCatalog && datasources.length === 0 ? (
            <EmptyState
              message={
                <>
                  No enabled datasource instances are available for this room. Configure one in{" "}
                  <Link href={getIntegrationsHref()} className="font-semibold text-foreground">
                    Integrations
                  </Link>
                  .
                </>
              }
            />
          ) : null}

          <FormField variant="compact" label="Datasource">
            <Select
              value={datasourceId}
              onChange={(event) => setDatasourceId(event.target.value)}
              disabled={datasources.length === 0}
            >
              {datasources.map((datasource) => (
                <option key={datasource.id} value={datasource.id}>
                  {datasource.title}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField variant="compact" label="Query template">
            <Select
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  setQuery(event.target.value)
                  setCurrentOffset(0)
                }
              }}
            >
              {QUERY_TEMPLATES.map((template) => (
                <option key={template.label} value={template.value}>
                  {template.label}
                </option>
              ))}
            </Select>
          </FormField>

          {selectedEntityLabel ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Selected entity
                </div>
                <div className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {selectedEntityLabel}
                </div>
              </div>
              <Button
                onClick={handlePivotOnEntity}
                disabled={isSearching}
                size="sm"
                variant="secondary"
                className="shrink-0"
              >
                Pivot
              </Button>
            </div>
          ) : null}

          <FormField variant="compact" label="Query">
            <Textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={5}
              className="resize-y font-mono text-xs"
            />
          </FormField>

          <div className="grid grid-cols-3 gap-2.5">
            <FormField variant="compact" label="Earliest">
              <Input value={earliestTime} onChange={(event) => setEarliestTime(event.target.value)} />
            </FormField>
            <FormField variant="compact" label="Latest">
              <Input value={latestTime} onChange={(event) => setLatestTime(event.target.value)} />
            </FormField>
            <FormField variant="compact" label="Page size">
              <Input
                value={limit}
                onChange={(event) => {
                  setLimit(event.target.value)
                  setCurrentOffset(0)
                }}
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSearch} disabled={isSearching || !selectedDatasource}>
              {isSearching ? "Running..." : "Run Search"}
            </Button>
            {isSearching ? (
              <Button
                onClick={() => abortControllerRef.current?.abort()}
                variant="destructive"
                size="default"
              >
                Cancel
              </Button>
            ) : null}
            <Button
              onClick={handleSaveResultSet}
              disabled={isSavingResultSet || !searchResult || searchResult.rows.length === 0}
              variant="secondary"
            >
              {isSavingResultSet ? "Saving..." : "Save Evidence Set"}
            </Button>
            <Button
              onClick={handleAddToTimeline}
              disabled={isAddingTimelineEntry || !searchResult || searchResult.rows.length === 0}
              variant="outline"
            >
              {isAddingTimelineEntry ? "Adding..." : "Add to Timeline"}
            </Button>
          </div>

          {totalPages !== null && totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrevPage}
                disabled={isSearching || currentPage === 0}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage + 1} of {totalPages} ({totalCount} total)
              </span>
              <Button
                onClick={handleNextPage}
                disabled={isSearching || currentPage + 1 >= totalPages}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {savedResultSets.length > 0 ? (
        <Card className="border-border/60 bg-card shadow-none">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm">Saved evidence sets</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0">
            {savedResultSets.slice(0, 4).map((savedResultSet) => (
              <Card key={savedResultSet.id} className="border-border/50 bg-background/70 shadow-none">
                <CardContent className="grid gap-3 p-3">
                  <button
                    onClick={() => selectSavedResultSet(savedResultSet)}
                    className="cursor-pointer border-none bg-transparent p-0 text-left"
                    type="button"
                  >
                    <div className="text-sm font-semibold text-foreground">{savedResultSet.title}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {savedResultSet.summary}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{savedResultSet.datasourceTitle}</span>
                      <span>{savedResultSet.resultCount} results</span>
                      <span>{formatTimestamp(savedResultSet.createdAt)}</span>
                    </div>
                  </button>
                  {linkedCaseId ? (
                    <Button
                      onClick={() => {
                        void handlePromoteSavedResultSetToCase(savedResultSet)
                      }}
                      disabled={promotingResultSetId === savedResultSet.id}
                      size="sm"
                      className="justify-self-start"
                    >
                      {promotingResultSetId === savedResultSet.id
                        ? "Promoting..."
                        : "Promote To Case"}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {searchResult?.rows.map((row) => (
        <Card key={row.id} className="border-border/60 bg-card shadow-none">
          <CardContent className="grid gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="break-all text-[15px] font-semibold text-foreground">{row.title}</div>
                <div className="break-all text-[13px] leading-6 text-foreground">{row.summary}</div>
              </div>
              <Badge variant="outline">
                {row.occurredAt ? `Occurred ${row.occurredAt}` : "No timestamp"}
              </Badge>
            </div>
            {row.relatedEntities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {row.relatedEntities.map((entity) => (
                  <Badge key={`${row.id}-${entity.id}`} variant="secondary" title={`${entity.kind}: ${entity.label}`}>
                    {entity.kind}: {truncateLabel(entity.label)}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {row.sourceUrl ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href={row.sourceUrl} target="_blank" rel="noreferrer">
                    Open in Splunk
                  </Link>
                </Button>
              ) : null}
              <Button
                onClick={() => void handlePromote(row)}
                disabled={promotingRowId === row.id}
                size="sm"
              >
                {promotingRowId === row.id ? "Promoting..." : "Promote Row"}
              </Button>
              <Button
                onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                size="sm"
                variant="ghost"
              >
                {expandedRowId === row.id ? "Hide Raw" : "Show Raw"}
              </Button>
            </div>

            {expandedRowId === row.id ? (
              <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                <RawEventView raw={row.raw} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </aside>
  )
}
