import { AppShell } from "@/components/shell/AppShell"
import { PageHeader } from "@/components/shell/PageHeader"
import { AgentAdminPanel } from "@/features/agents/components/AgentAdminPanel"
import { requireOrgPermission } from "@/lib/auth/access"
import { getPlatformOverview } from "@/lib/db/platform"
import { appModules } from "@/lib/modules/registry"

export async function AgentsPage() {
  const currentUser = await requireOrgPermission("view_admin")
  const platformOverview = await getPlatformOverview(appModules)

  return (
    <AppShell currentUser={currentUser} modules={appModules} platformOverview={platformOverview} title="AI Agents">
      <div className="grid gap-8 p-6">
        <PageHeader
          description="Configure AI agents that analysts can invoke during investigations."
          eyebrow="Admin"
          title="AI Agents"
        />
        <AgentAdminPanel />
      </div>
    </AppShell>
  )
}
