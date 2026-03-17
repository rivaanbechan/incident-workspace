import type { EntityRef } from "@/lib/contracts/entities"

export type DatasourceVendorId = string

export type DatasourceConfigPayload = Record<string, unknown>

export type DatasourceCapabilities = {
  supportsHealthcheck: boolean
  supportsSearch: boolean
}

export type DatasourceDefinition = {
  capabilities: DatasourceCapabilities
  description: string
  id: string
  title: string
  vendor: DatasourceVendorId
}

export type DatasourceInstallation = {
  baseUrl: string
  createdAt: string
  enabled: boolean
  id: string
  skipTlsVerify: boolean
  title: string
  updatedAt: string
  vendor: DatasourceVendorId
}

export type StoredDatasourceInstallation = DatasourceInstallation & {
  config: DatasourceConfigPayload
}

export type DatasourceConnectionStatus = {
  checkedAt: string
  message: string
  ok: boolean
}

export type DatasourceSearchRequest = {
  earliestTime?: string
  latestTime?: string
  limit?: number
  offset?: number
  query: string
  signal?: AbortSignal
}

export type DatasourceSearchRow = {
  id: string
  occurredAt: string | null
  raw: Record<string, unknown>
  relatedEntities: EntityRef[]
  sourceUrl: string | null
  summary: string
  title: string
}

export type DatasourceSearchResult = {
  executionTimeMs: number
  rowCount: number
  totalCount: number
  rows: DatasourceSearchRow[]
}

export type SavedDatasourceResultSet = {
  createdAt: string
  datasourceId: string
  datasourceTitle: string
  earliestTime: string | null
  id: string
  latestTime: string | null
  query: string
  relatedEntities: EntityRef[]
  resultCount: number
  roomId: string
  rows: DatasourceSearchRow[]
  summary: string
  title: string
  vendor: DatasourceVendorId
}

export type DatasourceConfigurationInput = {
  baseUrl: string
  config: DatasourceConfigPayload
  enabled?: boolean
  id?: string
  title: string
  vendor: DatasourceVendorId
}

export type DatasourceAdapter = {
  definition: DatasourceDefinition
  executeSearch?: (
    datasource: StoredDatasourceInstallation,
    request: DatasourceSearchRequest,
  ) => Promise<DatasourceSearchResult>
  testConnection?: (
    datasource: StoredDatasourceInstallation,
  ) => Promise<DatasourceConnectionStatus>
  validateConfig: (
    config: DatasourceConfigPayload,
    options?: { existingConfig?: DatasourceConfigPayload | null },
  ) => DatasourceConfigPayload
}
