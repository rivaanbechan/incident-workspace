import { NextResponse } from "next/server"

import { requireApiAdminPermission } from "@/lib/auth/access"
import { getPermissionsByDomain } from "@/lib/auth/permissionRegistry"

export async function GET() {
  const authResult = await requireApiAdminPermission("admin:view")

  if (authResult.error) {
    return authResult.error
  }

  return NextResponse.json(getPermissionsByDomain())
}
