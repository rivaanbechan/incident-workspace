import { AppShell } from "@/components/shell/AppShell"
import { PageHeader } from "@/components/shell/PageHeader"
import { DatasourceAdminPanel } from "@/features/integrations/components/DatasourceAdminPanel"
import { requireOrgPermission } from "@/lib/auth/access"
import { getPlatformOverview } from "@/lib/db/platform"
import { appModules } from "@/lib/modules/registry"

export async function IntegrationsPage() {
  const currentUser = await requireOrgPermission("manage_integrations")
  const platformOverview = await getPlatformOverview(appModules)

  return (
    <AppShell currentUser={currentUser} modules={appModules} platformOverview={platformOverview} title="Integrations">
      <div className="grid gap-6">
        <PageHeader
          eyebrow="Global Datasources"
          title="Platform integrations"
          description="Configure datasource instances once for the whole app. Investigation rooms can use these integrations, but rooms should not own connector credentials or settings."
        />
        <DatasourceAdminPanel />
      </div>
    </AppShell>
  )
}
