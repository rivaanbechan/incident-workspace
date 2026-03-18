"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useToast } from "@/components/shell/ToastProvider"
import {
  buildSavedEvidenceSetCasePromotionInput,
  createCaseRecordViaApi,
} from "@/features/incident-workspace/lib/caseRecordPromotion"
import { DatasourceSavedResultSets } from "@/features/incident-workspace/components/board/DatasourceSavedResultSets"
import { DatasourceSearchForm } from "@/features/incident-workspace/components/board/DatasourceSearchForm"
import { DatasourceSearchResultRow } from "@/features/incident-workspace/components/board/DatasourceSearchResultRow"
import {
  buildSavedResultArtifact,
  buildTimelineBody,
  uniqueEntities,
} from "@/features/incident-workspace/components/board/datasourceSearchHelpers"
import { apiRequest } from "@/lib/api/client"
import type {
  DatasourceInstallation,
  DatasourceSearchResult,
  DatasourceSearchRow,
  SavedDatasourceResultSet,
} from "@/lib/datasources"

type Props = {
  linkedCaseId?: string | null
  onAddTimelineEntry: (input: { body: string; linkedEntityIds?: string[]; type: "update" }) => void
  roomId: string
  selectedEntityLabel?: string | null
}

type DatasourceCatalogResponse = { datasources: DatasourceInstallation[] }

