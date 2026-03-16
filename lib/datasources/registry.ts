import { splunkAdapter } from "@/lib/datasources/splunk"
import type { DatasourceAdapter, DatasourceDefinition } from "@/lib/datasources/types"

const datasourceAdapters: DatasourceAdapter[] = [splunkAdapter]

export const datasourceDefinitions: DatasourceDefinition[] = datasourceAdapters.map(
  (adapter) => adapter.definition,
)

export function getDatasourceDefinitionById(datasourceId: string) {
  return datasourceDefinitions.find((definition) => definition.id === datasourceId) ?? null
}

export function getDatasourceAdapterByVendor(vendor: string) {
  return datasourceAdapters.find((adapter) => adapter.definition.vendor === vendor) ?? null
}

export function listDatasourceDefinitions() {
  return datasourceDefinitions
}
