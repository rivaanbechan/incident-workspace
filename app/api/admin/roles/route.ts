import { NextResponse } from "next/server"

import { requireApiAdminPermission } from "@/lib/auth/access"
import { createRole, getRolesForOrg } from "@/lib/db/roles"

export async function GET() {
  const authResult = await requireApiAdminPermission("admin:manage_roles")

  if (authResult.error) {
    return authResult.error
  }

  const roles = await getRolesForOrg(authResult.user.orgId)
  return NextResponse.json(roles)
}

export async function POST(request: Request) {
  const authResult = await requireApiAdminPermission("admin:manage_roles")

  if (authResult.error) {
    return authResult.error
  }

  const body = (await request.json()) as { name?: string; label?: string }
  const name = body.name?.trim()
  const label = body.label?.trim()

  if (!name || !label) {
    return NextResponse.json(
      { error: "name and label are required." },
      { status: 400 },
    )
  }

  if (!/^[a-z0-9_]+$/.test(name)) {
    return NextResponse.json(
      { error: "name must contain only lowercase letters, digits, and underscores." },
      { status: 400 },
    )
  }

  try {
    const role = await createRole(authResult.user.orgId, name, label)
    return NextResponse.json(role, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create role." },
      { status: 500 },
    )
  }
}
