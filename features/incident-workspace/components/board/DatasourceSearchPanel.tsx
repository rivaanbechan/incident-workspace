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
import { useToast } from "@/components/shell/ToastProvider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { getIntegrationsHref } from "@/features/integrations/manifest"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type DatasourceSearchPanelProps = {
  linkedCaseId?: string | null
  onAddTimelineEntry: (input: { body: string; linkedEntityIds?: string[]; type: "update" }) => void
  roomId: string
}

type DatasourceCatalogResponse = {
  datasources: DatasourceInstallation[]
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
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

export function DatasourceSearchPanel({
  linkedCaseId,
  onAddTimelineEntry,
  roomId,
}: DatasourceSearchPanelProps) {
  const [datasources, setDatasources] = useState<DatasourceInstallation[]>([])
  const [datasourceId, setDatasourceId] = useState("splunk")
  const [query, setQuery] = useState('index=* earliest=-24h | head 25')
  const [earliestTime, setEarliestTime] = useState("-24h")
  const [latestTime, setLatestTime] = useState("now")
  const [limit, setLimit] = useState("25")
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
  const { showToast } = useToast()

  const selectedDatasource =
    datasources.find((datasource) => datasource.id === datasourceId) ?? null

  const loadSavedResultSets = useCallback(async () => {
    const response = await fetch(`/api/rooms/${roomId}/datasource-results`, {
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error("Unable to load saved datasource result sets.")
    }

    const payload = (await response.json()) as SavedDatasourceResultSet[]
    setSavedResultSets(payload)
  }, [roomId])

  const loadCatalog = useCallback(async () => {
    try {
      setIsLoadingCatalog(true)
      const response = await fetch("/api/datasources", {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Unable to load datasource catalog.")
      }

      const payload = (await response.json()) as DatasourceCatalogResponse
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

  const handleSearch = async () => {
    if (!selectedDatasource) {
      setSearchStatus("No enabled datasources are available. Configure one in Integrations.")
      return
    }

    try {
      setIsSearching(true)
      setSearchStatus("Running datasource search. Results remain ephemeral until you save them.")
      const response = await fetch(`/api/datasources/${selectedDatasource.id}/search`, {
        body: JSON.stringify({
          caseId: linkedCaseId,
          earliestTime,
          latestTime,
          limit: Number(limit),
          query,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to execute datasource search.",
        )
      }

      const result = payload as DatasourceSearchResult
      setSearchResult(result)
      setSearchStatus(
        result.rowCount > 0
          ? `Returned ${result.rowCount} result${result.rowCount === 1 ? "" : "s"} in ${result.executionTimeMs}ms. Save the set or add it to the timeline if it matters.`
          : "Search completed with no matching results.",
      )
    } catch (error) {
      setSearchResult(null)
      setSearchStatus(
        error instanceof Error ? error.message : "Unable to execute datasource search.",
      )
    } finally {
      setIsSearching(false)
    }
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

      const response = await fetch(`/api/rooms/${roomId}/artifacts`, {
        body: JSON.stringify({ artifact }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Unable to promote result.",
        )
      }

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
      const response = await fetch(`/api/rooms/${roomId}/datasource-results`, {
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
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to save datasource result set.",
        )
      }

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
    setSearchResult({
      executionTimeMs: 0,
      rowCount: savedResultSet.resultCount,
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
            {searchResult ? <Badge variant="outline">{searchResult.rowCount} rows</Badge> : null}
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
            <Card className="border-dashed border-border/70 bg-card shadow-none">
              <CardContent className="p-4 text-sm leading-6 text-foreground">
                No enabled datasource instances are available for this room. Configure one in{" "}
                <Link href={getIntegrationsHref()} className="font-semibold text-foreground">
                  Integrations
                </Link>
                .
              </CardContent>
            </Card>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Datasource
            </span>
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
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Query
            </span>
            <Textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={5}
              className="resize-y"
            />
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Earliest
              </span>
              <Input value={earliestTime} onChange={(event) => setEarliestTime(event.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Latest
              </span>
              <Input value={latestTime} onChange={(event) => setLatestTime(event.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Limit
              </span>
              <Input value={limit} onChange={(event) => setLimit(event.target.value)} />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSearch} disabled={isSearching || !selectedDatasource}>
              {isSearching ? "Running..." : "Run Search"}
            </Button>
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
                <div className="text-[15px] font-semibold text-foreground">{row.title}</div>
                <div className="text-[13px] leading-6 text-foreground">{row.summary}</div>
              </div>
              <Badge variant="outline">
                {row.occurredAt ? `Occurred ${row.occurredAt}` : "No timestamp"}
              </Badge>
            </div>
            {row.relatedEntities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {row.relatedEntities.map((entity) => (
                  <Badge key={`${row.id}-${entity.id}`} variant="secondary">
                    {entity.kind}: {entity.label}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {row.sourceUrl ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href={row.sourceUrl} target="_blank" rel="noreferrer">
                    Open Source
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
            </div>
          </CardContent>
        </Card>
      ))}
    </aside>
  )
}
