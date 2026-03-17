import {
  linkInvestigationEntityAction,
  unlinkInvestigationEntityAction,
} from "@/features/cases/actions"
import { Section } from "@/features/cases/components/Section"
import { MiniStatGrid } from "@/components/shell/MiniStatGrid"
import { formatTimestamp } from "@/features/cases/lib/formatters"
import { getCollabHuntGraphHref } from "@/features/collab-hunt-graph/manifest"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type {
  InvestigationEntityDetail,
  InvestigationEntitySummary,
} from "@/lib/contracts/investigationEntities"

type LinkedEntitiesSectionProps = {
  caseId: string
  roomId: string
  entities: InvestigationEntitySummary[]
  selectedEntityDetail: InvestigationEntityDetail | null
}

export function LinkedEntitiesSection({
  caseId,
  roomId,
  entities,
  selectedEntityDetail,
}: LinkedEntitiesSectionProps) {
  return (
    <Section title="Linked Entities">
      {entities.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No durable linked entities recorded yet.
        </div>
      ) : (
        <div className="grid gap-3">
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
          >
            {entities.map((entity) => {
              const isSelected = selectedEntityDetail?.id === entity.id

              return (
                <Link
                  key={entity.id}
                  href={`/cases/${caseId}?entity=${encodeURIComponent(entity.id)}`}
                  scroll={false}
                  className={`grid gap-2 rounded-2xl border p-4 no-underline transition-colors ${isSelected ? "border-info/40 bg-info/15" : "border-border/40 bg-muted hover:bg-muted"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className="uppercase tracking-[0.06em]">
                      {entity.kind}
                    </Badge>
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
                  <MiniStatGrid
                    stats={[
                      { label: "Findings", value: entity.findingCount },
                      { label: "Actions", value: entity.openActionCount },
                    ]}
                  />
                </Link>
              )
            })}
          </div>

          {selectedEntityDetail ? (
            <div id="linked-entity-detail" className="grid gap-4 rounded-2xl border border-border/20 bg-muted p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1.5">
                  <Badge variant="outline" className="uppercase tracking-[0.06em] w-fit">
                    {selectedEntityDetail.kind}
                  </Badge>
                  <div className="text-lg font-bold text-foreground">{selectedEntityDetail.label}</div>
                  <div className="text-sm text-muted-foreground">{selectedEntityDetail.value}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary">
                    <Link href={`${getCollabHuntGraphHref(roomId)}?entityId=${encodeURIComponent(selectedEntityDetail.id)}&entityLabel=${encodeURIComponent(selectedEntityDetail.label)}&entityKind=${encodeURIComponent(selectedEntityDetail.kind)}&entityValue=${encodeURIComponent(selectedEntityDetail.value)}`}>
                      Open In Hunt Graph
                    </Link>
                  </Button>
                </div>
              </div>

              <MiniStatGrid
                stats={[
                  { label: "Case Records", value: selectedEntityDetail.caseRecordCount },
                  { label: "Artifacts", value: selectedEntityDetail.artifactCount },
                  { label: "Evidence Sets", value: selectedEntityDetail.evidenceSetCount },
                ]}
                cellClassName="bg-muted/50 px-3 py-2.5"
                valueClassName="text-lg"
              />

              {selectedEntityDetail.caseRecords.length > 0 ? (
                <div className="grid gap-2">
                  <div className="text-sm font-bold text-foreground">Linked Case Records</div>
                  {selectedEntityDetail.caseRecords.map((record) => {
                    const isLinked = selectedEntityDetail.links.some(
                      (link) => link.targetKind === "case-record" && link.targetId === record.id,
                    )
                    return (
                      <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                        <div className="grid gap-1">
                          <div className="font-bold text-foreground">{record.title}</div>
                          <div className="text-xs text-muted-foreground">{record.kind} · {formatTimestamp(record.updatedAt)}</div>
                        </div>
                        <form action={isLinked ? unlinkInvestigationEntityAction : linkInvestigationEntityAction}>
                          <input type="hidden" name="caseId" value={caseId} />
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
                    <div key={item.id} className="grid gap-1 rounded-xl bg-muted/50 p-3">
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
                    <div key={item.id} className="grid gap-1 rounded-xl bg-muted/50 p-3">
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
  )
}
