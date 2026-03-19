"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type NewRoleDialogProps = {
  open: boolean
  onClose: () => void
  onCreate: (name: string, label: string) => Promise<void>
}

export function NewRoleDialog({ open, onClose, onCreate }: NewRoleDialogProps) {
  const [name, setName] = useState("")
  const [label, setLabel] = useState("")
  const [saving, setSaving] = useState(false)

  function handleClose() {
    setName("")
    setLabel("")
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !label.trim()) return

    setSaving(true)

    try {
      await onCreate(name.trim(), label.trim())
      toast.success(`Role "${label}" created.`)
      handleClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create custom role</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="role-label">Display name</Label>
            <Input
              id="role-label"
              placeholder="e.g. Security Analyst"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="role-name">Internal name</Label>
            <Input
              id="role-name"
              placeholder="e.g. security_analyst"
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-z0-9_]/g, ""))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits, and underscores only.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name || !label}>
              {saving ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
