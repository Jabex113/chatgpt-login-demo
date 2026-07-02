"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  ArrowUpIcon,
  MessageCircleDashedIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react"
import {
  CODEX_CONFIG,
  generateRandomString,
  generateChallengeOf,
  ChatGPTPublicSession,
  getRedirectUri,
  canStartCodexOAuth,
} from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
} from "@/components/ui/message-scroller"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

type StreamEvent = {
  delta?: string
  type?: string
  response?: {
    output_text?: string
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function OpenAILogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg role="img" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <title>OpenAI</title>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  )
}

function createMessage(message: Omit<ChatMessage, "id">): ChatMessage {
  return {
    id: crypto.randomUUID(),
    ...message,
  }
}

function ChatClient() {
  const [session, setSession] = useState<ChatGPTPublicSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadSession() {
      localStorage.removeItem("chatgpt_oauth_tokens")

      try {
        const res = await fetch("/api/session", { cache: "no-store" })
        if (!res.ok) return

        const currentSession = (await res.json()) as ChatGPTPublicSession
        if (!ignore) {
          setSession(currentSession)
        }
      } catch (err) {
        console.warn("[Auth] Failed to load existing session:", err)
      }
    }

    loadSession()

    const errParam = new URLSearchParams(window.location.search).get("error")
    queueMicrotask(() => {
      if (ignore) return

      if (errParam) {
        setError(decodeURIComponent(errParam))
      }
      setIsMounted(true)
    })

    return () => {
      ignore = true
    }
  }, [])

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [showSettings, setShowSettings] = useState(false)
  const oauthUnavailable = isMounted && !canStartCodexOAuth()

  // Clean OAuth error params after the initial state reads them.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("error")) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Initiate OAuth flow
  const handleConnect = async () => {
    try {
      if (!canStartCodexOAuth()) {
        setError(
          "This hosted preview cannot start Codex OAuth because the Codex client rejects this callback URL. Run it locally, or set an approved NEXT_PUBLIC_CHATGPT_REDIRECT_URI."
        )
        return
      }

      const state = generateRandomString(16)
      const verifier = generateRandomString(32)
      const challenge = await generateChallengeOf(verifier)

      sessionStorage.setItem("oauth_state", state)
      sessionStorage.setItem("oauth_verifier", verifier)

      const url = new URL(CODEX_CONFIG.authUrl)
      url.searchParams.set("response_type", "code")
      url.searchParams.set("client_id", CODEX_CONFIG.clientId)
      url.searchParams.set("redirect_uri", getRedirectUri())
      url.searchParams.set("scope", CODEX_CONFIG.scope)
      url.searchParams.set("state", state)
      url.searchParams.set("code_challenge", challenge)
      url.searchParams.set("code_challenge_method", "S256")
      url.searchParams.set("id_token_add_organizations", "true")
      url.searchParams.set("codex_cli_simplified_flow", "true")
      url.searchParams.set("originator", CODEX_CONFIG.originator)

      console.log("[Auth] Redirecting to OpenAI Authorization...")
      window.location.href = url.toString()
    } catch (err: unknown) {
      const message = getErrorMessage(err)
      console.error("Failed to initiate login:", err)
      setError("Failed to generate PKCE challenge: " + message)
    }
  }

  const handleDisconnect = async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined)
    localStorage.removeItem("chatgpt_oauth_tokens")
    setSession(null)
    setChatHistory([])
  }

  // Handle message compose textarea height adjustment
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    setInput(el.value)

    el.style.height = "20px"
    const scrollHeight = el.scrollHeight
    el.style.height = `${Math.min(scrollHeight - 4, 80)}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isGenerating) {
        handleSubmit()
      }
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const prompt = input.trim()
    if (!prompt || isGenerating || !session) return

    // 1. Add user message
    const updatedHistory = [
      ...chatHistory,
      createMessage({ role: "user", content: prompt }),
    ]
    setChatHistory(updatedHistory)
    setInput("")
    setIsGenerating(true)

    // Reset composer textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "20px"
    }

    // 2. Add empty assistant placeholder
    setChatHistory((prev) => [
      ...prev,
      createMessage({ role: "assistant", content: "", isStreaming: true }),
    ])

    try {
      if (session.mode === "sandbox") {
        await new Promise((resolve) => setTimeout(resolve, 250))
        setChatHistory((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content:
                "Sandbox mode is a local UI preview. Connect your ChatGPT account to send real prompts.",
              isStreaming: false,
            }
          }
          return next
        })
        return
      }

      // 3. Request stream proxy. Tokens stay server-side.
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedHistory,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Server Error: ${response.status}`)
      }

      // 5. Read SSE chunks
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let assistantText = ""

      if (!reader) throw new Error("Response body is not readable")

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const cleanLine = line.trim()
          if (!cleanLine.startsWith("data:")) continue

          const payload = cleanLine.slice(5).trim()
          if (payload === "[DONE]") continue

          try {
            const event = JSON.parse(payload) as StreamEvent

            if (
              event.delta &&
              (!event.type || event.type === "response.output_text.delta")
            ) {
              assistantText += event.delta
              setChatHistory((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last && last.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: assistantText,
                  }
                }
                return next
              })
            } else if (event.response && event.response.output_text) {
              assistantText = event.response.output_text
              setChatHistory((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last && last.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: assistantText,
                  }
                }
                return next
              })
            }
          } catch {
            // Ignore incomplete JSON chunks
          }
        }
      }

      // Mark streaming done
      setChatHistory((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            isStreaming: false,
          }
        }
        return next
      })
    } catch (err: unknown) {
      const message = getErrorMessage(err)
      console.error("[Chat Error] Prompt generation failed:", err)
      setChatHistory((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === "assistant") {
          next[next.length - 1] = {
            ...last,
            content: `Error: ${message}`,
            isStreaming: false,
          }
        }
        return next
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Get user initials
  const getInitials = () => {
    if (!session?.name) return "ME"
    return session.name.slice(0, 2).toUpperCase()
  }

  if (!isMounted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground selection:bg-primary/25">
        <div className="relative flex w-full flex-col gap-4">
          <Card className="mx-auto w-full max-w-sm gap-0 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 shadow-2xl">
            <div className="h-100 flex items-center justify-center">
              <div className="text-zinc-500 animate-pulse text-sm">Loading...</div>
            </div>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground selection:bg-primary/25">
      <div className="relative flex w-full flex-col gap-4">
        {!session ? (
          <Card className="mx-auto w-full max-w-sm gap-0 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 shadow-2xl p-4">
            <CardContent className="p-0">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription className="break-all text-left font-mono text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
              {oauthUnavailable && !error && (
                <Alert className="mb-4 border-zinc-800 bg-zinc-900/40 text-zinc-300">
                  <AlertDescription className="text-left text-xs leading-relaxed">
                    Hosted preview mode. Run this app locally to connect a
                    ChatGPT account with Codex OAuth.
                  </AlertDescription>
                </Alert>
              )}
              <Empty className="min-h-72 border-0 animate-in fade-in duration-300">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-foreground [&_svg]:size-5">
                    <MessageCircleDashedIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-lg font-semibold text-foreground tracking-tight mt-1">Morning, Guest!</EmptyTitle>
                </EmptyHeader>
              </Empty>
            </CardContent>
            <CardFooter className="flex-col gap-2 p-0 pt-4 border-t-0 bg-transparent">
              <Button
                variant="outline"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800 text-zinc-100 hover:text-white font-medium h-10 transition-colors"
                onClick={handleConnect}
              >
                Continue with ChatGPT
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSession({
                    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
                    accountId: "mock_account_id",
                    email: "guest@example.com",
                    name: "Guest User",
                    mode: "sandbox",
                  })
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 hover:bg-transparent h-9"
              >
                Back to chat (Sandbox mode)
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="mx-auto h-140 w-full max-w-sm gap-0 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 shadow-2xl relative overflow-hidden">
            {showSettings ? (
              // Settings Mode inside Card
              <>
                <CardHeader className="flex flex-row justify-between items-center px-4 py-2 border-b-0 animate-in fade-in duration-200">
                  <CardTitle className="text-base font-semibold tracking-tight">Settings</CardTitle>
                  <CardAction>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full size-8 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-foreground text-foreground"
                      onClick={() => setShowSettings(false)}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </CardAction>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Account Section */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Account</h4>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Name</span>
                        <span className="font-medium text-foreground">{session.name || "N/A"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Email</span>
                        <span className="font-medium text-foreground">{session.email}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Account ID</span>
                        <span className="font-mono text-xs text-zinc-300">{session.accountId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Session Section */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Session</h4>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Mode</span>
                        <span className="font-medium text-zinc-300 capitalize">{session.mode}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Token Storage</span>
                        <span className="font-medium text-zinc-300">Server-side</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Browser Access</span>
                        <span className="font-medium text-zinc-300">Not exposed</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Expires At</span>
                        <span className="font-medium text-zinc-300">{new Date(session.expiresAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-3 border-t-0 bg-transparent p-4 w-full rounded-b-3xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl border-zinc-800 hover:bg-zinc-900 text-foreground"
                    onClick={() => {
                      setChatHistory([])
                      setShowSettings(false)
                    }}
                    disabled={chatHistory.length === 0}
                  >
                    Reset Chat
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white"
                    onClick={() => {
                      handleDisconnect()
                      setShowSettings(false)
                    }}
                  >
                    Disconnect
                  </Button>
                </CardFooter>
              </>
            ) : (
              // Chat Mode inside Card
              <>
                <CardHeader className="flex flex-row justify-end items-center px-4 py-2 border-b-0 animate-in fade-in duration-200">
                  <CardAction className="ml-auto">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full size-8 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-foreground text-foreground"
                            aria-label="Settings"
                            onClick={() => setShowSettings(true)}
                          >
                            <SettingsIcon className="size-4" />
                          </Button>
                        }
                      />
                      <TooltipContent>
                        <p>Settings</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardAction>
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden p-0 animate-in fade-in duration-200">
                  {chatHistory.length === 0 ? (
                    <Empty className="h-full">
                      <EmptyHeader>
                        <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-foreground [&_svg]:size-5">
                          <MessageCircleDashedIcon />
                        </EmptyMedia>
                        <EmptyTitle className="text-lg font-semibold text-foreground tracking-tight mt-1">
                          Morning, {session.name || session.email.split("@")[0]}!
                        </EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <MessageScroller>
                      <MessageScrollerViewport>
                        <MessageScrollerContent
                          aria-busy={isGenerating}
                          className="p-(--card-spacing)"
                        >
                          {chatHistory.map((msg) => {
                            const align = msg.role === "user" ? "end" : "start"

                            return (
                              <MessageScrollerItem
                                key={msg.id}
                                messageId={msg.id}
                                scrollAnchor={msg.role === "user"}
                              >
                                <Message align={align}>
                                  <MessageAvatar>
                                    <Avatar>
                                      {msg.role === "user" ? (
                                        <AvatarFallback>
                                          {getInitials()}
                                        </AvatarFallback>
                                      ) : (
                                        <div className="flex size-full items-center justify-center bg-[#10a37f] text-white p-1.5 rounded-full">
                                          <OpenAILogo className="size-full" />
                                        </div>
                                      )}
                                    </Avatar>
                                  </MessageAvatar>
                                  <MessageContent>
                                    {msg.isStreaming && msg.content === "" ? (
                                      <div className="flex items-center select-none py-2.5 px-1">
                                        <span className="thinking-shimmer font-medium tracking-wide text-sm">Thinking...</span>
                                      </div>
                                    ) : (
                                      <Bubble
                                        align={align}
                                        variant={msg.role === "user" ? "default" : "muted"}
                                      >
                                        <BubbleContent>
                                          {msg.content}
                                          {msg.isStreaming && <span className="streaming-cursor">▊</span>}
                                        </BubbleContent>
                                      </Bubble>
                                    )}
                                  </MessageContent>
                                </Message>
                              </MessageScrollerItem>
                            )
                          })}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                      <MessageScrollerButton />
                    </MessageScroller>
                  )}
                </CardContent>

                <CardFooter className="flex-col gap-2 border-t-0 bg-transparent pt-0 pb-4 px-4 animate-in fade-in duration-200">
                  <form onSubmit={handleSubmit} className="w-full">
                    <InputGroup className="rounded-[24px] border border-zinc-800/80 bg-zinc-900/40 p-1.5 focus-within:border-zinc-700/80 focus-within:ring-0">
                      <InputGroupTextarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleTextareaInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Message ChatGPT..."
                        className="h-14 min-h-14 max-h-14 px-3.5 py-3 text-sm text-foreground bg-transparent placeholder-zinc-500"
                        disabled={isGenerating}
                      />
                      <InputGroupAddon align="block-end" className="pt-2 px-1">
                        <InputGroupButton
                          type="submit"
                          variant="default"
                          size="icon-sm"
                          disabled={!input.trim() || isGenerating}
                          className="ml-auto rounded-full size-8 bg-blue-600 hover:bg-blue-500! text-white! disabled:bg-zinc-800/80! disabled:text-zinc-500! transition-colors p-0 flex items-center justify-center border-0"
                        >
                          <ArrowUpIcon className="size-4 stroke-[3px]" />
                          <span className="sr-only">Send</span>
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </form>
                </CardFooter>
              </>
            )}
          </Card>
        )}
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <MessageScrollerProvider autoScroll scrollPreviousItemPeek={48}>
      <ChatClient />
    </MessageScrollerProvider>
  )
}
