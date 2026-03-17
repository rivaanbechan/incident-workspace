import type { ReactNode } from "react"
import type { VariantProps } from "class-variance-authority"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { removeCaseRecordAction } from "@/features/cases/actions"

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

type CaseRecordCardProps = {
  caseId: string
  recordId: string
  badgeVariant: BadgeVariant
  title: string
  summary?: string
  linkedEvidenceSetIds?: string
  linkedArtifactIds?: string
  footer?: ReactNode
}

export function CaseRecordCard({
  caseId,
  recordId,
  badgeVariant,
  title,
  summary,
  linkedEvidenceSetIds,
  linkedArtifactIds,
  footer,
}: CaseRecordCardProps) {
  return (
    <article className="grid gap-2 rounded-2xl bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={badgeVariant} className="uppercase tracking-[0.12em]">
          Case Record
        </Badge>
        <form action={removeCaseRecordAction}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="recordId" value={recordId} />
          <Button size="sm" type="submit" variant="destructive">
            Remove From Case
          </Button>
        </form>
      </div>
      <div className="text-[15px] font-bold text-foreground">{title}</div>
      {summary ? (
        <div className="text-sm leading-relaxed text-muted-foreground">{summary}</div>
      ) : null}
      {linkedEvidenceSetIds ? (
        <div className="text-xs text-muted-foreground">
          Evidence sets: {linkedEvidenceSetIds}
        </div>
      ) : null}
      {linkedArtifactIds ? (
        <div className="text-xs text-muted-foreground">
          Artifacts: {linkedArtifactIds}
        </div>
      ) : null}
      {footer}
    </article>
  )
}
