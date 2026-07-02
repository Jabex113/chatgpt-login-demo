import { NextResponse } from "next/server"
import { CODEX_CONFIG, ChatGPTTokenSession } from "@/lib/auth"
import {
  clearStoredSession,
  getStoredSession,
  updateStoredSession,
} from "@/lib/server-session"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type ChatRequestBody = {
  messages?: unknown
}

type TokenRefreshResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false

  const candidate = value as Record<string, unknown>
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  )
}

function isTokenRefreshResponse(value: unknown): value is TokenRefreshResponse {
  if (typeof value !== "object" || value === null) return false

  const data = value as Record<string, unknown>
  return (
    typeof data.access_token === "string" &&
    typeof data.expires_in === "number" &&
    (typeof data.refresh_token === "string" ||
      typeof data.refresh_token === "undefined")
  )
}

async function refreshAccessTokenIfNeeded(
  sessionId: string,
  currentSession: ChatGPTTokenSession
) {
  const expiresAt = new Date(currentSession.expiresAt).getTime()
  const bufferMs = 5 * 60 * 1000

  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > bufferMs) {
    return currentSession
  }

  console.log("[Auth] Token near expiration. Triggering server-side refresh...")

  const bodyParams = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CODEX_CONFIG.clientId,
    refresh_token: currentSession.refreshToken,
  })

  const refreshResponse = await fetch("https://auth.openai.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: bodyParams.toString(),
  })

  if (!refreshResponse.ok) {
    console.error(
      `[Auth Error] Token refresh rejected: ${refreshResponse.status}`
    )
    await clearStoredSession()
    return null
  }

  const data = (await refreshResponse.json()) as unknown

  if (!isTokenRefreshResponse(data)) {
    console.error("[Auth Error] Token refresh response was malformed.")
    await clearStoredSession()
    return null
  }

  const updatedSession: ChatGPTTokenSession = {
    ...currentSession,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || currentSession.refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }

  await updateStoredSession(sessionId, updatedSession)
  return updatedSession
}

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as ChatRequestBody

    if (!Array.isArray(messages) || !messages.every(isChatMessage)) {
      return NextResponse.json(
        { error: "Missing required field: messages" },
        { status: 400 }
      )
    }

    const storedSession = await getStoredSession()

    if (!storedSession) {
      return NextResponse.json(
        { error: "No active ChatGPT session. Please connect again." },
        { status: 401 }
      )
    }

    const activeSession = await refreshAccessTokenIfNeeded(
      storedSession.sessionId,
      storedSession.session
    )

    if (!activeSession) {
      return NextResponse.json(
        { error: "Session expired. Please connect again." },
        { status: 401 }
      )
    }

    console.log(
      `[Proxy] Streaming chat prompt (History size: ${messages.length}) to OpenAI Codex...`
    )

    const codexBody = {
      model: "gpt-5.5",
      store: false,
      stream: true,
      input: messages.map((msg) => ({
        role: msg.role,
        content: [
          {
            type: msg.role === "assistant" ? "output_text" : "input_text",
            text: msg.content,
          },
        ],
      })),
    }

    const apiResponse = await fetch(
      "https://chatgpt.com/backend-api/codex/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeSession.accessToken}`,
          "ChatGPT-Account-Id": activeSession.accountId,
          "OpenAI-Beta": "responses=experimental",
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(codexBody),
      }
    )

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      console.error(
        `[Proxy Error] Codex responded with error: ${apiResponse.status}`
      )
      return NextResponse.json(
        {
          error: "OpenAI Codex request failed",
          details: errText.slice(0, 1000),
        },
        { status: apiResponse.status }
      )
    }

    // Set up a ReadableStream to stream the OpenAI Codex response body directly
    const stream = new ReadableStream({
      async start(controller) {
        if (!apiResponse.body) {
          controller.close()
          return
        }
        const reader = apiResponse.body.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }
            controller.enqueue(value)
          }
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (err: unknown) {
    console.error("[Proxy Error] Chat proxy invocation failed:", err)
    return NextResponse.json(
      { error: "Chat proxy failure", details: getErrorMessage(err) },
      { status: 500 }
    )
  }
}
