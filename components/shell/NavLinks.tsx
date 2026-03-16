"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import type { AppModuleManifest } from "@/lib/modules/types"

export function NavLinks({ modules }: { modules: AppModuleManifest[] }) {
  const pathname = usePathname()

  return (
    <nav className="grid gap-0.5 px-2">
      {modules.map((module) => {
        const active = pathname === module.defaultHref || pathname.startsWith(module.defaultHref + "/")
        return (
          <Link
            key={module.id}
            href={module.defaultHref}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            {module.title}
          </Link>
        )
      })}
    </nav>
  )
}
