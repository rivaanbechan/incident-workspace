import { NextResponse } from "next/server"

import { requireApiOrgPermission } from "@/lib/auth/access"
import { deleteAgent, getAgentById, updateAgent } from "@/lib/db/agents"

type Params = { params: Promise<{ agentId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { error } = await requireApiOrgPermission("view_admin")

  if (error) {
    return error
  }

  const { agentId } = await params
  const agent = await getAgentById(agentId)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 })
  }

  return NextResponse.json({ agent })
}

export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireApiOrgPermission("view_admin")

  if (error) {
    return error
  }

  const { agentId } = await params

  const body = (await request.json()) as {
    llmDatasourceId?: unknown
    name?: unknown
    personaPrompt?: unknown
    tools?: unknown
  }

  const input: Parameters<typeof updateAgent>[1] = {}

  if (typeof body.name === "string") input.name = body.name
  if (typeof body.personaPrompt === "string") input.personaPrompt = body.personaPrompt
  if (typeof body.llmDatasourceId === "string") input.llmDatasourceId = body.llmDatasourceId
  if (Array.isArray(body.tools)) {
    input.tools = body.tools.filter((t): t is string => typeof t === "string")
  }

  const agent = await updateAgent(agentId, input)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 })
  }

  return NextResponse.json({ agent })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireApiOrgPermission("view_admin")

  if (error) {
    return error
  }

  const { agentId } = await params
  const deletedId = await deleteAgent(agentId)

  if (!deletedId) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 })
  }

  return NextResponse.json({ id: deletedId })
}
