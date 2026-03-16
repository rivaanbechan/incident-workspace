import { NextResponse } from "next/server"

import { requireApiCasePermissionByRoomId } from "@/lib/auth/access"
import type { InvestigationArtifact } from "@/lib/contracts/artifacts"
import { createRoomArtifact, listRoomArtifacts } from "@/lib/db/artifacts"
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

  const artifacts = await listRoomArtifacts(roomId)

  return NextResponse.json(artifacts)
}

export async function POST(request: Request, context: RouteContext) {
  const { roomId } = await context.params
  const authResult = await requireApiCasePermissionByRoomId(roomId, "edit")

  if (authResult.error) {
    return authResult.error
  }

  const linkedInvestigation = await getInvestigationByRoomId(roomId)
  const payload = (await request.json()) as {
    artifact?: InvestigationArtifact
  }

  if (!linkedInvestigation) {
    return NextResponse.json(
      {
        error:
          "Temporary rooms are not persisted. Link this workspace to a case before saving findings.",
      },
      { status: 409 },
    )
  }

  if (!payload.artifact) {
    return NextResponse.json(
      { error: "An investigation artifact is required." },
      { status: 400 },
    )
  }

  try {
    const artifact = await createRoomArtifact(roomId, payload.artifact)

    return NextResponse.json(artifact)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to persist room artifact.",
      },
      { status: 500 },
    )
  }
}
