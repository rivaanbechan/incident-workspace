import { NextResponse } from "next/server"

import { requireApiOrgPermission } from "@/lib/auth/access"
import { createAgent, listAgentsByOrg } from "@/lib/db/agents"

export async function GET() {
  const { error, user } = await requireApiOrgPermission("view_admin")

  if (error) {
    return error
  }

  const agents = await listAgentsByOrg(user.orgId)
  return NextResponse.json({ agents })
}

export async function POST(request: Request) {
  const { error, user } = await requireApiOrgPermission("view_admin")

  if (error) {
    return error
  }

  const body = (await request.json()) as {
    llmDatasourceId?: unknown
    name?: unknown
    personaPrompt?: unknown
    tools?: unknown
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const personaPrompt = typeof body.personaPrompt === "string" ? body.personaPrompt : ""
  const llmDatasourceId =
    typeof body.llmDatasourceId === "string" ? body.llmDatasourceId.trim() : ""
  const tools = Array.isArray(body.tools)
    ? body.tools.filter((t): t is string => typeof t === "string")
    : []

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 })
  }

  if (!llmDatasourceId) {
    return NextResponse.json({ error: "llmDatasourceId is required." }, { status: 400 })
  }

  try {
    const agent = await createAgent({ llmDatasourceId, name, orgId: user.orgId, personaPrompt, tools })
    return NextResponse.json({ agent }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create agent." },
      { status: 500 },
    )
  }
}
