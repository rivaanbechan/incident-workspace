import type { CaseIntakePayload, CaseIntakeResult } from "@/lib/contracts/caseIntake"
import type { EntityRef } from "@/lib/contracts/entities"
import { getCaseDetailHref } from "@/features/cases/manifest"
import { getUserByEmail, upsertCaseMembership } from "@/lib/db/auth"
import {
  entityRefToInvestigationEntityInput,
  upsertInvestigationEntity,
} from "@/lib/db/investigationEntities"
import {
  createInvestigation,
  findInvestigationBySourceReference,
  logInvestigationActivity,
} from "@/lib/db/investigations"

function normalizeEntityRefs(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is EntityRef => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as EntityRef).id === "string" &&
      typeof (item as EntityRef).kind === "string" &&
      typeof (item as EntityRef).label === "string"
    )
  })
}

export function readCaseWebhookSecret() {
  return process.env.CASE_WEBHOOK_SECRET?.trim() || null
}

export function isAuthorizedCaseWebhookRequest(request: Request) {
  const secret = readCaseWebhookSecret()

  if (!secret) {
    return false
  }

  const bearerHeader = request.headers.get("authorization")?.trim() ?? ""
  const explicitHeader = request.headers.get("x-case-webhook-secret")?.trim() ?? ""
  const bearerToken = bearerHeader.toLowerCase().startsWith("bearer ")
    ? bearerHeader.slice("bearer ".length).trim()
    : ""

  return explicitHeader === secret || bearerToken === secret
}

export function normalizeCaseIntakePayload(value: unknown): CaseIntakePayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const payload = value as Record<string, unknown>
  const source = payload.source as Record<string, unknown> | undefined

  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    typeof source.system !== "string" ||
    typeof source.externalId !== "string"
  ) {
    return null
  }

  if (typeof payload.title !== "string" || payload.title.trim().length === 0) {
    return null
  }

  return {
    entities: normalizeEntityRefs(payload.entities),
    owner:
      typeof payload.owner === "string" && payload.owner.trim().length > 0
        ? payload.owner.trim()
        : undefined,
    severity:
      payload.severity === "low" ||
      payload.severity === "medium" ||
      payload.severity === "high" ||
      payload.severity === "critical"
        ? payload.severity
        : undefined,
    source: {
      externalId: source.externalId.trim(),
      system: source.system.trim(),
    },
    summary:
      typeof payload.summary === "string" && payload.summary.trim().length > 0
        ? payload.summary.trim()
        : undefined,
    title: payload.title.trim(),
  }
}

export function buildPublicAppOrigin(request: Request) {
  const explicitBaseUrl = process.env.APP_BASE_URL?.trim()

  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "")
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim()
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim()

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

function getWorkspaceHref(roomId: string) {
  return `/board/${roomId}?fit=1`
}

function getWebhookOwnerEmailCandidates(payload: CaseIntakePayload) {
  const candidates = [
    payload.owner,
    process.env.AUTH_WEBHOOK_OWNER_EMAIL?.trim(),
    process.env.AUTH_BOOTSTRAP_EMAIL?.trim(),
  ]

  return candidates
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase())
}

export async function intakeCaseFromWebhook(
  payload: CaseIntakePayload,
  options: {
    request: Request
  },
): Promise<CaseIntakeResult> {
  const existing = await findInvestigationBySourceReference(
    payload.source.system,
    payload.source.externalId,
  )

  const investigation =
    existing ??
    (await createInvestigation({
      owner: payload.owner ?? "Unassigned",
      severity: payload.severity ?? "high",
      source: {
        externalId: payload.source.externalId,
        system: payload.source.system,
      },
      summary:
        payload.summary ??
        `Automatically created from ${payload.source.system} event ${payload.source.externalId}.`,
      title: payload.title,
    }))

  if (!investigation) {
    throw new Error("Unable to create or load the investigation.")
  }

  if (!existing) {
    await logInvestigationActivity(
      investigation.id,
      "metadata_updated",
      `Case ingested from ${payload.source.system} reference ${payload.source.externalId}.`,
    )

    for (const email of getWebhookOwnerEmailCandidates(payload)) {
      const user = await getUserByEmail(email)

      if (!user) {
        continue
      }

      await upsertCaseMembership({
        caseId: investigation.id,
        role: "case_owner",
        userId: user.id,
      })

      break
    }
  }

  for (const entity of payload.entities ?? []) {
    await upsertInvestigationEntity(investigation.id, {
      ...entityRefToInvestigationEntityInput(entity),
      payload: {
        sourceExternalId: payload.source.externalId,
        sourceSystem: payload.source.system,
      },
    })
  }

  const origin = buildPublicAppOrigin(options.request)

  return {
    caseUrl: `${origin}${getCaseDetailHref(investigation.id)}`,
    created: !existing,
    investigation,
    roomUrl: `${origin}${getWorkspaceHref(investigation.roomId)}`,
    workspaceUrl: `${origin}${getWorkspaceHref(investigation.roomId)}`,
  }
}
