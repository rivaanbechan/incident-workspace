import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"

type FormFieldProps = {
  children: ReactNode
  htmlFor?: string
  label: ReactNode
  /**
   * "default" (standard form fields — shadcn Label + gap-2).
   * "compact" (dense panel fields — uppercase tracking label + gap-1.5, uses implicit label association).
   */
  variant?: "default" | "compact"
}

/**
 * FormField — label + input/select/textarea pairing.
 * Use `variant="compact"` for dense panel UIs (e.g. datasource search inputs).
 */
export function FormField({ children, htmlFor, label, variant = "default" }: FormFieldProps) {
  if (variant === "compact") {
    return (
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {children}
      </label>
    )
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
