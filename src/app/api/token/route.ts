import { NextResponse } from "next/server"
import { decodeJwt, extractAccountId } from "@/lib/auth"
import { createStoredSession } from "@/lib/server-session"

type TokenExchangeResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  id_token?: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isTokenExchangeResponse(value: unknown): value is TokenExchangeResponse {
  if (typeof value !== "object" || value === null) return false

  const data = value as Record<string, unknown>
  return (
    typeof data.access_token === "string" &&
    typeof data.refresh_token === "string" &&
    typeof data.expires_in === "number"
  )
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const requestParams = new URLSearchParams(rawBody)

    if (requestParams.get("grant_type") !== "authorization_code") {
      return NextResponse.json(
        { error: "Only authorization code exchange is accepted here" },
        { status: 400 }
      )
    }

    console.log("[Proxy] Initiating token exchange request to OpenAI...")

    const tokenResponse = await fetch("https://auth.openai.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: rawBody,
    })

    const status = tokenResponse.status
    const responseData = await tokenResponse.text()

    console.log(`[Proxy] OpenAI responded with status: ${status}`)

    if (!tokenResponse.ok) {
      return new NextResponse(responseData, {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const parsedData = JSON.parse(responseData) as unknown

    if (!isTokenExchangeResponse(parsedData)) {
      return NextResponse.json(
        { error: "OpenAI token response was missing expected fields" },
        { status: 502 }
      )
    }

    const idPayload = parsedData.id_token ? decodeJwt(parsedData.id_token) : {}

    const publicSession = await createStoredSession({
      accessToken: parsedData.access_token,
      refreshToken: parsedData.refresh_token,
      expiresAt: new Date(
        Date.now() + parsedData.expires_in * 1000
      ).toISOString(),
      accountId: extractAccountId(parsedData.access_token),
      email:
        typeof idPayload.email === "string"
          ? idPayload.email
          : "unknown@openai.com",
      mode: "oauth",
      name:
        typeof idPayload.name === "string"
          ? idPayload.name
          : typeof idPayload.nickname === "string"
            ? idPayload.nickname
            : "ChatGPT User",
    })

    return NextResponse.json(publicSession)
  } catch (err: unknown) {
    console.error("[Proxy Error] Token exchange failed:", err)
    return NextResponse.json(
      { error: "Internal token proxy failure", details: getErrorMessage(err) },
      { status: 500 }
    )
  }
}
