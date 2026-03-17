import { NextResponse } from "next/server"

import { requireApiCasePermissionByCaseId } from "@/lib/auth/access"
import { invokeAgentStream, type InvokeRequestBody } from "@/features/agents/lib/invokeAgentStream"

type Params = { params: Promise<{ agentId: string; caseId: string }> }

export async function POST(request: Request, { params }: Params) {
  const { agentId, caseId } = await params

  const { access, error } = await requireApiCasePermissionByCaseId(caseId, "edit")

  if (error) return error

  if (!access) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 })
  }

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
