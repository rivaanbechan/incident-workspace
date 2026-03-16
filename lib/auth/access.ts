import { createHmac, timingSafeEqual } from "node:crypto"

import { redirect } from "next/navigation"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import type {
  AuthenticatedUser,
  CaseAccessContext,
  CasePermission,
  OrgPermission,
} from "@/lib/auth/permissions"
import { hasCasePermission, hasOrgPermission } from "@/lib/auth/permissions"
import { getAuthenticatedUserById, getCaseMembership } from "@/lib/db/auth"
import { getInvestigationByRoomId } from "@/lib/db/investigations"

type CollabTokenPayload = {
  exp: number
  orgId: string
  roomId: string
  user: Pick<AuthenticatedUser, "color" | "email" | "id" | "name" | "orgRole">
}

function getAuthSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    null
  )
}

function encodeBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Buffer.from(`${normalized}${padding}`, "base64")
}

function createSignature(payload: string, secret: string) {
  return encodeBase64Url(createHmac("sha256", secret).update(payload).digest())
}

export async function getCurrentUser() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return null
  }

  return getAuthenticatedUserById(userId)
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

export async function requireOrgPermission(permission: OrgPermission) {
  const user = await requireAuthenticatedUser()

  if (!hasOrgPermission(user.orgRole, permission)) {
    redirect("/unauthorized")
  }

  return user
}

export async function getCaseAccessByCaseId(
  caseId: string,
  user: AuthenticatedUser,
): Promise<CaseAccessContext> {
  const membership = await getCaseMembership(caseId, user.id)

  return {
    ...user,
    caseId,
    caseRole: membership?.role ?? null,
    roomId: membership?.room_id ?? null,
  }
}

export async function getCaseAccessByRoomId(roomId: string, user: AuthenticatedUser) {
  const investigation = await getInvestigationByRoomId(roomId)

  if (!investigation) {
    return {
      ...user,
      caseId: null,
      caseRole: null,
      roomId,
    } satisfies CaseAccessContext
  }

  return getCaseAccessByCaseId(investigation.id, user)
}

export async function requireCasePermissionByCaseId(
  caseId: string,
  permission: CasePermission,
) {
  const user = await requireAuthenticatedUser()
  const access = await getCaseAccessByCaseId(caseId, user)

  if (!hasCasePermission(access, permission)) {
    redirect("/unauthorized")
  }

  return access
}

export async function requireCasePermissionByRoomId(
  roomId: string,
  permission: CasePermission,
) {
  const user = await requireAuthenticatedUser()
  const access = await getCaseAccessByRoomId(roomId, user)

  if (!access.caseId) {
    return access
  }

  if (!hasCasePermission(access, permission)) {
    redirect("/unauthorized")
  }

  return access
}

export function unauthorizedJson(message = "Authentication required.") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenJson(message = "You do not have access to this resource.") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function requireApiOrgPermission(permission: OrgPermission) {
  const user = await getCurrentUser()

  if (!user) {
    return { error: unauthorizedJson(), user: null }
  }

  if (!hasOrgPermission(user.orgRole, permission)) {
    return { error: forbiddenJson(), user: null }
  }

  return { error: null, user }
}

export async function requireApiCasePermissionByCaseId(
  caseId: string,
  permission: CasePermission,
) {
  const user = await getCurrentUser()

  if (!user) {
    return { access: null, error: unauthorizedJson() }
  }

  const access = await getCaseAccessByCaseId(caseId, user)

  if (!hasCasePermission(access, permission)) {
    return { access: null, error: forbiddenJson() }
  }

  return { access, error: null }
}

export async function requireApiCasePermissionByRoomId(
  roomId: string,
  permission: CasePermission,
) {
  const user = await getCurrentUser()

  if (!user) {
    return { access: null, error: unauthorizedJson() }
  }

  const access = await getCaseAccessByRoomId(roomId, user)

  if (access.caseId && !hasCasePermission(access, permission)) {
    return { access: null, error: forbiddenJson() }
  }

  return { access, error: null }
}

export function createCollabToken(user: AuthenticatedUser, roomId: string, expiresInSeconds = 3600) {
  const secret = getAuthSecret()

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured.")
  }

  const payload = JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    orgId: user.orgId,
    roomId,
    user: {
      color: user.color,
      email: user.email,
      id: user.id,
      name: user.name,
      orgRole: user.orgRole,
    },
  } satisfies CollabTokenPayload)

  const encodedPayload = encodeBase64Url(payload)
  const signature = createSignature(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export function verifyCollabToken(token: string, roomId: string) {
  const secret = getAuthSecret()

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured.")
  }

  const [encodedPayload, signature] = token.split(".")

  if (!encodedPayload || !signature) {
    return null
  }

  const expectedSignature = createSignature(encodedPayload, secret)
  const isValid =
    signature.length === expectedSignature.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

  if (!isValid) {
    return null
  }

  const parsed = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as CollabTokenPayload

  if (parsed.roomId !== roomId || parsed.exp <= Math.floor(Date.now() / 1000)) {
    return null
  }

  return parsed
}
