"use client"

import type { UseHuntGraphDatasourceReturn } from "@/features/collab-hunt-graph/hooks/useHuntGraphDatasource"
import { FormField } from "@/components/shell/FormField"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

type HuntGraphQueryPanelProps = {
  datasource: UseHuntGraphDatasourceReturn
  isBuilding: boolean
  onBuildGraph: () => void
  onExpandNode: () => void
  hasSelectedNode: boolean
}

function ColumnSelector({
  columns,
  id,
  label,
  onChange,
  value,
}: {
  columns: string[]
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <FormField htmlFor={id} label={label}>
      <Select id={id} onChange={(e) => onChange(e.target.value)} value={value}>
        <option value="">— select column —</option>
        {columns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </Select>
    </FormField>
  )
}

export function HuntGraphQueryPanel({
  datasource,
  hasSelectedNode,
  isBuilding,
  onBuildGraph,
  onExpandNode,
}: HuntGraphQueryPanelProps) {
  const {
    availableColumns,
    columnMapping,
    datasourceId,
    datasources,
    isLoadingCatalog,
    isQuerying,
    query,
    rows,
    setColumnMapping,
    setDatasourceId,
    setQuery,
    setTimeField,
    statusMessage,
    timeField,
    runQuery,
  } = datasource

  const hasRows = rows.length > 0
  const canBuild =
    hasRows &&
    columnMapping !== null &&
    columnMapping.sourceColumn !== "" &&
    columnMapping.destColumn !== ""

  const handleSourceColumn = (col: string) => {
    setColumnMapping(
      col
        ? { destColumn: columnMapping?.destColumn ?? "", labelColumn: columnMapping?.labelColumn ?? null, sourceColumn: col }
        : null,
    )
  }

  const handleDestColumn = (col: string) => {
    setColumnMapping(
      col
        ? { destColumn: col, labelColumn: columnMapping?.labelColumn ?? null, sourceColumn: columnMapping?.sourceColumn ?? "" }
        : null,
    )
  }

  const handleLabelColumn = (col: string) => {
    if (!columnMapping) return
    setColumnMapping({ ...columnMapping, labelColumn: col || null })
  }

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Query</CardTitle>
        <CardDescription className="text-sm leading-6">{statusMessage}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <FormField htmlFor="hg-datasource" label="Datasource">
          <Select
            disabled={isLoadingCatalog || datasources.length === 0}
            id="hg-datasource"
            onChange={(e) => setDatasourceId(e.target.value)}
            value={datasourceId}
          >
            {datasources.length === 0 && (
              <option value="">
                {isLoadingCatalog ? "Loading…" : "No datasources configured"}
              </option>
            )}
            {datasources.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.title}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField htmlFor="hg-query" label="Query">
          <Textarea
            id="hg-query"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="index=* earliest=-24h | table src_ip dest_ip | head 200"
            rows={4}
            value={query}
          />
        </FormField>

        <Button
          disabled={isQuerying || !datasourceId}
          onClick={() => { void runQuery() }}
          type="button"
        >
          {isQuerying ? "Running…" : "Run Query"}
        </Button>

        {hasRows && (
          <div className="grid gap-3 border-t border-border/40 pt-3">
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Column mapping — {rows.length} rows
            </div>

            <ColumnSelector
              columns={availableColumns}
              id="hg-src-col"
              label="Source column"
              onChange={handleSourceColumn}
              value={columnMapping?.sourceColumn ?? ""}
            />
            <ColumnSelector
              columns={availableColumns}
              id="hg-dst-col"
              label="Destination column"
              onChange={handleDestColumn}
              value={columnMapping?.destColumn ?? ""}
            />
            <ColumnSelector
              columns={availableColumns}
              id="hg-label-col"
              label="Label column (optional)"
              onChange={handleLabelColumn}
              value={columnMapping?.labelColumn ?? ""}
            />
            <ColumnSelector
              columns={availableColumns}
              id="hg-time-col"
              label="Time field (timeline)"
              onChange={setTimeField}
              value={timeField ?? ""}
            />

            <Button
              className="bg-success hover:bg-success/90"
              disabled={!canBuild || isBuilding}
              onClick={onBuildGraph}
              type="button"
            >
              {isBuilding ? "Building…" : "Build Shared Graph"}
            </Button>

            {hasSelectedNode && (
              <Button
                disabled={isQuerying}
                onClick={onExpandNode}
                type="button"
                variant="outline"
              >
                {isQuerying ? "Expanding…" : "Expand Selected Node"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
