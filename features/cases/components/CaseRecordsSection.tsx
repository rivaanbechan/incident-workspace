import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CaseRecordCard } from "@/features/cases/components/CaseRecordCard"
import { LinkedEntitiesSection } from "@/features/cases/components/LinkedEntitiesSection"
import { Section } from "@/features/cases/components/Section"
import { formatTimestamp, getActionStatusBadgeVariant } from "@/features/cases/lib/formatters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { PersistedInvestigationArtifact } from "@/lib/contracts/artifacts"
import type { InvestigationCaseRecord } from "@/lib/contracts/caseRecords"
import type { InvestigationEntityDetail, InvestigationEntitySummary } from "@/lib/contracts/investigationEntities"
import type { SavedDatasourceResultSet } from "@/lib/datasources"

function csvList(values: unknown) {
  return Array.isArray(values)
    ? values.filter((v): v is string => typeof v === "string").join(", ")
    : ""
}

type Props = {
  investigation: { id: string; roomId: string }
  recordFindings: InvestigationCaseRecord[]
  recordHypotheses: InvestigationCaseRecord[]
  recordDecisions: InvestigationCaseRecord[]
  recordEvidence: InvestigationCaseRecord[]
  recordActions: InvestigationCaseRecord[]
  savedResultSets: SavedDatasourceResultSet[]
  importedArtifacts: PersistedInvestigationArtifact[]
  linkedEntities: InvestigationEntitySummary[]
  selectedEntityDetail: InvestigationEntityDetail | null
}

export function CaseRecordsSection({
  investigation, recordFindings, recordHypotheses, recordDecisions,
  recordEvidence, recordActions, savedResultSets, importedArtifacts,
  linkedEntities, selectedEntityDetail,
}: Props) {
  return (
    <div className="grid min-w-0 gap-5">
      <Section title="Findings">
        {recordFindings.length === 0 ? (
          <div className="text-sm text-muted-foreground">No case findings recorded yet.</div>
        ) : recordFindings.map((item) => (
          <CaseRecordCard key={item.id} caseId={investigation.id} recordId={item.id}
            badgeVariant="info" title={item.title} summary={item.summary}
            linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined}
            linkedArtifactIds={csvList(item.payload.linkedArtifactIds) || undefined} />
        ))}
      </Section>

      <div className="grid grid-cols-2 gap-5">
        <Section title="Hypotheses">
          {recordHypotheses.length === 0 ? (
            <div className="text-sm text-muted-foreground">No case hypotheses recorded yet.</div>
          ) : recordHypotheses.map((item) => (
            <CaseRecordCard key={item.id} caseId={investigation.id} recordId={item.id}
              badgeVariant="default" title={item.title} summary={item.summary}
              linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined} />
          ))}
        </Section>

        <Section title="Decisions">
          {recordDecisions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No case decisions recorded yet.</div>
          ) : recordDecisions.map((item) => (
            <CaseRecordCard key={item.id} caseId={investigation.id} recordId={item.id}
              badgeVariant="critical" title={item.title} summary={item.summary}
              linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined} />
          ))}
        </Section>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Section title="Supporting Evidence Sets">
          {savedResultSets.length === 0 ? (
            <div className="text-sm text-muted-foreground">No supporting evidence sets saved yet.</div>
          ) : savedResultSets.map((item) => (
            <div key={`result-set-${item.id}`} className="grid gap-2 rounded-2xl bg-muted p-4 text-sm leading-relaxed text-foreground">
              <Badge variant="success" className="w-fit uppercase tracking-[0.12em]">Evidence Set</Badge>
              <div className="font-bold text-foreground">{item.title}</div>
              <div>{item.summary}</div>
              <div className="text-xs text-muted-foreground">
                ID: {item.id} · {item.resultCount} result{item.resultCount === 1 ? "" : "s"} from {item.datasourceTitle}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Evidence">
          {recordEvidence.length === 0 ? (
            <div className="text-sm text-muted-foreground">No case evidence records are attached yet.</div>
          ) : recordEvidence.map((item) => (
            <CaseRecordCard key={item.id} caseId={investigation.id} recordId={item.id}
              badgeVariant="success" title={item.title} summary={item.summary}
              linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined}
              linkedArtifactIds={csvList(item.payload.linkedArtifactIds) || undefined} />
          ))}
        </Section>

        <Section title="Imported Artifacts">
          {importedArtifacts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No imported artifacts are attached yet.</div>
          ) : importedArtifacts.map((item) => (
            <Card key={item.id} className="border-border/50 shadow-none">
              <CardContent className="grid gap-2 p-4">
                <Badge variant="muted" className="w-fit uppercase tracking-[0.12em]">Imported Artifact</Badge>
                <div className="break-all text-sm font-bold text-foreground">{item.title}</div>
                <div className="break-all text-sm leading-relaxed text-muted-foreground">{item.summary}</div>
                <div className="text-xs text-muted-foreground">{item.kind} · {formatTimestamp(item.persistedAt)}</div>
              </CardContent>
            </Card>
          ))}
        </Section>

        <LinkedEntitiesSection
          caseId={investigation.id} roomId={investigation.roomId}
          entities={linkedEntities} selectedEntityDetail={selectedEntityDetail} />
      </div>

      <Section title="Open Actions">
        <div className="text-sm leading-relaxed text-muted-foreground">
          Actions are created in the workspace. Use this section to assign ownership, track status, and review what is still open.
        </div>
        {recordActions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No durable action records are attached yet.</div>
        ) : recordActions.map((action) => (
          <CaseRecordCard key={action.id} caseId={investigation.id} recordId={action.id}
            badgeVariant="critical" title={action.title} summary={action.summary}
            footer={
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Owner: {action.payload.owner || "Unassigned"}</Badge>
                <Badge variant={getActionStatusBadgeVariant(
                  typeof action.payload.status === "string" ? action.payload.status : "open"
                )} className="capitalize">
                  {typeof action.payload.status === "string"
                    ? action.payload.status.replaceAll("_", " ") : "open"}
                </Badge>
                {typeof action.payload.dueAt === "string" && action.payload.dueAt.trim() ? (
                  <Badge variant="info">Due {action.payload.dueAt}</Badge>
                ) : null}
              </div>
            } />
        ))}
        <Button asChild variant="secondary" size="sm" className="w-fit justify-start gap-2 text-xs">
          <Link href={`/board/${investigation.roomId}?tab=actions`}>
            <ArrowRight className="size-3" />
            Open Workspace To Review Current Actions
          </Link>
        </Button>
      </Section>
    </div>
  )
}
