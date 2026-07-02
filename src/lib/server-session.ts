import { cookies } from "next/headers"
import {
  ChatGPTPublicSession,
  ChatGPTTokenSession,
} from "@/lib/auth"

const COOKIE_NAME = "chatgpt_login_demo_session"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

type SessionStore = Map<string, ChatGPTTokenSession>

const globalForSessions = globalThis as typeof globalThis & {
  __chatgptLoginDemoSessions?: SessionStore
}

const sessions =
  globalForSessions.__chatgptLoginDemoSessions ??
  new Map<string, ChatGPTTokenSession>()

globalForSessions.__chatgptLoginDemoSessions = sessions

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

export function toPublicSession(
  session: ChatGPTTokenSession
): ChatGPTPublicSession {
  return {
    accountId: session.accountId,
    email: session.email,
    expiresAt: session.expiresAt,
    mode: session.mode,
    name: session.name,
  }
}

export async function createStoredSession(session: ChatGPTTokenSession) {
  const sessionId = crypto.randomUUID()
  sessions.set(sessionId, session)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, sessionId, cookieOptions())

  return toPublicSession(session)
}

export async function getStoredSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(COOKIE_NAME)?.value
  if (!sessionId) return null

  const session = sessions.get(sessionId)
  if (!session) {
    cookieStore.delete(COOKIE_NAME)
    return null
  }

  return { sessionId, session }
}

export async function updateStoredSession(
  sessionId: string,
  session: ChatGPTTokenSession
) {
  sessions.set(sessionId, session)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, sessionId, cookieOptions())

  return toPublicSession(session)
}

export async function clearStoredSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(COOKIE_NAME)?.value

  if (sessionId) {
    sessions.delete(sessionId)
  }

  cookieStore.delete(COOKIE_NAME)
}
