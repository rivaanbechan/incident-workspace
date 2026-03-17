import { NextResponse } from "next/server"

import { requireApiOrgPermission } from "@/lib/auth/access"
import { invokeAgentStream, type InvokeRequestBody } from "@/features/agents/lib/invokeAgentStream"

type Params = { params: Promise<{ agentId: string }> }

export async function POST(request: Request, { params }: Params) {
  const authResult = await requireApiOrgPermission("create_case")

  if (authResult.error) return authResult.error

  const { agentId } = await params

  let body: InvokeRequestBody

  try {
    body = (await request.json()) as InvokeRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (!body.focusEntity || typeof body.focusEntity.id !== "string") {
    return NextResponse.json({ error: "focusEntity is required." }, { status: 400 })
  }

  return invokeAgentStream(agentId, body)
}
