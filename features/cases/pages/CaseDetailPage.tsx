import type { ReactNode } from "react"
import {
  archiveCaseAction,
  deleteCasePermanentlyAction,
  linkInvestigationEntityAction,
  removeCaseRecordAction,
  restoreCaseAction,
  unlinkInvestigationEntityAction,
  updateCaseMetadataAction,
} from "@/features/cases/actions"
import { removeCaseMembershipAction, upsertCaseMembershipAction } from "@/features/admin/actions"
import { AppShell } from "@/components/shell/AppShell"
import { PageHeader } from "@/components/shell/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CASE_ROLE_LABELS } from "@/lib/auth/permissions"
import { requireCasePermissionByCaseId } from "@/lib/auth/access"
import type { PersistedInvestigationArtifact } from "@/lib/contracts/artifacts"
import type { InvestigationCaseRecord } from "@/lib/contracts/caseRecords"
import type { InvestigationSeverity, InvestigationStatus } from "@/lib/contracts/investigations"
import { listRoomArtifacts } from "@/lib/db/artifacts"
import { listCaseMemberships } from "@/lib/db/auth"
import { listInvestigationCaseRecords } from "@/lib/db/caseRecords"
import { listInvestigations } from "@/lib/db/investigationAggregates"
import { getInvestigationById, listInvestigationActivity } from "@/lib/db/investigations"
import { getPlatformOverview } from "@/lib/db/platform"
import { listSavedDatasourceResultSets } from "@/lib/db/datasourceResults"
import {
  getInvestigationEntityDetail,
  listInvestigationEntitySummaries,
} from "@/lib/db/investigationEntities"
import { appModules } from "@/lib/modules/registry"
import { getCollabHuntGraphHref } from "@/features/collab-hunt-graph/manifest"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  LayoutGrid,
} from "lucide-react"

type CaseDetailPageProps = {
  caseId: string
  selectedEntityId?: string | null
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value))
}

function formatTimelineDay(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "long",
    weekday: "short",
  }).format(new Date(value))
}

function getTimelineTypeLabel(type: string) {
  switch (type) {
    case "action":
      return "Action"
    case "decision":
      return "Decision"
    case "evidence":
      return "Evidence"
    case "finding":
      return "Finding"
    case "hypothesis":
      return "Hypothesis"
    case "mitigation":
      return "Mitigation"
    case "owner_change":
      return "Owner Change"
    case "comms":
      return "Comms"
    case "case_created":
      return "Case Created"
    case "metadata_updated":
      return "Case Updated"
    case "archived":
      return "Case Archived"
    case "restored":
      return "Case Restored"
    case "timeline-event":
      return "Timeline Event"
    default:
      return "Update"
  }
}

function getTimelineTone(type: string) {
  switch (type) {
    case "action":
      return { accent: "#b91c1c", tint: "rgba(185, 28, 28, 0.14)" }
    case "decision":
      return { accent: "#2563eb", tint: "rgba(37, 99, 235, 0.14)" }
    case "evidence":
      return { accent: "#d97706", tint: "rgba(217, 119, 6, 0.14)" }
    case "finding":
      return { accent: "#0f766e", tint: "rgba(15, 118, 110, 0.14)" }
    case "hypothesis":
      return { accent: "#7c3aed", tint: "rgba(124, 58, 237, 0.14)" }
    case "mitigation":
      return { accent: "#16a34a", tint: "rgba(22, 163, 74, 0.14)" }
    case "owner_change":
      return { accent: "#d97706", tint: "rgba(217, 119, 6, 0.14)" }
    case "comms":
      return { accent: "#0891b2", tint: "rgba(8, 145, 178, 0.14)" }
    case "case_created":
    case "metadata_updated":
    case "archived":
    case "restored":
      return { accent: "hsl(var(--muted-foreground))", tint: "hsl(var(--muted) / 0.55)" }
    case "timeline-event":
      return { accent: "#2563eb", tint: "rgba(37, 99, 235, 0.14)" }
    default:
      return { accent: "#2563eb", tint: "rgba(37, 99, 235, 0.14)" }
  }
}

