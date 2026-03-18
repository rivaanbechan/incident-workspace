"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { IntegrationCategoryTabs } from "@/features/integrations/components/IntegrationCategoryTabs"
import type { VendorGroup } from "@/features/integrations/components/IntegrationCategoryTabs"
import { apiRequest } from "@/lib/api/client"
import type { DatasourceDefinition, DatasourceInstallation } from "@/lib/datasources"

type CatalogResponse = {
  definitions: DatasourceDefinition[]
  datasources: DatasourceInstallation[]
}

export function DatasourceAdminPanel() {
  const [definitions, setDefinitions] = useState<DatasourceDefinition[]>([])
  const [datasources, setDatasources] = useState<DatasourceInstallation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedVendor, setSelectedVendor] = useState("splunk")
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)

  const loadDatasources = useCallback(async () => {
    try {
      setIsLoading(true)
      const payload = await apiRequest<CatalogResponse>("/api/datasources", { cache: "no-store" })
      setDefinitions(payload.definitions)
      setDatasources(payload.datasources)
      setSelectedVendor((prev) =>
        payload.definitions.some((d) => d.vendor === prev)
          ? prev
          : (payload.definitions[0]?.vendor ?? "splunk"),
      )
    } catch {
      // Error surfaced inside child editor via its own status
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDatasources()
  }, [loadDatasources])

  const vendorGroups = useMemo<VendorGroup[]>(
    () =>
      definitions.map((definition) => {
        const instances = datasources.filter((d) => d.vendor === definition.vendor)
        return { definition, enabledCount: instances.filter((i) => i.enabled).length, instances }
      }),
    [datasources, definitions],
  )

  const handleSaved = useCallback(
    async (newId: string) => {
      await loadDatasources()
      if (newId) setSelectedInstanceId(newId)
    },
    [loadDatasources],
  )

  const handleDeleted = useCallback(async () => {
    setSelectedInstanceId(null)
    await loadDatasources()
  }, [loadDatasources])

  return (
    <IntegrationCategoryTabs
      isLoading={isLoading}
      onDeleted={handleDeleted}
      onSaved={handleSaved}
      onSelectInstance={setSelectedInstanceId}
      onSelectVendor={setSelectedVendor}
      selectedInstanceId={selectedInstanceId}
      selectedVendor={selectedVendor}
      vendorGroups={vendorGroups}
    />
  )
}
