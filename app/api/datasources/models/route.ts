import { NextResponse } from "next/server"

import { requireApiOrgPermission } from "@/lib/auth/access"
import { listModels } from "@/lib/ai/ollama"

export async function GET(request: Request) {
  const authResult = await requireApiOrgPermission("manage_integrations")

  if (authResult.error) {
    return authResult.error
  }

  const { searchParams } = new URL(request.url)
  const baseUrl = searchParams.get("baseUrl")?.trim()

  if (!baseUrl) {
    return NextResponse.json({ error: "baseUrl is required." }, { status: 400 })
  }

  try {
    const models = await listModels(baseUrl)
    return NextResponse.json({ models })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch models." },
      { status: 502 },
    )
  }
}
