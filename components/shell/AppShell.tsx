import type { ReactNode } from "react"
import { cookies } from "next/headers"

import { hasOrgPermission, type AuthenticatedUser } from "@/lib/auth/permissions"
import type { PlatformOverview } from "@/lib/db/platform"
import type { AppModuleManifest } from "@/lib/modules/types"
import { CollapsibleSidebar } from "@/components/shell/CollapsibleSidebar"

type AppShellProps = {
  children: ReactNode
  currentUser: AuthenticatedUser
  fullBleed?: boolean
  platformOverview: PlatformOverview
  modules: AppModuleManifest[]
  title: string
}

export async function AppShell({
  children,
  currentUser,
  fullBleed,
  modules,
}: AppShellProps) {
  const cookieStore = await cookies()
  const defaultCollapsed = cookieStore.get("sidebar-collapsed")?.value === "true"

  const visibleModules = modules.filter((module) => {
    if (module.id !== "integrations") return true
    return hasOrgPermission(currentUser.orgRole, "manage_integrations")
  })

  return (
    <div className="flex h-screen w-full bg-background">
      <CollapsibleSidebar modules={visibleModules} currentUser={currentUser} defaultCollapsed={defaultCollapsed} />
      {fullBleed ? (
        <main className="relative flex-1 overflow-hidden h-full">
          {children}
        </main>
      ) : (
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
            {children}
          </div>
        </main>
      )}
    </div>
  )
}