export function DatasourceSearchPanel({ linkedCaseId, onAddTimelineEntry, roomId, selectedEntityLabel = null }: Props) {
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

  useEffect(() => { return () => { abortControllerRef.current?.abort() } }, [])

  const pageSize = Math.max(1, Number(limit) || 25)
  const currentPage = Math.floor(currentOffset / pageSize)
  const totalCount = searchResult?.totalCount ?? null
  const totalPages = totalCount !== null ? Math.ceil(totalCount / pageSize) : null

  const loadSavedResultSets = useCallback(async () => {
    const payload = await apiRequest<SavedDatasourceResultSet[]>(
      `/api/rooms/${roomId}/datasource-results`, { cache: "no-store" })
    setSavedResultSets(payload)
  }, [roomId])

  const loadCatalog = useCallback(async () => {
    try {
      setIsLoadingCatalog(true)
      const payload = await apiRequest<DatasourceCatalogResponse>("/api/datasources", { cache: "no-store" })
      const enabled = payload.datasources.filter((ds) => ds.enabled)
      setDatasources(enabled)
      const next = enabled.find((ds) => ds.id === datasourceId) ?? enabled[0] ?? null
      if (next) setDatasourceId(next.id)
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : "Unable to load datasource catalog.")
    } finally {
      setIsLoadingCatalog(false)
    }
  }, [datasourceId])

  useEffect(() => { void Promise.all([loadCatalog(), loadSavedResultSets()]).catch(() => {}) }, [loadCatalog, loadSavedResultSets])

  const runSearch = async (offset: number) => {
    const selectedDatasource = datasources.find((ds) => ds.id === datasourceId) ?? null
    if (!selectedDatasource) { setSearchStatus("No enabled datasources are available."); return }
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    try {
      setIsSearching(true)
      setExpandedRowId(null)
      setSearchStatus("Running datasource search. Results remain ephemeral until you save them.")
      const result = await apiRequest<DatasourceSearchResult>(
        `/api/datasources/${selectedDatasource.id}/search`,
        { body: JSON.stringify({ caseId: linkedCaseId, earliestTime, latestTime, limit: pageSize, offset, query }),
          headers: { "Content-Type": "application/json" }, method: "POST", signal: controller.signal })
      setSearchResult(result)
      setCurrentOffset(offset)
      const pageInfo = result.totalCount > result.rowCount
        ? ` (page ${Math.floor(offset / pageSize) + 1} of ${Math.ceil(result.totalCount / pageSize)}, ${result.totalCount} total)`
        : ""
      setSearchStatus(result.rowCount > 0
        ? `Returned ${result.rowCount} result${result.rowCount === 1 ? "" : "s"} in ${result.executionTimeMs}ms${pageInfo}. Save the set or add it to the timeline if it matters.`
        : "Search completed with no matching results.")
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") { setSearchStatus("Search cancelled."); return }
      setSearchResult(null)
      setSearchStatus(error instanceof Error ? error.message : "Unable to execute datasource search.")
    } finally { setIsSearching(false) }
  }

  const handlePromote = async (row: DatasourceSearchRow) => {
    const selectedDatasource = datasources.find((ds) => ds.id === datasourceId) ?? null
    if (!selectedDatasource) return
    try {
      setPromotingRowId(row.id)
      await apiRequest(`/api/rooms/${roomId}/artifacts`, {
        body: JSON.stringify({ artifact: {
          createdAt: Date.now(), deepLink: row.sourceUrl ? { href: row.sourceUrl, moduleId: "incident-workspace" } : undefined,
          id: crypto.randomUUID(), kind: "evidence",
          payload: { datasourceId: selectedDatasource.id, datasourceTitle: selectedDatasource.title,
            earliestTime, latestTime, query, raw: row.raw, roomId, sourceUrl: row.sourceUrl, vendor: selectedDatasource.vendor },
          relatedEntities: row.relatedEntities, sourceModule: selectedDatasource.vendor, summary: row.summary, title: row.title,
        }}),
        headers: { "Content-Type": "application/json" }, method: "POST",
      })
      setSearchStatus(`Promoted "${row.title}" into the investigation artifacts feed.`)
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : "Unable to promote result.")
    } finally { setPromotingRowId(null) }
  }

  const handleSaveResultSet = async () => {
    const selectedDatasource = datasources.find((ds) => ds.id === datasourceId) ?? null
    if (!selectedDatasource || !searchResult || searchResult.rows.length === 0) { setSearchStatus("Run a search with results before saving."); return }
    try {
      setIsSavingResultSet(true)
      const { artifact } = buildSavedResultArtifact({ datasource: selectedDatasource, earliestTime, latestTime, query, roomId, rows: searchResult.rows })
      await apiRequest(`/api/rooms/${roomId}/datasource-results`, {
        body: JSON.stringify({ artifact, datasourceId: selectedDatasource.id, datasourceTitle: selectedDatasource.title,
          earliestTime, latestTime, query, relatedEntities: artifact.relatedEntities,
          resultCount: searchResult.rowCount, rows: searchResult.rows, summary: artifact.summary, title: artifact.title, vendor: selectedDatasource.vendor }),
        headers: { "Content-Type": "application/json" }, method: "POST",
      })
      await loadSavedResultSets()
      setSearchStatus(`Saved ${searchResult.rowCount} result${searchResult.rowCount === 1 ? "" : "s"} as a room evidence set.`)
    } catch (error) {
      setSearchStatus(error instanceof Error ? error.message : "Unable to save datasource result set.")
    } finally { setIsSavingResultSet(false) }
  }

  const handleAddToTimeline = async () => {
    const selectedDatasource = datasources.find((ds) => ds.id === datasourceId) ?? null
    if (!selectedDatasource || !searchResult || searchResult.rows.length === 0) { setSearchStatus("Run a search with results before adding to timeline."); return }
    try {
      setIsAddingTimelineEntry(true)
      const entities = uniqueEntities(searchResult.rows)
      onAddTimelineEntry({ body: buildTimelineBody({ datasource: selectedDatasource, query, relatedEntities: entities.map((e) => e.label), rows: searchResult.rows }),
        linkedEntityIds: entities.map((e) => e.id), type: "update" })
      setSearchStatus("Added the current search context to the incident timeline.")
    } finally { setIsAddingTimelineEntry(false) }
  }

  const handlePromoteSavedResultSet = async (rs: SavedDatasourceResultSet) => {
    if (!linkedCaseId) { showToast({ message: "Link this room to a case before promoting.", tone: "error" }); return }
    try {
      setPromotingResultSetId(rs.id)
      await createCaseRecordViaApi(buildSavedEvidenceSetCasePromotionInput({ caseId: linkedCaseId, resultSet: rs, roomId }))
      showToast({ message: `Promoted "${rs.title}" into the case.`, tone: "success" })
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : "Unable to promote evidence set.", tone: "error" })
    } finally { setPromotingResultSetId(null) }
  }

  const handlePivotOnEntity = () => {
    if (!selectedEntityLabel) return
    const escaped = selectedEntityLabel.replace(/"/g, '\\"')
    setQuery(`index=* "${escaped}" | head 50`)
    setCurrentOffset(0)
    void runSearch(0)
  }

  const handleTemplateSelect = (value: string) => { setQuery(value); setCurrentOffset(0) }

  const handleLimitChange = (value: string) => { setLimit(value); setCurrentOffset(0) }

  return (
    <aside className="grid min-h-0 w-full gap-3">
      <DatasourceSearchForm
        datasources={datasources} datasourceId={datasourceId} onDatasourceChange={setDatasourceId}
        isLoadingCatalog={isLoadingCatalog} onTemplateSelect={handleTemplateSelect}
        selectedEntityLabel={selectedEntityLabel} onPivotEntity={handlePivotOnEntity}
        query={query} onQueryChange={setQuery}
        earliestTime={earliestTime} onEarliestTimeChange={setEarliestTime}
        latestTime={latestTime} onLatestTimeChange={setLatestTime}
        limit={limit} onLimitChange={handleLimitChange}
        isSearching={isSearching} isSavingResultSet={isSavingResultSet} isAddingTimelineEntry={isAddingTimelineEntry}
        searchResult={searchResult} searchStatus={searchStatus}
        currentPage={currentPage} totalPages={totalPages} totalCount={totalCount}
        onSearch={() => { setCurrentOffset(0); void runSearch(0) }}
        onCancel={() => abortControllerRef.current?.abort()}
        onSaveResultSet={() => void handleSaveResultSet()}
        onAddToTimeline={() => void handleAddToTimeline()}
        onPrevPage={() => void runSearch(Math.max(0, currentOffset - pageSize))}
        onNextPage={() => void runSearch(currentOffset + pageSize)}
      />
      <DatasourceSavedResultSets
        savedResultSets={savedResultSets} linkedCaseId={linkedCaseId}
        promotingResultSetId={promotingResultSetId}
        onSelectResultSet={(rs) => {
          setDatasourceId(rs.datasourceId); setQuery(rs.query)
          setEarliestTime(rs.earliestTime ?? ""); setLatestTime(rs.latestTime ?? "")
          setCurrentOffset(0)
          setSearchResult({ executionTimeMs: 0, rowCount: rs.resultCount, totalCount: rs.resultCount, rows: rs.rows })
          setSearchStatus(`Loaded saved evidence set "${rs.title}".`)
        }}
        onPromoteToCase={(rs) => void handlePromoteSavedResultSet(rs)}
      />
      {searchResult?.rows.map((row) => (
        <DatasourceSearchResultRow
          key={row.id} row={row}
          isExpanded={expandedRowId === row.id}
          isPromoting={promotingRowId === row.id}
          onPromote={() => void handlePromote(row)}
          onToggleExpand={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
        />
      ))}
    </aside>
  )
}
