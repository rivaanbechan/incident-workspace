import { NextResponse } from "next/server"

import { requireApiAdminPermission } from "@/lib/auth/access"
import { PERMISSION_REGISTRY } from "@/lib/auth/permissionRegistry"
import {
  getPermissionsForRole,
  resetPermission,
  setPermission,
} from "@/lib/db/roles"

type RouteContext = {
  params: Promise<{ roleName: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAdminPermission("admin:manage_roles")

  if (authResult.error) {
    return authResult.error
  }

  const { roleName } = await context.params
  const resolved = await getPermissionsForRole(authResult.user.orgId, roleName)
  return NextResponse.json(resolved)
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireApiAdminPermission("admin:manage_roles")

  if (authResult.error) {
    return authResult.error
  }

  const { roleName } = await context.params
  const body = (await request.json()) as {
    permissionId?: string
    granted?: boolean | null
  }

  const { permissionId, granted } = body

  if (!permissionId) {
    return NextResponse.json({ error: "permissionId is required." }, { status: 400 })
  }

  if (!PERMISSION_REGISTRY[permissionId]) {
    return NextResponse.json({ error: "Unknown permissionId." }, { status: 400 })
  }

  if (PERMISSION_REGISTRY[permissionId].systemManaged) {
    return NextResponse.json(
      { error: "This permission is system-managed and cannot be overridden." },
      { status: 403 },
    )
  }

  if (granted === undefined) {
    return NextResponse.json(
      { error: "granted must be true, false, or null." },
      { status: 400 },
    )
  }

  if (granted === null) {
    await resetPermission(authResult.user.orgId, roleName, permissionId)
  } else {
    await setPermission(
      authResult.user.orgId,
      roleName,
      permissionId,
      granted,
      authResult.user.id,
    )
  }

  const resolved = await getPermissionsForRole(authResult.user.orgId, roleName)
  return NextResponse.json(resolved)
}
