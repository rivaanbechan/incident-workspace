import { NextResponse } from "next/server"

import { requireApiCasePermissionByRoomId } from "@/lib/auth/access"
import { listSavedHuntGraphViews, saveHuntGraphView } from "@/features/collab-hunt-graph/lib/storage"
import type { HuntGraphSnapshot } from "@/features/collab-hunt-graph/lib/types"
import { getInvestigationByRoomId } from "@/lib/db/investigations"

type RouteContext = {
  params: Promise<{
    roomId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { roomId } = await context.params
  const authResult = await requireApiCasePermissionByRoomId(roomId, "view")

  if (authResult.error) {
    return authResult.error
  }

  const linkedInvestigation = await getInvestigationByRoomId(roomId)

  if (!linkedInvestigation) {
    return NextResponse.json([])
  }

  const views = await listSavedHuntGraphViews(roomId)

  return NextResponse.json(views)
}

export async function POST(request: Request, context: RouteContext) {
  const { roomId } = await context.params
  const authResult = await requireApiCasePermissionByRoomId(roomId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  const linkedInvestigation = await getInvestigationByRoomId(roomId)
  const payload = (await request.json()) as {
    snapshot?: HuntGraphSnapshot
    title?: string
    viewId?: string | null
  }

  if (!linkedInvestigation) {
    return NextResponse.json(
      {
        error:
          "Temporary rooms are not persisted. Link this workspace to a case before saving hunt views.",
      },
      { status: 409 },
    )
  }

  if (!payload.snapshot || !payload.title) {
    return NextResponse.json(
      { error: "A title and graph snapshot are required." },
      { status: 400 },
    )
  }

  try {
    const savedView = await saveHuntGraphView({
      roomId,
      snapshot: payload.snapshot,
      title: payload.title,
      viewId: payload.viewId,
    })

    return NextResponse.json(savedView)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save graph view.",
      },
      { status: 500 },
    )
  }
}
