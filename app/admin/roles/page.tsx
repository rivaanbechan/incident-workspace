import { AppShell } from "@/components/shell/AppShell"
import { PageHeader } from "@/components/shell/PageHeader"
import { AdminTabNav } from "@/features/admin/components/AdminTabNav"
import { RolesPage } from "@/features/admin/pages/RolesPage"
import { requireOrgPermission } from "@/lib/auth/access"
import { getPlatformOverview } from "@/lib/db/platform"
import { appModules } from "@/lib/modules/registry"

export default async function AdminRolesPage() {
  const currentUser = await requireOrgPermission("view_admin")
  const platformOverview = await getPlatformOverview(appModules)

  return (
    <AppShell
      currentUser={currentUser}
      modules={appModules}
      platformOverview={platformOverview}
      title="Admin"
    >
      <div className="grid gap-6">
        <AdminTabNav />
        <PageHeader
          eyebrow="Access Control"
          title="Roles & Permissions"
          description="Configure what each role can do across the platform and within cases."
        />
        <RolesPage />
      </div>
    </AppShell>
  )
}
