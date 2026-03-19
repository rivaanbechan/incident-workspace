import { AppShell } from "@/components/shell/AppShell"
import { PageHeader } from "@/components/shell/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/native-select"
import { AdminTabNav } from "@/features/admin/components/AdminTabNav"
import { createOrganizationUserAction, updateOrganizationRoleAction } from "@/features/admin/actions"
import { ORG_ROLE_LABELS, type AuthenticatedUser, type OrgRole } from "@/lib/auth/permissions"
import { requireOrgPermission } from "@/lib/auth/access"
import { listOrganizationUsers } from "@/lib/db/auth"
import { getPlatformOverview } from "@/lib/db/platform"
import { appModules } from "@/lib/modules/registry"

function roleOptions() {
  return Object.entries(ORG_ROLE_LABELS) as [OrgRole, string][]
}

function userChip(user: AuthenticatedUser) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-8 shrink-0 rounded-full ring-2 ring-white shadow-sm" style={{ background: user.color }} />
      <div className="grid gap-0.5">
        <span className="text-sm font-semibold">{user.name}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
      </div>
    </div>
  )
}

export default async function AdminPage() {
  const currentUser = await requireOrgPermission("view_admin")
  const [platformOverview, users] = await Promise.all([
    getPlatformOverview(appModules),
    listOrganizationUsers(),
  ])

  return (
    <AppShell currentUser={currentUser} modules={appModules} platformOverview={platformOverview} title="Admin">
      <div className="grid gap-6">
        <AdminTabNav />
        <PageHeader
          eyebrow="Organization Access"
          title="User and role management"
          description="Create users directly and assign their organization role. Case access is still managed inside each case."
          badges={
            <>
              <Badge>{users.length} members</Badge>
              <Badge variant="secondary">{currentUser.orgRole.replaceAll("_", " ")}</Badge>
            </>
          }
        />

        <Card>
          <div className="h-0.5 bg-gradient-to-r from-primary/70 via-primary/25 to-transparent" />
          <CardHeader>
            <CardTitle>Create user</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createOrganizationUserAction} className="grid max-w-xl gap-3">
              <Input name="name" placeholder="Full name" required />
              <Input name="email" placeholder="name@example.com" required type="email" />
              <Input name="password" placeholder="Temporary password" required type="password" />
              <Select defaultValue="viewer" name="orgRole">
              {roleOptions().map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
              </Select>
              <Button className="w-fit" type="submit">
              Create user
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization members</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {users.map((user) => (
              <form
                action={updateOrganizationRoleAction}
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/50 p-3.5 transition-colors hover:bg-muted"
              >
                <input name="userId" type="hidden" value={user.id} />
                {userChip({
                  color: user.color,
                  email: user.email,
                  id: user.id,
                  name: user.name,
                  orgId: currentUser.orgId,
                  orgRole: user.orgRole,
                })}
                <div className="flex items-center gap-2">
                  <Select className="min-w-44" defaultValue={user.orgRole} key={user.orgRole} name="orgRole">
                    {roleOptions().map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" variant="secondary">
                    Update
                  </Button>
                </div>
              </form>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