function summarizeArtifacts(
  artifacts: PersistedInvestigationArtifact[],
  kinds: PersistedInvestigationArtifact["kind"][],
) {
  return artifacts.filter((artifact) => kinds.includes(artifact.kind))
}

function summarizeCaseRecords(
  records: InvestigationCaseRecord[],
  kinds: InvestigationCaseRecord["kind"][],
) {
  return records.filter((record) => kinds.includes(record.kind))
}

function isSavedEvidenceSetArtifact(artifact: PersistedInvestigationArtifact) {
  if (artifact.kind !== "evidence") {
    return false
  }

  const rows = artifact.payload?.rows
  return Array.isArray(rows)
}

function getActionStatusBadgeVariant(status: string): "critical" | "success" | "info" | "muted" {
  switch (status) {
    case "blocked": return "critical"
    case "done": return "success"
    case "in_progress": return "info"
    case "open":
    default: return "muted"
  }
}

function getSeverityBadgeVariant(severity: InvestigationSeverity): "critical" | "warning" | "success" {
  switch (severity) {
    case "critical": return "critical"
    case "high":
    case "medium": return "warning"
    case "low":
    default: return "success"
  }
}

function getStatusBadgeVariant(status: InvestigationStatus): "muted" | "success" | "default" | "info" {
  switch (status) {
    case "closed": return "muted"
    case "mitigated": return "success"
    case "monitoring": return "info"
    case "open":
    default: return "default"
  }
}

function Section({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  )
}

function csvList(values: unknown) {
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string").join(", ")
    : ""
}

function getTimelineBadgeVariant(type: string): "critical" | "warning" | "info" | "default" | "success" | "muted" {
  switch (type) {
    case "action": return "critical"
    case "decision": return "critical"
    case "evidence": return "warning"
    case "finding": return "info"
    case "hypothesis": return "default"
    case "mitigation": return "success"
    case "owner_change": return "warning"
    case "comms": return "info"
    case "case_created":
    case "metadata_updated":
    case "archived":
    case "restored": return "muted"
    case "timeline-event": return "info"
    default: return "info"
  }
}

function getSourceBadgeVariant(source: string): "default" | "success" | "muted" {
  switch (source) {
    case "artifact": return "default"
    case "record": return "success"
    default: return "muted"
  }
}

function getSourceLabel(source: string) {
  switch (source) {
    case "artifact": return "Artifact"
    case "record": return "Promoted"
    default: return "Case"
  }
}

