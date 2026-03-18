import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import type {
  DatasourceInstallation,
  DatasourceSearchRow,
} from "@/lib/datasources"

export const QUERY_TEMPLATES: Array<{ label: string; value: string }> = [
  { label: "— Load a template —", value: "" },
  { label: "Recent events (24h)", value: "index=* earliest=-24h | head 50" },
  {
    label: "Auth failures (EventCode 4625)",
    value: "index=* sourcetype=WinEventLog:Security EventCode=4625 | table _time host user src_ip | head 50",
  },
  {
    label: "Process creation (EventCode 4688)",
    value: "index=* sourcetype=WinEventLog:Security EventCode=4688 | table _time host user process_name cmd_line | head 50",
  },
  {
    label: "PowerShell execution",
    value: 'index=* (Process_Command_Line=*powershell* OR cmd_line=*powershell* OR CommandLine=*powershell*) | head 50',
  },
  {
    label: "Network connections (Zeek/Bro)",
    value: "index=* sourcetype=zeek:conn | table _time id.orig_h id.resp_h id.resp_p proto | head 50",
  },
  {
    label: "Failed logins — top offenders",
    value: "index=* (action=failure OR EventCode=4625) | stats count by user src_ip | sort -count | head 25",
  },
  {
    label: "Hash lookup (replace HASH)",
    value: 'index=* (md5="HASH" OR sha256="HASH") | head 50',
  },
  {
    label: "MITRE ATT&CK technique (replace T1XXX)",
    value: 'index=* (mitre_technique_id="T1XXX" OR technique_id="T1XXX") | head 50',
  },
  {
    label: "Top network talkers",
    value: "index=* sourcetype=netflow | stats sum(bytes) as bytes by src_ip | sort -bytes | head 25",
  },
  {
    label: "Lateral movement indicators",
    value: "index=* EventCode IN (4624 4625 4648) src_ip!=dest_ip | head 50",
  },
  {
    label: "DNS queries",
    value: "index=* sourcetype=stream:dns | table _time src_ip query record_type | head 50",
  },
  {
    label: "Registry modifications",
    value: "index=* (EventCode=4657 OR sourcetype=*registry*) | table _time host user registry_path registry_value_name | head 50",
  },
]

// Long values like SHA256 hashes (64 chars) will blow out badge width. Truncate for display only.
export function truncateLabel(label: string, max = 32): string {
  if (label.length <= max) return label
  return `${label.slice(0, 10)}…${label.slice(-8)}`
}

export function uniqueEntities(rows: DatasourceSearchRow[]) {
  const seen = new Set<string>()
  return rows.flatMap((row) =>
    row.relatedEntities.filter((entity) => {
      if (seen.has(entity.id)) return false
      seen.add(entity.id)
      return true
    }),
  )
}

export function buildResultSetTitle(datasource: DatasourceInstallation, rows: DatasourceSearchRow[]) {
  const leadTitle = rows[0]?.title ?? "Datasource result set"
  return `${datasource.title}: ${leadTitle}`
}

export function buildResultSetSummary(
  datasource: DatasourceInstallation,
  query: string,
  rows: DatasourceSearchRow[],
) {
  const summaryLead = rows.slice(0, 2).map((row) => row.summary).join(" | ")
  return `${datasource.title} query "${query.trim()}" returned ${rows.length} result${
    rows.length === 1 ? "" : "s"
  }. ${summaryLead}`.trim()
}

export function buildSavedResultArtifact(input: {
  datasource: DatasourceInstallation
  query: string
  roomId: string
  rows: DatasourceSearchRow[]
  earliestTime: string
  latestTime: string
}) {
  const relatedEntities = uniqueEntities(input.rows)
  const artifactId = crypto.randomUUID()

  const artifact: InvestigationArtifact = {
    createdAt: Date.now(),
    deepLink: input.rows[0]?.sourceUrl
      ? { href: input.rows[0].sourceUrl, moduleId: "incident-workspace" }
      : undefined,
    id: artifactId,
    kind: "evidence",
    payload: {
      datasourceId: input.datasource.id,
      datasourceTitle: input.datasource.title,
      earliestTime: input.earliestTime,
      latestTime: input.latestTime,
      query: input.query,
      roomId: input.roomId,
      rows: input.rows,
      vendor: input.datasource.vendor,
    },
    relatedEntities,
    sourceModule: input.datasource.vendor,
    summary: buildResultSetSummary(input.datasource, input.query, input.rows),
    title: buildResultSetTitle(input.datasource, input.rows),
  }

  return { artifact, relatedEntities }
}

export function buildTimelineBody(input: {
  datasource: DatasourceInstallation
  query: string
  relatedEntities: string[]
  rows: DatasourceSearchRow[]
}) {
  const headline = `${input.datasource.title} search captured ${input.rows.length} result${
    input.rows.length === 1 ? "" : "s"
  }.`
  const entitiesLine =
    input.relatedEntities.length > 0
      ? `Linked entities: ${input.relatedEntities.slice(0, 5).join(", ")}`
      : "Linked entities: none extracted"
  const resultLead = input.rows[0]?.summary ?? "No result summary available."
  return `${headline}\nQuery: ${input.query.trim()}\n${entitiesLine}\nLead result: ${resultLead}`
}
