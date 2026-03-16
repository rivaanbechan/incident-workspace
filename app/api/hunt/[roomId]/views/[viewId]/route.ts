import { NextResponse } from "next/server"

import { requireApiCasePermissionByRoomId } from "@/lib/auth/access"
import { getSavedHuntGraphView } from "@/features/collab-hunt-graph/lib/storage"
import { getInvestigationByRoomId } from "@/lib/db/investigations"

type RouteContext = {
  params: Promise<{
    roomId: string
    viewId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { roomId, viewId } = await context.params
  const authResult = await requireApiCasePermissionByRoomId(roomId, "view")

  if (authResult.error) {
    return authResult.error
  }

  const linkedInvestigation = await getInvestigationByRoomId(roomId)

  if (!linkedInvestigation) {
    return NextResponse.json({ error: "Graph view not found." }, { status: 404 })
  }

  const view = await getSavedHuntGraphView(roomId, viewId)

  if (!view) {
    return NextResponse.json({ error: "Graph view not found." }, { status: 404 })
  }

  return NextResponse.json(view)
}
