"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertTriangle,
  Blocks,
  BookOpen,
  LogOut,
  Network,
  PanelLeft,
  Shield,
} from "lucide-react"

import { signOutAction } from "@/lib/auth/actions"
import { hasOrgPermission, type AuthenticatedUser } from "@/lib/auth/permissions"
import type { AppModuleManifest } from "@/lib/modules/types"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/shell/ThemeToggle"

const MODULE_ICONS: Record<string, React.ElementType> = {
  "cases": BookOpen,
  "incident-workspace": AlertTriangle,
  "collab-hunt-graph": Network,
  "integrations": Blocks,
}

const MODULE_HREF_GENERATORS: Record<string, () => string> = {
  "incident-workspace": () => `/board/${crypto.randomUUID()}`,
}

function NavItem({
  module,
  collapsed,
}: {
  module: AppModuleManifest
  collapsed: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const active = pathname === module.defaultHref || pathname.startsWith(module.defaultHref + "/")
  const Icon = MODULE_ICONS[module.id] ?? BookOpen
  const generateHref = MODULE_HREF_GENERATORS[module.id]

  function handleClick(e: React.MouseEvent) {
    if (!generateHref) return
    e.preventDefault()
    router.push(generateHref())
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={module.defaultHref}
            onClick={handleClick}
            className={cn(
              "flex h-9 w-full items-center justify-center rounded-md transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{module.title}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Link
      href={module.defaultHref}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {module.title}
    </Link>
  )
}

export function CollapsibleSidebar({
  modules,
  currentUser,
  defaultCollapsed = false,
}: {
  modules: AppModuleManifest[]
  currentUser: AuthenticatedUser
  defaultCollapsed?: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      document.cookie = `sidebar-collapsed=${next}; path=/; max-age=31536000; SameSite=Lax`
      return next
    })
  }

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const isAdmin = hasOrgPermission(currentUser.orgRole, "view_admin")

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "sticky top-0 z-20 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
          collapsed ? "w-[60px]" : "w-56"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center border-b border-sidebar-border px-3">
          {!collapsed && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
                <span className="text-[10px] font-bold">IW</span>
              </div>
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                Incident Workspace
              </span>
            </div>
          )}
          {collapsed && (
            <div className="flex size-6 shrink-0 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground mx-auto">
              <span className="text-[10px] font-bold">IW</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className={cn(
              "size-7 shrink-0 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "hidden"
            )}
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-3">
          <nav className={cn("grid gap-0.5", collapsed ? "px-1.5" : "px-2")}>
            {modules.map((module) => (
              <NavItem key={module.id} module={module} collapsed={collapsed} />
            ))}
          </nav>
        </ScrollArea>

        {/* User */}
        <div className={cn("border-t border-sidebar-border", collapsed ? "p-1.5" : "p-3")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar size="sm" className="cursor-default">
                    <AvatarFallback
                      style={{ backgroundColor: currentUser.color }}
                      className="text-[10px] font-semibold text-white"
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{currentUser.name}</p>
                  <p className="text-xs opacity-70">{currentUser.email}</p>
                </TooltipContent>
              </Tooltip>
              <Separator className="my-1 bg-sidebar-border" />
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="size-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                      <Link href="/admin"><Shield className="size-4" /></Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Admin</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    onClick={() => signOutAction()}
                  >
                    <LogOut className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    onClick={toggle}
                  >
                    <PanelLeft className="size-4 rotate-180" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2.5 rounded-md px-2 py-1.5">
                <Avatar size="sm">
                  <AvatarFallback
                    style={{ backgroundColor: currentUser.color }}
                    className="text-[10px] font-semibold text-white"
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-sidebar-foreground">{currentUser.name}</div>
                  <div className="truncate text-[10px] text-sidebar-foreground/50">{currentUser.email}</div>
                </div>
                <Badge variant="outline" className="shrink-0 border-sidebar-border px-1.5 py-0 text-[9px] text-sidebar-foreground/60">
                  {currentUser.orgRole.replaceAll("_", " ")}
                </Badge>
              </div>
              <Separator className="mb-2 bg-sidebar-border" />
              <div className="grid gap-0.5">
                {isAdmin && (
                  <Button asChild size="sm" variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <Link href="/admin">
                      <Shield className="mr-2 size-3.5" />
                      Admin
                    </Link>
                  </Button>
                )}
                <form action={signOutAction}>
                  <Button size="sm" variant="ghost" type="submit" className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <LogOut className="mr-2 size-3.5" />
                    Sign out
                  </Button>
                </form>
                <ThemeToggle />
              </div>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
