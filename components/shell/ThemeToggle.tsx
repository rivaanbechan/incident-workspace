"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <Button size="sm" type="button" variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" disabled>
        <Moon className="mr-2 size-4" />
        Dark mode
      </Button>
    )
  }

  return (
    <Button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size="sm"
      type="button"
      variant="ghost"
      className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="mr-2 size-4" />
      ) : (
        <Moon className="mr-2 size-4" />
      )}
      {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  )
}
