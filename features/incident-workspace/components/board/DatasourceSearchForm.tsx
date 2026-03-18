"use client"

import Link from "next/link"
import { EmptyState } from "@/components/shell/EmptyState"
import { FormField } from "@/components/shell/FormField"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { QUERY_TEMPLATES } from "@/features/incident-workspace/components/board/datasourceSearchHelpers"
import { getIntegrationsHref } from "@/features/integrations/manifest"
import type { DatasourceInstallation, DatasourceSearchResult } from "@/lib/datasources"

type Props = {
  datasources: DatasourceInstallation[]
  datasourceId: string
  onDatasourceChange: (id: string) => void
  isLoadingCatalog: boolean
  onTemplateSelect: (value: string) => void
  selectedEntityLabel?: string | null
  onPivotEntity: () => void
  query: string
  onQueryChange: (q: string) => void
  earliestTime: string
  onEarliestTimeChange: (v: string) => void
  latestTime: string
  onLatestTimeChange: (v: string) => void
  limit: string
  onLimitChange: (v: string) => void
  isSearching: boolean
  isSavingResultSet: boolean
  isAddingTimelineEntry: boolean
  searchResult: DatasourceSearchResult | null
  searchStatus: string
  currentPage: number
  totalPages: number | null
  totalCount: number | null
  onSearch: () => void
  onCancel: () => void
  onSaveResultSet: () => void
  onAddToTimeline: () => void
  onPrevPage: () => void
  onNextPage: () => void
}

export function DatasourceSearchForm({
  datasources, datasourceId, onDatasourceChange, isLoadingCatalog,
  onTemplateSelect, selectedEntityLabel, onPivotEntity,
  query, onQueryChange, earliestTime, onEarliestTimeChange,
  latestTime, onLatestTimeChange, limit, onLimitChange,
  isSearching, isSavingResultSet, isAddingTimelineEntry,
  searchResult, searchStatus, currentPage, totalPages, totalCount,
  onSearch, onCancel, onSaveResultSet, onAddToTimeline, onPrevPage, onNextPage,
}: Props) {
  const hasResults = (searchResult?.rows.length ?? 0) > 0

  return (
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
                <Badge variant="secondary">Page {currentPage + 1} / {totalPages}</Badge>
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
                No enabled datasource instances are available. Configure one in{" "}
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
            onChange={(e) => onDatasourceChange(e.target.value)}
            disabled={datasources.length === 0}
          >
            {datasources.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.title}</option>
            ))}
          </Select>
        </FormField>

        <FormField variant="compact" label="Query template">
          <Select value="" onChange={(e) => { if (e.target.value) onTemplateSelect(e.target.value) }}>
            {QUERY_TEMPLATES.map((t) => (
              <option key={t.label} value={t.value}>{t.label}</option>
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
            <Button onClick={onPivotEntity} disabled={isSearching} size="sm" variant="secondary" className="shrink-0">
              Pivot
            </Button>
          </div>
        ) : null}

        <FormField variant="compact" label="Query">
          <Textarea
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            rows={5}
            className="resize-y font-mono text-xs"
          />
        </FormField>

        <div className="grid grid-cols-3 gap-2.5">
          <FormField variant="compact" label="Earliest">
            <Input value={earliestTime} onChange={(e) => onEarliestTimeChange(e.target.value)} />
          </FormField>
          <FormField variant="compact" label="Latest">
            <Input value={latestTime} onChange={(e) => onLatestTimeChange(e.target.value)} />
          </FormField>
          <FormField variant="compact" label="Page size">
            <Input value={limit} onChange={(e) => onLimitChange(e.target.value)} />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSearch} disabled={isSearching || datasources.length === 0}>
            {isSearching ? "Running..." : "Run Search"}
          </Button>
          {isSearching ? (
            <Button onClick={onCancel} variant="destructive" size="default">Cancel</Button>
          ) : null}
          <Button onClick={onSaveResultSet} disabled={isSavingResultSet || !hasResults} variant="secondary">
            {isSavingResultSet ? "Saving..." : "Save Evidence Set"}
          </Button>
          <Button onClick={onAddToTimeline} disabled={isAddingTimelineEntry || !hasResults} variant="outline">
            {isAddingTimelineEntry ? "Adding..." : "Add to Timeline"}
          </Button>
        </div>

        {totalPages !== null && totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button onClick={onPrevPage} disabled={isSearching || currentPage === 0} size="sm" variant="outline">
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage + 1} of {totalPages} ({totalCount} total)
            </span>
            <Button onClick={onNextPage} disabled={isSearching || currentPage + 1 >= totalPages} size="sm" variant="outline">
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
