import { NextResponse } from "next/server"

import { createCollabToken, forbiddenJson, requireApiCasePermissionByRoomId } from "@/lib/auth/access"

type RouteContext = {
  params: Promise<{
    roomId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { roomId } = await context.params
  const authResult = await requireApiCasePermissionByRoomId(roomId, "view")

  if (!authResult.access) {
    return authResult.error ?? forbiddenJson()
  }

  try {
    return NextResponse.json({
      access: {
        caseId: authResult.access.caseId,
        caseRole: authResult.access.caseRole,
        roomId,
      },
      collabToken: createCollabToken(authResult.access, roomId),
      user: {
        color: authResult.access.color,
        email: authResult.access.email,
        id: authResult.access.id,
        name: authResult.access.name,
        orgRole: authResult.access.orgRole,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate access token." },
      { status: 500 },
    )
  }
}
