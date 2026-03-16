import { AccessToken } from "livekit-server-sdk"
import { NextResponse } from "next/server"

import { forbiddenJson, requireApiCasePermissionByRoomId } from "@/lib/auth/access"

type TokenRequestBody = { roomName?: string }

async function resolveLiveKitServerUrl(request: Request) {
  const configuredUrl =
    process.env.LIVEKIT_PUBLIC_URL || process.env.LIVEKIT_URL || "ws://localhost:7880"

  const serverUrl = new URL(configuredUrl)
  const requestHeaders = request.headers
  const originHeader = requestHeaders.get("origin")
  const refererHeader = requestHeaders.get("referer")
  const forwardedProto = requestHeaders.get("x-forwarded-proto")
  const forwardedHost = requestHeaders.get("x-forwarded-host")
  const requestHost = forwardedHost || requestHeaders.get("host")
  const isLoopbackHost =
    serverUrl.hostname === "localhost" ||
    serverUrl.hostname === "127.0.0.1" ||
    serverUrl.hostname === "0.0.0.0"

  if (isLoopbackHost && requestHost) {
    const requestOrigin =
      originHeader
        ? new URL(originHeader)
        : refererHeader
          ? new URL(refererHeader)
          : new URL(
              `${forwardedProto || new URL(request.url).protocol.replace(":", "")}://${requestHost}`,
            )

    serverUrl.hostname = requestOrigin.hostname
  }

  return serverUrl.toString()
}

export async function POST(request: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const serverUrl = await resolveLiveKitServerUrl(request)

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET environment variables.",
      },
      { status: 500 },
    )
  }

  const body = (await request.json()) as TokenRequestBody
  const roomName = body.roomName?.trim()

  if (!roomName) {
    return NextResponse.json(
      { error: "roomName is required." },
      { status: 400 },
    )
  }

  const authResult = await requireApiCasePermissionByRoomId(roomName, "view")

  if (!authResult.access) {
    return authResult.error ?? forbiddenJson()
  }

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity: authResult.access.id,
      name: authResult.access.name,
      ttl: "2h",
    })

    token.addGrant({
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      room: roomName,
      roomJoin: true,
    })

    return NextResponse.json({
      serverUrl,
      token: await token.toJwt(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate access token." },
      { status: 500 },
    )
  }
}