export async function CaseDetailPage({ caseId, selectedEntityId = null }: CaseDetailPageProps) {
  const currentUser = await requireCasePermissionByCaseId(caseId, "view")
  const platformOverview = await getPlatformOverview(appModules)
  const [investigation, overviewList] = await Promise.all([
    getInvestigationById(caseId),
    listInvestigations({ archived: "all" }),
  ])

  if (!investigation) {
    notFound()
  }

  const overview = overviewList.find((item) => item.id === caseId) ?? null
  const [
    artifacts,
    activity,
    caseMembers,
    caseRecords,
    savedResultSets,
    investigationEntities,
    selectedEntityDetail,
  ] = await Promise.all([
    listRoomArtifacts(investigation.roomId),
    listInvestigationActivity(caseId),
    listCaseMemberships(caseId),
    listInvestigationCaseRecords(caseId),
    listSavedDatasourceResultSets(investigation.roomId),
    listInvestigationEntitySummaries(caseId),
    selectedEntityId ? getInvestigationEntityDetail(caseId, selectedEntityId) : Promise.resolve(null),
  ])

  const artifactFindings = summarizeArtifacts(artifacts, [
    "finding",
    "graph-selection",
    "ioc",
    "sigma-match",
  ])
  const artifactHypotheses = summarizeArtifacts(artifacts, ["hypothesis"])
  const artifactDecisions = summarizeArtifacts(artifacts, ["decision"])
  const artifactEvidence = artifacts.filter(
    (artifact) =>
      (artifact.kind === "evidence" || artifact.kind === "note") &&
      !isSavedEvidenceSetArtifact(artifact),
  )
  const recordFindings = summarizeCaseRecords(caseRecords, ["finding"])
  const recordHypotheses = summarizeCaseRecords(caseRecords, ["hypothesis"])
  const recordDecisions = summarizeCaseRecords(caseRecords, ["decision"])
  const recordEvidence = summarizeCaseRecords(caseRecords, ["evidence"])
  const recordActions = summarizeCaseRecords(caseRecords, ["action"])
  const importedArtifacts = [
    ...artifactFindings,
    ...artifactHypotheses,
    ...artifactDecisions,
    ...artifactEvidence,
  ]
  const caseTimeline = [
    ...activity.map((item) => ({
      body: item.summary,
      createdAt: new Date(item.createdAt).getTime(),
      id: `activity-${item.id}`,
      linkedActionIds: [] as string[],
      linkedEntityIds: [] as string[],
      source: "case" as const,
      type: item.kind,
    })),
    ...artifacts.map((artifact) => ({
      body: artifact.summary,
      createdAt: new Date(artifact.persistedAt).getTime(),
      id: `artifact-${artifact.id}`,
      linkedActionIds: [] as string[],
      linkedEntityIds: (artifact.relatedEntities ?? []).map((entity) => entity.id),
      source: "artifact" as const,
      type: artifact.kind,
    })),
    ...caseRecords.map((record) => ({
      body: record.summary,
      createdAt: new Date(record.updatedAt).getTime(),
      id: `record-${record.id}`,
      linkedActionIds:
        record.kind === "action" ? [record.sourceId] : ([] as string[]),
      linkedEntityIds: record.relatedEntities.map((entity) => entity.id),
      source: "record" as const,
      type: record.kind,
    })),
  ]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 16)
  const mergedLinkedEntities = investigationEntities
  const canManageMembers =
    currentUser.orgRole === "org_admin" || currentUser.caseRole === "case_owner"

  return (
    <AppShell
      currentUser={currentUser}
      modules={appModules}
      platformOverview={platformOverview}
      title="Cases"
    >
      <div className="grid w-full gap-6">
        <PageHeader
          eyebrow="Durable Investigation"
          title={investigation.title}
          description={investigation.summary || "No summary yet."}
          actions={
            <>
              <Button asChild variant="secondary">
                <Link href="/cases">Back to Cases</Link>
              </Button>
              <Button asChild>
                <Link href={`/board/${investigation.roomId}?fit=1`}>Open Workspace</Link>
              </Button>
            </>
          }
          badges={
            <>
              <Badge variant={getStatusBadgeVariant(investigation.status)}>{investigation.status}</Badge>
              <Badge variant={getSeverityBadgeVariant(investigation.severity)}>{investigation.severity}</Badge>
              <Badge variant="secondary">Owner {investigation.owner}</Badge>
              {investigation.archivedAt ? (
                <Badge variant="warning">
                  Archived {formatTimestamp(investigation.archivedAt)}
                </Badge>
              ) : null}
            </>
          }
        />

        {/* Stats Row - Full Width */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
          {[
            { label: "Findings", value: overview?.counts.findingCount ?? 0 },
            { label: "Board Objects", value: overview?.counts.boardEntityCount ?? 0 },
            { label: "Evidence Sets", value: overview?.counts.evidenceSetCount ?? 0 },
            { label: "Entities", value: overview?.counts.entityCount ?? 0 },
            { label: "Hypotheses", value: overview?.counts.hypothesisCount ?? 0 },
            { label: "Open Actions", value: overview?.counts.openActionCount ?? 0 },
            { label: "Timeline", value: overview?.counts.timelineEntryCount ?? 0 },
            { label: "Decisions", value: overview?.counts.decisionCount ?? 0 },
          ].map((item) => (
            <Card key={item.label} className="border-border/60 bg-card shadow-sm">
              <CardContent className="p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-foreground">{item.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid w-full items-start gap-6 xl:grid-cols-[320px_minmax(0,1.35fr)_minmax(380px,1.05fr)]">
          <div className="grid content-start gap-5">
            <Section title="Case Metadata">
              <form action={updateCaseMetadataAction} className="grid gap-3">
                <input type="hidden" name="caseId" value={investigation.id} />
                <div className="grid gap-2">
                  <Label htmlFor="case-title">Title</Label>
                  <Input id="case-title" name="title" defaultValue={investigation.title} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="case-summary">Summary</Label>
                  <Textarea id="case-summary" name="summary" defaultValue={investigation.summary} rows={6} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="case-status">Status</Label>
                    <Select name="status" defaultValue={investigation.status}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="monitoring">Monitoring</SelectItem>
                        <SelectItem value="mitigated">Mitigated</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="case-severity">Severity</Label>
                    <Select name="severity" defaultValue={investigation.severity}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="case-owner">Owner</Label>
                    <Input id="case-owner" name="owner" defaultValue={investigation.owner} />
                  </div>
                </div>
                <Button type="submit">Save Metadata</Button>
              </form>
              <div className="grid gap-2 text-xs text-muted-foreground">
                <div>Case ID: {investigation.id}</div>
                <div>Room ID: {investigation.roomId}</div>
                <div>
                  Archived {investigation.archivedAt ? formatTimestamp(investigation.archivedAt) : "No"}
                </div>
                <div>Created {formatTimestamp(investigation.createdAt)}</div>
                <div>Updated {formatTimestamp(investigation.updatedAt)}</div>
              </div>
              <div className="grid gap-3 pt-2">
                {investigation.archivedAt ? (
                  <form action={restoreCaseAction}>
                    <input type="hidden" name="caseId" value={investigation.id} />
                    <Button className="w-full bg-success hover:bg-success/90" type="submit">
                      Restore Case
                    </Button>
                  </form>
                ) : (
                  <form action={archiveCaseAction}>
                    <input type="hidden" name="caseId" value={investigation.id} />
                    <Button className="w-full bg-warning text-warning-foreground hover:bg-warning/90" type="submit">
                      Archive Case
                    </Button>
                  </form>
                )}
                <form action={deleteCasePermanentlyAction} className="grid gap-2">
                  <input type="hidden" name="caseId" value={investigation.id} />
                  <Label className="text-critical">
                    Type DELETE to permanently remove this case and its linked room data.
                  </Label>
                  <Input className="border-critical/20" name="confirmation" placeholder="DELETE" />
                  <Button type="submit" variant="destructive">
                    Delete Permanently
                  </Button>
                </form>
              </div>
            </Section>

            <Section title="Access">
              <div className="grid gap-3">
                {caseMembers.map((member) => (
                  <div
                    key={member.id}
                    className="grid gap-3 rounded-2xl border border-border/70 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-3 shrink-0 rounded-full" style={{ background: member.color }} />
                      <div className="grid gap-0.5">
                        <span className="text-sm font-semibold">{member.name}</span>
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-foreground">{CASE_ROLE_LABELS[member.role]}</div>
                    {canManageMembers ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={upsertCaseMembershipAction} className="flex flex-wrap gap-2">
                          <input name="caseId" type="hidden" value={investigation.id} />
                          <input name="email" type="hidden" value={member.email} />
                          <Select defaultValue={member.role} name="role">
                            <SelectTrigger className="w-auto min-w-40">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CASE_ROLE_LABELS).map(([role, label]) => (
                                <SelectItem key={role} value={role}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="submit" variant="secondary">Update</Button>
                        </form>
                        {member.id !== currentUser.id ? (
                          <form action={removeCaseMembershipAction}>
                            <input name="caseId" type="hidden" value={investigation.id} />
                            <input name="userId" type="hidden" value={member.id} />
                            <Button type="submit" variant="destructive">Remove</Button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {canManageMembers ? (
                <form action={upsertCaseMembershipAction} className="grid gap-3">
                  <input name="caseId" type="hidden" value={investigation.id} />
                  <Input name="email" placeholder="user@example.com" type="email" />
                  <Select defaultValue="case_viewer" name="role">
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CASE_ROLE_LABELS).map(([role, label]) => (
                        <SelectItem key={role} value={role}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit">Add member</Button>
                </form>
              ) : (
                <div className="text-sm leading-6 text-muted-foreground">
                  Case owners and org admins manage membership for this case.
                </div>
              )}
            </Section>
          </div>

          <div className="grid min-w-0 gap-5">
            <Section title="Findings">
              {recordFindings.length === 0 ? (
                <div className="text-sm text-muted-foreground">No case findings recorded yet.</div>
              ) : (
                recordFindings.map((item) => (
                  <article key={item.id} className="grid gap-2 rounded-2xl bg-muted p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="info" className="uppercase tracking-[0.12em]">Case Record</Badge>
                      <form action={removeCaseRecordAction}>
                        <input type="hidden" name="caseId" value={investigation.id} />
                        <input type="hidden" name="recordId" value={item.id} />
                        <Button size="sm" type="submit" variant="destructive">Remove From Case</Button>
                      </form>
                    </div>
                    <div className="text-[15px] font-bold text-foreground">{item.title}</div>
                    <div className="text-sm leading-relaxed text-muted-foreground">{item.summary}</div>
                    {csvList(item.payload.linkedEvidenceSetIds) ? (
                      <div className="text-xs text-muted-foreground">Evidence sets: {csvList(item.payload.linkedEvidenceSetIds)}</div>
                    ) : null}
                    {csvList(item.payload.linkedArtifactIds) ? (
                      <div className="text-xs text-muted-foreground">Artifacts: {csvList(item.payload.linkedArtifactIds)}</div>
                    ) : null}
                  </article>
                ))
              )}
            </Section>

            <div className="grid grid-cols-2 gap-5">
              <Section title="Hypotheses">
                {recordHypotheses.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No case hypotheses recorded yet.
                  </div>
                ) : (
                  recordHypotheses.map((item) => (
                    <article key={item.id} className="grid gap-2 rounded-2xl bg-muted p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="default" className="uppercase tracking-[0.12em]">Case Record</Badge>
                        <form action={removeCaseRecordAction}>
                          <input type="hidden" name="caseId" value={investigation.id} />
                          <input type="hidden" name="recordId" value={item.id} />
                          <Button size="sm" type="submit" variant="destructive">Remove From Case</Button>
                        </form>
                      </div>
                      <div className="text-[15px] font-bold text-foreground">{item.title}</div>
                      <div className="text-sm leading-relaxed text-muted-foreground">{item.summary}</div>
                      {csvList(item.payload.linkedEvidenceSetIds) ? (
                        <div className="text-xs text-muted-foreground">
                          Evidence sets: {csvList(item.payload.linkedEvidenceSetIds)}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </Section>

              <Section title="Decisions">
                {recordDecisions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No case decisions recorded yet.
                  </div>
                ) : (
                  recordDecisions.map((item) => (
                    <article key={item.id} className="grid gap-2 rounded-2xl bg-muted p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="critical" className="uppercase tracking-[0.12em]">Case Record</Badge>
                        <form action={removeCaseRecordAction}>
                          <input type="hidden" name="caseId" value={investigation.id} />
                          <input type="hidden" name="recordId" value={item.id} />
                          <Button size="sm" type="submit" variant="destructive">Remove From Case</Button>
                        </form>
                      </div>
                      <div className="text-[15px] font-bold text-foreground">{item.title}</div>
                      <div className="text-sm leading-relaxed text-muted-foreground">{item.summary}</div>
                      {csvList(item.payload.linkedEvidenceSetIds) ? (
                        <div className="text-xs text-muted-foreground">
                          Evidence sets: {csvList(item.payload.linkedEvidenceSetIds)}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </Section>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Section title="Supporting Evidence Sets">
                {savedResultSets.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No supporting evidence sets saved yet.
                  </div>
                ) : (
                  savedResultSets.map((item) => (
                    <div key={`result-set-${item.id}`} className="grid gap-2 rounded-2xl bg-muted p-4 text-sm leading-relaxed text-foreground">
                      <Badge variant="success" className="uppercase tracking-[0.12em] w-fit">Evidence Set</Badge>
                      <div className="font-bold text-foreground">{item.title}</div>
                      <div>{item.summary}</div>
                      <div className="text-xs text-muted-foreground">ID: {item.id} · {item.resultCount} result{item.resultCount === 1 ? "" : "s"} from {item.datasourceTitle}</div>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Evidence">
                {recordEvidence.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No case evidence records are attached yet.
                  </div>
                ) : (
                  recordEvidence.map((item) => (
                    <article key={item.id} className="grid gap-2 rounded-2xl bg-muted p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="success" className="uppercase tracking-[0.12em]">Case Record</Badge>
                        <form action={removeCaseRecordAction}>
                          <input type="hidden" name="caseId" value={investigation.id} />
                          <input type="hidden" name="recordId" value={item.id} />
                          <Button size="sm" type="submit" variant="destructive">Remove From Case</Button>
                        </form>
                      </div>
                      <div className="text-[15px] font-bold text-foreground">{item.title}</div>
                      <div className="text-sm leading-relaxed text-muted-foreground">{item.summary}</div>
                      {csvList(item.payload.linkedEvidenceSetIds) ? (
                        <div className="text-xs text-muted-foreground">
                          Evidence sets: {csvList(item.payload.linkedEvidenceSetIds)}
                        </div>
                      ) : null}
                      {csvList(item.payload.linkedArtifactIds) ? (
                        <div className="text-xs text-muted-foreground">
                          Artifacts: {csvList(item.payload.linkedArtifactIds)}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </Section>

              <Section title="Imported Artifacts">
                {importedArtifacts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No imported artifacts are attached to this case yet.
                  </div>
                ) : (
                  importedArtifacts.map((item) => (
                    <div key={item.id} className="grid gap-2 rounded-2xl bg-muted p-4 text-sm leading-relaxed text-foreground">
                      <Badge variant="muted" className="uppercase tracking-[0.12em] w-fit">Imported Artifact</Badge>
                      <div className="font-bold text-foreground">{item.title}</div>
                      <div>{item.summary}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.kind} · {formatTimestamp(item.persistedAt)}
                      </div>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Linked Entities">
                {mergedLinkedEntities.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No durable linked entities recorded yet.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
                    >
                      {mergedLinkedEntities.map((entity) => {
                        const isSelected = selectedEntityDetail?.id === entity.id

                        return (
                          <Link
                            key={entity.id}
                            href={`/cases/${investigation.id}?entity=${encodeURIComponent(entity.id)}`}
                            scroll={false}
                            className={`grid gap-2 rounded-2xl border p-4 no-underline transition-colors ${isSelected ? "border-info/40 bg-info/15" : "border-border/40 bg-muted hover:bg-muted"}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-foreground">
                                {entity.kind}
                              </span>
                              <span className="text-[11px] font-bold text-muted-foreground">
                                {entity.caseRecordCount} records · {entity.evidenceSetCount} sets
                              </span>
                            </div>
                            <div className="break-all text-sm font-bold leading-snug text-foreground">
                              {entity.label}
                            </div>
                            <div className="break-all text-xs text-muted-foreground">
                              {entity.value}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl bg-white/75 px-2.5 py-2">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground">Findings</div>
                                <div className="text-base font-bold text-foreground">{entity.findingCount}</div>
                              </div>
                              <div className="rounded-xl bg-white/75 px-2.5 py-2">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground">Actions</div>
                                <div className="text-base font-bold text-foreground">{entity.openActionCount}</div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>

                    {selectedEntityDetail ? (
                      <div id="linked-entity-detail" className="grid gap-4 rounded-2xl border border-border/20 bg-muted p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="grid gap-1.5">
                            <span className="inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-foreground">
                              {selectedEntityDetail.kind}
                            </span>
                            <div className="text-lg font-bold text-foreground">{selectedEntityDetail.label}</div>
                            <div className="text-sm text-muted-foreground">{selectedEntityDetail.value}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button asChild variant="secondary">
                              <Link href={`${getCollabHuntGraphHref(investigation.roomId)}?entityId=${encodeURIComponent(selectedEntityDetail.id)}&entityLabel=${encodeURIComponent(selectedEntityDetail.label)}&entityKind=${encodeURIComponent(selectedEntityDetail.kind)}&entityValue=${encodeURIComponent(selectedEntityDetail.value)}`}>
                                Open In Hunt Graph
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Case Records", value: selectedEntityDetail.caseRecordCount },
                            { label: "Artifacts", value: selectedEntityDetail.artifactCount },
                            { label: "Evidence Sets", value: selectedEntityDetail.evidenceSetCount },
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl bg-white/80 px-3 py-2.5">
                              <div className="text-[10px] font-bold uppercase text-muted-foreground">{item.label}</div>
                              <div className="text-lg font-bold text-foreground">{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {selectedEntityDetail.caseRecords.length > 0 ? (
                          <div className="grid gap-2">
                            <div className="text-sm font-bold text-foreground">Linked Case Records</div>
                            {selectedEntityDetail.caseRecords.map((record) => {
                              const isLinked = selectedEntityDetail.links.some(
                                (link) => link.targetKind === "case-record" && link.targetId === record.id,
                              )
                              return (
                                <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 p-3">
                                  <div className="grid gap-1">
                                    <div className="font-bold text-foreground">{record.title}</div>
                                    <div className="text-xs text-muted-foreground">{record.kind} · {formatTimestamp(record.updatedAt)}</div>
                                  </div>
                                  <form action={isLinked ? unlinkInvestigationEntityAction : linkInvestigationEntityAction}>
                                    <input type="hidden" name="caseId" value={investigation.id} />
                                    <input type="hidden" name="entityId" value={selectedEntityDetail.id} />
                                    <input type="hidden" name="targetKind" value="case-record" />
                                    <input type="hidden" name="targetId" value={record.id} />
                                    <Button size="sm" type="submit" variant={isLinked ? "destructive" : "secondary"}>
                                      {isLinked ? "Unlink" : "Link"}
                                    </Button>
                                  </form>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}

                        {selectedEntityDetail.evidenceSets.length > 0 ? (
                          <div className="grid gap-2">
                            <div className="text-sm font-bold text-foreground">Linked Evidence Sets</div>
                            {selectedEntityDetail.evidenceSets.map((item) => (
                              <div key={item.id} className="grid gap-1 rounded-xl bg-white/80 p-3">
                                <div className="font-bold text-foreground">{item.title}</div>
                                <div className="text-xs text-muted-foreground">{item.resultCount} results</div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {selectedEntityDetail.artifacts.length > 0 ? (
                          <div className="grid gap-2">
                            <div className="text-sm font-bold text-foreground">Linked Imported Artifacts</div>
                            {selectedEntityDetail.artifacts.map((item) => (
                              <div key={item.id} className="grid gap-1 rounded-xl bg-white/80 p-3">
                                <div className="font-bold text-foreground">{item.title}</div>
                                <div className="text-xs text-muted-foreground">{item.kind}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </Section>
            </div>

            <Section title="Open Actions">
                <div className="text-sm leading-relaxed text-muted-foreground">
                  Actions are created in the workspace. Use this section to assign
                  ownership, track status, and review what is still open.
                </div>
                {recordActions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No durable action records are attached to this case yet.
                  </div>
                ) : (
                  recordActions.map((action) => (
                    <article key={action.id} className="grid gap-2 rounded-2xl bg-muted p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="critical" className="uppercase tracking-[0.12em]">Case Record</Badge>
                        <form action={removeCaseRecordAction}>
                          <input type="hidden" name="caseId" value={investigation.id} />
                          <input type="hidden" name="recordId" value={action.id} />
                          <Button size="sm" type="submit" variant="destructive">Remove From Case</Button>
                        </form>
                      </div>
                      <div className="text-[15px] font-bold text-foreground">{action.title}</div>
                      <div className="text-sm leading-relaxed text-muted-foreground">{action.summary}</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Owner: {action.payload.owner || "Unassigned"}</Badge>
                        <Badge variant={getActionStatusBadgeVariant(typeof action.payload.status === "string" ? action.payload.status : "open")} className="capitalize">
                          {typeof action.payload.status === "string"
                            ? action.payload.status.replaceAll("_", " ")
                            : "open"}
                        </Badge>
                        {typeof action.payload.dueAt === "string" && action.payload.dueAt.trim() ? (
                          <Badge variant="info">Due {action.payload.dueAt}</Badge>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
                <Button asChild variant="secondary" size="sm" className="w-fit justify-start gap-2 text-xs">
                  <Link href={`/board/${investigation.roomId}?tab=actions`}>
                    <ArrowRight className="size-3" />
                    Open Workspace To Review Current Actions
                  </Link>
                </Button>
            </Section>
          </div>

          <aside className="sticky top-7 min-w-0 self-start xl:h-[calc(100vh-56px)]">
            <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/50 bg-card/95 shadow-lg">
              <CardHeader className="gap-4 border-b border-border/40 bg-gradient-to-b from-card via-card to-muted/20 pb-4 pt-4">
                <div>
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Clock className="size-4 text-muted-foreground" />
                      Case Timeline
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Review promoted case activity and workspace milestones in one feed.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {caseTimeline.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-5">
                  <Card className="w-full border-dashed border-border/60 bg-background/80 shadow-none">
                    <CardContent className="p-5 text-center">
                      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Clock className="size-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No timeline entries yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Promote findings or feed updates into the case record to build the timeline.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid gap-4">
                    {caseTimeline.map((item, index) => {
                      const tone = getTimelineTone(item.type)
                      const currentDay = formatTimelineDay(item.createdAt)
                      const previousDay =
                        index > 0 ? formatTimelineDay(caseTimeline[index - 1].createdAt) : null
                      const showDayHeader = currentDay !== previousDay

                      return (
                        <div key={item.id} className="grid gap-3">
                          {showDayHeader ? (
                            <div className="flex items-center gap-3 pt-1">
                              <div className="min-w-24 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {currentDay}
                              </div>
                              <div className="h-px flex-1 bg-gradient-to-r from-border/40 to-border/0" />
                            </div>
                          ) : null}

                          <article className="grid gap-3 sm:grid-cols-[72px_24px_minmax(0,1fr)]">
                            <div className="grid content-start justify-items-start gap-1 pt-1 sm:justify-items-end">
                              <div className="text-sm font-bold text-foreground">
                                {formatTimestamp(new Date(item.createdAt).toISOString())}
                              </div>
                              <div className="text-xs font-medium text-muted-foreground">
                                {getSourceLabel(item.source)}
                              </div>
                            </div>

                            <div className="relative hidden min-h-24 justify-center sm:flex">
                              <div className="absolute bottom-0 top-0 w-px bg-gradient-to-b from-border/10 via-border/40 to-border/10" />
                              <div
                                className="relative z-10 mt-2 size-3 rounded-full"
                                style={{
                                  background: tone.accent,
                                  boxShadow: `0 0 0 4px ${tone.tint}`,
                                }}
                              />
                            </div>

                            <Card
                              className="border-border/50 bg-card/92 shadow-sm"
                              style={{
                                backgroundImage: `linear-gradient(180deg, hsl(var(--card) / 0.98), hsl(var(--card) / 0.94)), radial-gradient(circle at top left, ${tone.tint}, transparent 64%)`,
                              }}
                            >
                              <CardContent className="grid gap-3 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant={getTimelineBadgeVariant(item.type)}
                                      className="uppercase tracking-[0.12em]"
                                    >
                                      {getTimelineTypeLabel(item.type)}
                                    </Badge>
                                    <Badge variant={getSourceBadgeVariant(item.source)}>
                                      {getSourceLabel(item.source)}
                                    </Badge>
                                  </div>
                                  {item.source === "record" ? (
                                    <form action={removeCaseRecordAction}>
                                      <input type="hidden" name="caseId" value={investigation.id} />
                                      <input
                                        type="hidden"
                                        name="recordId"
                                        value={item.id.replace("record-", "")}
                                      />
                                      <Button size="sm" type="submit" variant="ghost">
                                        Remove
                                      </Button>
                                    </form>
                                  ) : null}
                                </div>

                                <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">
                                  {item.body}
                                </div>

                                {(item.linkedActionIds.length > 0 || item.linkedEntityIds.length > 0) && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.linkedActionIds.length > 0 && (
                                      <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                                        <CheckCircle2 className="size-3" />
                                        {item.linkedActionIds.length} action{item.linkedActionIds.length === 1 ? "" : "s"}
                                      </div>
                                    )}
                                    {item.linkedEntityIds.length > 0 && (
                                      <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                                        <LayoutGrid className="size-3" />
                                        {item.linkedEntityIds.length} entit{item.linkedEntityIds.length === 1 ? "y" : "ies"}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </article>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="border-t border-border/40 bg-muted/20 p-3">
                <Button asChild variant="secondary" size="sm" className="w-full justify-start gap-2 text-xs">
                  <Link href={`/board/${investigation.roomId}?tab=feed`}>
                    <ArrowRight className="size-3" />
                    Continue in Workspace
                  </Link>
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
