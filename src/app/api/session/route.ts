import { NextResponse } from "next/server"
import {
  clearStoredSession,
  getStoredSession,
  toPublicSession,
} from "@/lib/server-session"

export async function GET() {
  const storedSession = await getStoredSession()

  if (!storedSession) {
    return NextResponse.json({ error: "No active session" }, { status: 401 })
  }

  return NextResponse.json(toPublicSession(storedSession.session))
}

export async function DELETE() {
  await clearStoredSession()
  return NextResponse.json({ ok: true })
}
