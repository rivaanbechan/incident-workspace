"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IntegrationInstanceEditor } from "@/features/integrations/components/IntegrationInstanceEditor"
import { IntegrationInstanceList } from "@/features/integrations/components/IntegrationInstanceList"
import { IntegrationVendorCard } from "@/features/integrations/components/IntegrationVendorCard"
import type { DatasourceCategory, DatasourceDefinition, DatasourceInstallation } from "@/lib/datasources"

export type VendorGroup = {
  definition: DatasourceDefinition
  instances: DatasourceInstallation[]
  enabledCount: number
}

type Props = {
  vendorGroups: VendorGroup[]
  selectedVendor: string
  selectedInstanceId: string | null
  isLoading: boolean
  onSelectVendor: (vendor: string) => void
  onSelectInstance: (id: string | null) => void
  onSaved: (newId: string) => void
  onDeleted: () => void
}

type CategoryMeta = {
  id: DatasourceCategory
  label: string
  description: string
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: "search",
    label: "Data Sources",
    description: "SIEM and log platforms for analyst-driven search and evidence retrieval.",
  },
  {
    id: "llm",
    label: "AI Models",
    description: "Language model servers that power the AI analyst and agentic workflows.",
  },
  {
    id: "enrichment",
    label: "Enrichment",
    description: "Threat intelligence services that automatically enrich entities and IOCs.",
  },
]

function resolveInitialTab(vendorGroups: VendorGroup[], selectedVendor: string): DatasourceCategory {
  const current = vendorGroups.find((g) => g.definition.vendor === selectedVendor)
  return (current?.definition.category ?? "search") as DatasourceCategory
}

export function IntegrationCategoryTabs({
  isLoading,
  onDeleted,
  onSaved,
  onSelectInstance,
  onSelectVendor,
  selectedInstanceId,
  selectedVendor,
  vendorGroups,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<DatasourceCategory>(() =>
    resolveInitialTab(vendorGroups, selectedVendor),
  )

  const handleTabChange = (category: string) => {
    const cat = category as DatasourceCategory
    setActiveCategory(cat)
    const firstInCategory = vendorGroups.find((g) => g.definition.category === cat)
    if (firstInCategory && firstInCategory.definition.vendor !== selectedVendor) {
      onSelectVendor(firstInCategory.definition.vendor)
      onSelectInstance(null)
    }
  }

  return (
    <Tabs onValueChange={handleTabChange} value={activeCategory}>
      <TabsList className="mb-4 h-auto w-fit gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
        {CATEGORIES.map((cat) => {
          const groups = vendorGroups.filter((g) => g.definition.category === cat.id)
          if (groups.length === 0) return null
          const totalInstances = groups.reduce((sum, g) => sum + g.instances.length, 0)
          return (
            <TabsTrigger
              key={cat.id}
              className="gap-1.5 rounded-lg px-4 py-1.5 text-sm"
              value={cat.id}
            >
              {cat.label}
              {totalInstances > 0 ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold leading-none text-primary">
                  {totalInstances}
                </span>
              ) : null}
            </TabsTrigger>
          )
        })}
      </TabsList>

      {CATEGORIES.map((cat) => {
        const categoryGroups = vendorGroups.filter((g) => g.definition.category === cat.id)
        if (categoryGroups.length === 0) return null

        const selectedGroup = categoryGroups.find((g) => g.definition.vendor === selectedVendor)
        const activeGroup = selectedGroup ?? categoryGroups[0]
        const activeDefinition = activeGroup?.definition ?? null
        const activeInstances = activeGroup?.instances ?? []
        const activeInstance = activeInstances.find((i) => i.id === selectedInstanceId) ?? null

        return (
          <TabsContent className="grid gap-5" key={cat.id} value={cat.id}>
            {categoryGroups.length > 0 ? (
              <div>
                <p className="mb-3 text-sm text-muted-foreground">{cat.description}</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {categoryGroups.map(({ definition, enabledCount, instances }) => (
                    <IntegrationVendorCard
                      key={definition.vendor}
                      definition={definition}
                      enabledCount={enabledCount}
                      instances={instances}
                      isSelected={definition.vendor === selectedVendor ||
                        (!selectedGroup && definition.vendor === categoryGroups[0]?.definition.vendor)}
                      onClick={() => {
                        onSelectVendor(definition.vendor)
                        onSelectInstance(null)
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {activeInstances.length === 0 ? (
              <div className="max-w-2xl">
                <IntegrationInstanceEditor
                  onDeleted={onDeleted}
                  onNewInstance={() => onSelectInstance(null)}
                  onSaved={onSaved}
                  selectedDefinition={activeDefinition}
                  selectedInstance={null}
                  selectedVendor={activeDefinition?.vendor ?? selectedVendor}
                  vendorInstanceCount={0}
                />
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <IntegrationInstanceList
                  instances={activeInstances}
                  isLoading={isLoading}
                  onNewInstance={() => onSelectInstance(null)}
                  onSelectInstance={(id) => onSelectInstance(id)}
                  selectedDefinition={activeDefinition}
                  selectedInstanceId={selectedInstanceId}
                />
                <IntegrationInstanceEditor
                  onDeleted={onDeleted}
                  onNewInstance={() => onSelectInstance(null)}
                  onSaved={onSaved}
                  selectedDefinition={activeDefinition}
                  selectedInstance={activeInstance}
                  selectedVendor={activeDefinition?.vendor ?? selectedVendor}
                  vendorInstanceCount={activeInstances.length}
                />
              </div>
            )}
          </TabsContent>
        )
      })}
    </Tabs>
  )
}
