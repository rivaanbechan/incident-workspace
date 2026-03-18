"use client"

import type { ColumnMapping } from "@/features/collab-hunt-graph/lib/types"
import { apiRequest } from "@/lib/api/client"
import type { DatasourceInstallation, DatasourceSearchRow } from "@/lib/datasources/types"
import { useCallback, useEffect, useRef, useState } from "react"

type DatasourceCatalogResponse = { datasources: DatasourceInstallation[] }

type RunQueryResult = {
  rows: DatasourceSearchRow[]
  columns: string[]
}

export type UseHuntGraphDatasourceReturn = {
  availableColumns: string[]
  columnMapping: ColumnMapping | null
  datasourceId: string
  datasources: DatasourceInstallation[]
  isLoadingCatalog: boolean
  isQuerying: boolean
  query: string
  rows: DatasourceSearchRow[]
  setColumnMapping: (mapping: ColumnMapping | null) => void
  setDatasourceId: (id: string) => void
  setQuery: (query: string) => void
  setTimeField: (field: string | null) => void
  statusMessage: string
  timeField: string | null
  runQuery: () => Promise<RunQueryResult | null>
  clearRows: () => void
}

export function useHuntGraphDatasource(
  initialDatasourceId: string | null,
  initialQuery: string,
  initialColumnMapping: ColumnMapping | null,
  initialTimeField: string | null,
): UseHuntGraphDatasourceReturn {
  const [datasources, setDatasources] = useState<DatasourceInstallation[]>([])
  const [datasourceId, setDatasourceId] = useState(initialDatasourceId ?? "")
  const [query, setQuery] = useState(initialQuery)
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(initialColumnMapping)
  const [timeField, setTimeField] = useState<string | null>(initialTimeField)
  const [rows, setRows] = useState<DatasourceSearchRow[]>([])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true)
  const [isQuerying, setIsQuerying] = useState(false)
  const [statusMessage, setStatusMessage] = useState(
    "Select a datasource, run a query, then map source and destination columns to build the graph.",
  )
  const abortRef = useRef<AbortController | null>(null)

  // Load datasource catalog on mount
  useEffect(() => {
    let cancelled = false

    setIsLoadingCatalog(true)
    apiRequest<DatasourceCatalogResponse>("/api/datasources", { cache: "no-store" })
      .then((payload) => {
        if (cancelled) return
        const enabled = payload.datasources.filter((ds) => ds.enabled)
        setDatasources(enabled)

        if (!datasourceId && enabled.length > 0) {
          setDatasourceId(enabled[0].id)
        }
      })
      .catch(() => {
        if (!cancelled) setStatusMessage("Unable to load datasource catalog.")
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCatalog(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runQuery = useCallback(async (): Promise<RunQueryResult | null> => {
    if (!datasourceId) {
      setStatusMessage("Select a datasource before running a query.")
      return null
    }
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setStatusMessage("Enter a query before running.")
      return null
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsQuerying(true)
    setStatusMessage("Running query…")

    try {
      const result = await apiRequest<{ rows: DatasourceSearchRow[]; totalCount: number }>(
        `/api/datasources/${datasourceId}/search`,
        {
          body: JSON.stringify({ limit: 500, offset: 0, query: trimmedQuery }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        },
      )

      const returnedRows = result.rows ?? []
      const columns = returnedRows.length > 0
        ? Object.keys(returnedRows[0].raw).filter((k) => !k.startsWith("_"))
        : []

      setRows(returnedRows)
      setAvailableColumns(columns)
      setStatusMessage(
        `${returnedRows.length} rows returned. Select source and destination columns, then build the graph.`,
      )

      return { columns, rows: returnedRows }
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return null
      setStatusMessage(error instanceof Error ? error.message : "Query failed.")
      return null
    } finally {
      setIsQuerying(false)
    }
  }, [datasourceId, query])

  const clearRows = useCallback(() => {
    setRows([])
    setAvailableColumns([])
  }, [])

  // Cleanup abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  return {
    availableColumns,
    clearRows,
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
  }
}
