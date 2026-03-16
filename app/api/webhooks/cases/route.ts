import { NextResponse } from "next/server"

import {
  intakeCaseFromWebhook,
  isAuthorizedCaseWebhookRequest,
  normalizeCaseIntakePayload,
  readCaseWebhookSecret,
} from "@/lib/webhooks/caseIntake"

export async function POST(request: Request) {
  if (!readCaseWebhookSecret()) {
    return NextResponse.json(
      { error: "CASE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    )
  }

  if (!isAuthorizedCaseWebhookRequest(request)) {
    return NextResponse.json({ error: "Unauthorized webhook request." }, { status: 401 })
  }

  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Webhook body must be valid JSON." }, { status: 400 })
  }

  const normalized = normalizeCaseIntakePayload(payload)

  if (!normalized) {
    return NextResponse.json(
      {
        error:
          "Webhook body must include title and source { system, externalId }. Optional fields: summary, severity, owner, entities.",
      },
      { status: 400 },
    )
  }

  try {
    const result = await intakeCaseFromWebhook(normalized, { request })
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to process case webhook.",
      },
      { status: 500 },
    )
  }
}
