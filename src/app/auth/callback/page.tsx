"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CODEX_CONFIG, getRedirectUri } from "@/lib/auth"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default function CallbackPage() {
  const router = useRouter()
  const [heading, setHeading] = useState("Connecting ChatGPT")
  const [message, setMessage] = useState("Exchanging authorization code...")

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const state = params.get("state")
      const errParam = params.get("error") || params.get("error_description")

      if (errParam) {
        router.push(`/?error=${encodeURIComponent(errParam)}`)
        return
      }

      const savedState = sessionStorage.getItem("oauth_state")
      const codeVerifier = sessionStorage.getItem("oauth_verifier")

      if (!state || state !== savedState) {
        router.push(`/?error=CSRF_State_Mismatch`)
        return
      }

      if (!code || !codeVerifier) {
        router.push(`/?error=Missing_Code_Or_Verifier`)
        return
      }

      try {
        setMessage("Exchanging tokens...")

        const bodyParams = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: CODEX_CONFIG.clientId,
          code: code,
          redirect_uri: getRedirectUri(),
          code_verifier: codeVerifier,
        })

        const res = await fetch("/api/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Token exchange failed: ${res.status} ${text}`)
        }

        setMessage("Saving session...")
        await res.json()

        sessionStorage.removeItem("oauth_state")
        sessionStorage.removeItem("oauth_verifier")

        setHeading("Connected!")
        setMessage("Redirecting...")

        setTimeout(() => {
          router.push("/")
        }, 600)
      } catch (err: unknown) {
        const message = getErrorMessage(err)
        console.error("Error during callback token exchange:", err)
        router.push(`/?error=${encodeURIComponent(message)}`)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-background text-foreground">
      <Card className="w-full max-w-sm border-border bg-card text-card-foreground">
        <CardHeader className="flex flex-col items-center justify-center space-y-4 text-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <CardTitle className="text-xl">{heading}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {message}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
