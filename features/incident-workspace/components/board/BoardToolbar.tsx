"use client"

import { Button } from "@/components/ui/button"

type BoardToolbarProps = {
  canDeleteSelected: boolean
  onDeleteSelected: () => void
}

function ToolbarButton({
  disabled = false,
  label,
  onClick,
}: {
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      className="min-h-9 w-full justify-start text-xs font-extrabold uppercase tracking-[0.08em]"
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant="secondary"
    >
      {label}
    </Button>
  )
}

export function BoardToolbar({
  canDeleteSelected,
  onDeleteSelected,
}: BoardToolbarProps) {
  return (
    <ToolbarButton
      disabled={!canDeleteSelected}
      label="Delete Selected"
      onClick={onDeleteSelected}
    />
  )
}
