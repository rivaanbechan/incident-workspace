import { CaseMembersPanel } from "@/features/cases/components/CaseMembersPanel"
import { CaseMetadataPanel } from "@/features/cases/components/CaseMetadataPanel"
import { CaseRecordsSection } from "@/features/cases/components/CaseRecordsSection"
import { CaseTimelineAside } from "@/features/cases/components/CaseTimelineAside"
import { formatTimestamp, getSeverityBadgeVariant, getStatusBadgeVariant } from "@/features/cases/lib/formatters"
import { AppShell } from "@/components/shell/AppShell"
import { PageHeader } from "@/components/shell/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { requireCasePermissionByCaseId } from "@/lib/auth/access"
import type { PersistedInvestigationArtifact } from "@/lib/contracts/artifacts"
import { listRoomArtifacts } from "@/lib/db/artifacts"
import { listCaseMemberships } from "@/lib/db/auth"
import { listInvestigationCaseRecords } from "@/lib/db/caseRecords"
import { listInvestigations } from "@/lib/db/investigationAggregates"
import { getInvestigationById, listInvestigationActivity } from "@/lib/db/investigations"
import { getPlatformOverview } from "@/lib/db/platform"
import { listSavedDatasourceResultSets } from "@/lib/db/datasourceResults"
import { getInvestigationEntityDetail, listInvestigationEntitySummaries } from "@/lib/db/investigationEntities"
import { appModules } from "@/lib/modules/registry"
import Link from "next/link"
import { notFound } from "next/navigation"

type Props = { caseId: string; selectedEntityId?: string | null }

function summarizeArtifacts(artifacts: PersistedInvestigationArtifact[], kinds: PersistedInvestigationArtifact["kind"][]) {
  return artifacts.filter((a) => kinds.includes(a.kind))
}

function isSavedEvidenceSetArtifact(artifact: PersistedInvestigationArtifact) {
  return artifact.kind === "evidence" && Array.isArray(artifact.payload?.rows)
}

export async function CaseDetailPage({ caseId, selectedEntityId = null }: Props) {
  const currentUser = await requireCasePermissionByCaseId(caseId, "view")
  const platformOverview = await getPlatformOverview(appModules)
  const [investigation, overviewList] = await Promise.all([
    getInvestigationById(caseId),
    listInvestigations({ archived: "all" }),
  ])

  if (!investigation) notFound()

  const overview = overviewList.find((item) => item.id === caseId) ?? null
  const [artifacts, activity, caseMembers, caseRecords, savedResultSets, investigationEntities, selectedEntityDetail] =
    await Promise.all([
      listRoomArtifacts(investigation.roomId),
      listInvestigationActivity(caseId),
      listCaseMemberships(caseId),
      listInvestigationCaseRecords(caseId),
      listSavedDatasourceResultSets(investigation.roomId),
      listInvestigationEntitySummaries(caseId),
      selectedEntityId ? getInvestigationEntityDetail(caseId, selectedEntityId) : Promise.resolve(null),
    ])

  const importedArtifacts = artifacts.filter(
    (a) => (a.kind === "evidence" || a.kind === "note" || a.kind === "finding" ||
      a.kind === "hypothesis" || a.kind === "decision" || a.kind === "graph-selection" ||
      a.kind === "ioc" || a.kind === "sigma-match") && !isSavedEvidenceSetArtifact(a),
  )
  const caseTimeline = [
    ...activity.map((item) => ({ body: item.summary, createdAt: new Date(item.createdAt).getTime(),
      id: `activity-${item.id}`, linkedActionIds: [] as string[], linkedEntityIds: [] as string[],
      source: "case" as const, type: item.kind })),
    ...artifacts.map((artifact) => ({ body: artifact.summary, createdAt: new Date(artifact.persistedAt).getTime(),
      id: `artifact-${artifact.id}`, linkedActionIds: [] as string[],
      linkedEntityIds: (artifact.relatedEntities ?? []).map((e) => e.id),
      source: "artifact" as const, type: artifact.kind })),
    ...caseRecords.map((record) => ({ body: record.summary, createdAt: new Date(record.updatedAt).getTime(),
      id: `record-${record.id}`, linkedActionIds: record.kind === "action" ? [record.sourceId] : [] as string[],
      linkedEntityIds: record.relatedEntities.map((e) => e.id), source: "record" as const, type: record.kind })),
  ].sort((l, r) => r.createdAt - l.createdAt).slice(0, 16)

  const canManageMembers = currentUser.orgRole === "org_admin" || currentUser.caseRole === "case_owner"

  const STATS = [
    { label: "Findings", value: overview?.counts.findingCount ?? 0 },
    { label: "Board Objects", value: overview?.counts.boardEntityCount ?? 0 },
    { label: "Evidence Sets", value: overview?.counts.evidenceSetCount ?? 0 },
    { label: "Entities", value: overview?.counts.entityCount ?? 0 },
    { label: "Hypotheses", value: overview?.counts.hypothesisCount ?? 0 },
    { label: "Open Actions", value: overview?.counts.openActionCount ?? 0 },
    { label: "Timeline", value: overview?.counts.timelineEntryCount ?? 0 },
    { label: "Decisions", value: overview?.counts.decisionCount ?? 0 },
  ]

  return (
    <AppShell currentUser={currentUser} modules={appModules} platformOverview={platformOverview} title="Cases">
      <div className="grid w-full gap-6">
        <PageHeader
          eyebrow="Durable Investigation"
          title={investigation.title}
          description={investigation.summary || "No summary yet."}
          actions={
            <>
              <Button asChild variant="secondary"><Link href="/cases">Back to Cases</Link></Button>
              <Button asChild><Link href={`/board/${investigation.roomId}?fit=1`}>Open Workspace</Link></Button>
            </>
          }
          badges={
            <>
              <Badge variant={getStatusBadgeVariant(investigation.status)}>{investigation.status}</Badge>
              <Badge variant={getSeverityBadgeVariant(investigation.severity)}>{investigation.severity}</Badge>
              <Badge variant="secondary">Owner {investigation.owner}</Badge>
              {investigation.archivedAt ? (
                <Badge variant="warning">Archived {formatTimestamp(investigation.archivedAt)}</Badge>
              ) : null}
            </>
          }
        />

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {STATS.map((item) => (
            <Card key={item.label} className="border-border/60 bg-card shadow-sm">
              <CardContent className="p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid w-full items-start gap-6 xl:grid-cols-[320px_minmax(0,1.35fr)_minmax(380px,1.05fr)]">
          <div className="grid content-start gap-5">
            <CaseMetadataPanel investigation={investigation} />
            <CaseMembersPanel caseId={investigation.id} caseMembers={caseMembers}
              currentUserId={currentUser.id} canManageMembers={canManageMembers} />
          </div>

          <CaseRecordsSection
            investigation={investigation}
            recordFindings={caseRecords.filter((r) => r.kind === "finding")}
            recordHypotheses={caseRecords.filter((r) => r.kind === "hypothesis")}
            recordDecisions={caseRecords.filter((r) => r.kind === "decision")}
            recordEvidence={caseRecords.filter((r) => r.kind === "evidence")}
            recordActions={caseRecords.filter((r) => r.kind === "action")}
            savedResultSets={savedResultSets}
            importedArtifacts={importedArtifacts}
            linkedEntities={investigationEntities}
            selectedEntityDetail={selectedEntityDetail}
          />

          <CaseTimelineAside caseId={investigation.id} roomId={investigation.roomId} timeline={caseTimeline} />
        </div>
      </div>
    </AppShell>
  )
}
