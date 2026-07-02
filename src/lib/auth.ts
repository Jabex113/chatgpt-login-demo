// Helpers for Base64URL Encoding and PKCE Cryptography
export function base64UrlEncode(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return typeof window !== "undefined"
    ? window
        .btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "")
    : ""
}

export function generateRandomString(length = 32): string {
  const array = new Uint8Array(length)
  if (typeof window !== "undefined") {
    window.crypto.getRandomValues(array)
  }
  return base64UrlEncode(array.buffer)
}

export async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return window.crypto.subtle.digest("SHA-256", data)
}

export async function generateChallengeOf(verifier: string): Promise<string> {
  const hashed = await sha256(verifier)
  return base64UrlEncode(hashed)
}

export type ChatGPTSessionMode = "oauth" | "sandbox"

export interface ChatGPTPublicSession {
  expiresAt: string
  accountId: string
  email: string
  name: string
  mode: ChatGPTSessionMode
}

export interface ChatGPTTokenSession extends ChatGPTPublicSession {
  accessToken: string
  refreshToken: string
  mode: "oauth"
}

type JwtPayload = Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function decodeJwt(token: string): JwtPayload {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return {}
    const jsonPayload = decodeBase64Url(parts[1])
    const payload = JSON.parse(jsonPayload) as unknown
    return isRecord(payload) ? payload : {}
  } catch (err) {
    console.error("Error decoding JWT payload:", err)
    return {}
  }
}

export function extractAccountId(accessToken: string): string {
  const payload = decodeJwt(accessToken)
  const auth = payload["https://api.openai.com/auth"]
  if (isRecord(auth) && typeof auth.account_id === "string") {
    return auth.account_id
  }
  if (typeof payload.account_id === "string") return payload.account_id
  if (typeof payload.sub === "string") return payload.sub
  return "unknown"
}

function decodeBase64Url(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")

  if (typeof window !== "undefined") {
    return decodeURIComponent(
      window
        .atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
  }

  return Buffer.from(padded, "base64").toString("utf8")
}

export function getRedirectUri(): string {
  if (process.env.NEXT_PUBLIC_CHATGPT_REDIRECT_URI) {
    return process.env.NEXT_PUBLIC_CHATGPT_REDIRECT_URI
  }

  if (typeof window !== "undefined" && isLocalOrigin()) {
    return `${window.location.origin}/auth/callback`
  }

  return "http://localhost:1455/auth/callback"
}

export function isLocalOrigin(): boolean {
  if (typeof window === "undefined") return false

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
}

export function canStartCodexOAuth(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CHATGPT_REDIRECT_URI) || isLocalOrigin()
}

// Codex Client Config (Must match whitelisted values exactly)
export const CODEX_CONFIG = {
  clientId:
    process.env.NEXT_PUBLIC_OPENAI_CODEX_CLIENT_ID ||
    "app_EMoamEEZ73f0CkXaXp7hrann",
  authUrl: "https://auth.openai.com/oauth/authorize",
  originator:
    process.env.NEXT_PUBLIC_OPENAI_CODEX_ORIGINATOR || "Codex Desktop",
  scope:
    "openid profile email offline_access api.connectors.read api.connectors.invoke",
}
