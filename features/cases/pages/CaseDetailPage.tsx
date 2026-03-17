import {
  archiveCaseAction,
  deleteCasePermanentlyAction,
  restoreCaseAction,
  updateCaseMetadataAction,
} from "@/features/cases/actions"
import { removeCaseMembershipAction, upsertCaseMembershipAction } from "@/features/admin/actions"
import { CaseRecordCard } from "@/features/cases/components/CaseRecordCard"
import { Section } from "@/features/cases/components/Section"
import {
  formatTimestamp,
  getActionStatusBadgeVariant,
  getSeverityBadgeVariant,
  getStatusBadgeVariant,
} from "@/features/cases/lib/formatters"
import { CaseTimelineAside } from "@/features/cases/components/CaseTimelineAside"
import { LinkedEntitiesSection } from "@/features/cases/components/LinkedEntitiesSection"
import { AppShell } from "@/components/shell/AppShell"
import { FormField } from "@/components/shell/FormField"
import { PageHeader } from "@/components/shell/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"

type CaseDetailPageProps = {
  caseId: string
  selectedEntityId?: string | null
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

function csvList(values: unknown) {
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string").join(", ")
    : ""
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
                <FormField htmlFor="case-title" label="Title">
                  <Input id="case-title" name="title" defaultValue={investigation.title} />
                </FormField>
                <FormField htmlFor="case-summary" label="Summary">
                  <Textarea id="case-summary" name="summary" defaultValue={investigation.summary} rows={6} />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField htmlFor="case-status" label="Status">
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
                  </FormField>
                  <FormField htmlFor="case-severity" label="Severity">
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
                  </FormField>
                  <FormField htmlFor="case-owner" label="Owner">
                    <Input id="case-owner" name="owner" defaultValue={investigation.owner} />
                  </FormField>
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
                  <CaseRecordCard
                    key={item.id}
                    caseId={investigation.id}
                    recordId={item.id}
                    badgeVariant="info"
                    title={item.title}
                    summary={item.summary}
                    linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined}
                    linkedArtifactIds={csvList(item.payload.linkedArtifactIds) || undefined}
                  />
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
                    <CaseRecordCard
                      key={item.id}
                      caseId={investigation.id}
                      recordId={item.id}
                      badgeVariant="default"
                      title={item.title}
                      summary={item.summary}
                      linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined}
                    />
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
                    <CaseRecordCard
                      key={item.id}
                      caseId={investigation.id}
                      recordId={item.id}
                      badgeVariant="critical"
                      title={item.title}
                      summary={item.summary}
                      linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined}
                    />
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
                    <CaseRecordCard
                      key={item.id}
                      caseId={investigation.id}
                      recordId={item.id}
                      badgeVariant="success"
                      title={item.title}
                      summary={item.summary}
                      linkedEvidenceSetIds={csvList(item.payload.linkedEvidenceSetIds) || undefined}
                      linkedArtifactIds={csvList(item.payload.linkedArtifactIds) || undefined}
                    />
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
                    <Card key={item.id} className="border-border/50 shadow-none">
                      <CardContent className="grid gap-2 p-4">
                        <Badge variant="muted" className="uppercase tracking-[0.12em] w-fit">Imported Artifact</Badge>
                        <div className="break-all text-sm font-bold text-foreground">{item.title}</div>
                        <div className="break-all text-sm leading-relaxed text-muted-foreground">{item.summary}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.kind} · {formatTimestamp(item.persistedAt)}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </Section>

              <LinkedEntitiesSection
                caseId={investigation.id}
                roomId={investigation.roomId}
                entities={mergedLinkedEntities}
                selectedEntityDetail={selectedEntityDetail}
              />
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
                    <CaseRecordCard
                      key={action.id}
                      caseId={investigation.id}
                      recordId={action.id}
                      badgeVariant="critical"
                      title={action.title}
                      summary={action.summary}
                      footer={
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">Owner: {action.payload.owner || "Unassigned"}</Badge>
                          <Badge
                            variant={getActionStatusBadgeVariant(
                              typeof action.payload.status === "string" ? action.payload.status : "open",
                            )}
                            className="capitalize"
                          >
                            {typeof action.payload.status === "string"
                              ? action.payload.status.replaceAll("_", " ")
                              : "open"}
                          </Badge>
                          {typeof action.payload.dueAt === "string" && action.payload.dueAt.trim() ? (
                            <Badge variant="info">Due {action.payload.dueAt}</Badge>
                          ) : null}
                        </div>
                      }
                    />
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

          <CaseTimelineAside
            caseId={investigation.id}
            roomId={investigation.roomId}
            timeline={caseTimeline}
          />
        </div>
      </div>
    </AppShell>
  )
}
