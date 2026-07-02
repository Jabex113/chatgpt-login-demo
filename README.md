# ChatGPT Codex OAuth Login Demo

A small Next.js app that signs a user in with the ChatGPT Codex OAuth flow, stores the resulting session on the local server, and streams chat responses through an App Router API route.

The goal is narrow: make the OAuth handoff and streaming chat path easy to inspect, run, and adapt. It is not an official OpenAI integration, and it should not be presented as one.

Live preview: https://chatgpt-login-demo.vercel.app

The Vercel deployment is configured to start the same Codex OAuth flow using:

```text
https://chatgpt-login-demo.vercel.app/auth/callback
```

If OpenAI rejects that callback, it is an OAuth client allowlist issue, not a
shared-account issue in this app. The local callback remains the most reliable
way to inspect the flow.

## What this does

- Starts a ChatGPT sign-in flow with PKCE.
- Handles the OAuth callback at `/auth/callback`.
- Exchanges the authorization code through `/api/token`.
- Stores OAuth tokens server-side behind an HTTP-only session cookie.
- Streams chat responses through `/api/chat`.
- Keeps the UI as a compact shadcn-style chat surface.

## What this does not do

- It does not use an official public OpenAI OAuth app.
- It does not include a durable production session store.
- It does not publish an npm package.
- It does not expose access or refresh tokens in the browser UI.

## Requirements

- Node.js 22 or newer.
- pnpm.
- A ChatGPT account that is allowed to use the Codex flow.

When `NEXT_PUBLIC_CHATGPT_REDIRECT_URI` is unset, local runs use the current localhost origin plus `/auth/callback`. That is:

```text
http://localhost:1455/auth/callback
```

Hosted deployments should set `NEXT_PUBLIC_CHATGPT_REDIRECT_URI` to the exact
callback URL for that deployment.

## Quick Start

From this app directory:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open:

```text
http://localhost:1455
```

Then click `Continue with ChatGPT`.

If you are running from the monorepo root instead:

```bash
pnpm install
pnpm --filter @jinbal/chatgpt-login-demo dev
```

## Environment

`.env.example` contains the public values used by the local demo:

```bash
NEXT_PUBLIC_OPENAI_CODEX_CLIENT_ID=app_EMoamEEZ73f0CkXaXp7hrann
NEXT_PUBLIC_OPENAI_CODEX_ORIGINATOR="Codex Desktop"
# Optional. If unset, the current origin is used.
# NEXT_PUBLIC_CHATGPT_REDIRECT_URI=http://localhost:1455/auth/callback
```

These values are public client-side configuration, not secrets. Do not commit real secrets, cookies, copied provider responses, or session dumps.

## Adapting this demo

If you copy this into another site, keep the callback URL exact. Local testing
can use `http://localhost:1455/auth/callback`; hosted deployments need a
callback URL accepted by the OAuth client. If OpenAI rejects a hosted callback,
that cannot be fixed with a shared-account change in this app.

## Security Model

The browser receives only non-token account/session metadata. Access and refresh tokens are kept in a server-side in-memory store and are referenced by an HTTP-only, SameSite=Lax cookie.

Each browser gets its own random session cookie, so normal use should not let one visitor see another visitor's connected account. That said, this is still a demo-grade session model. For production, replace the in-memory store with an encrypted durable store, add CSRF review for state-changing routes, and review deployment-specific cookie settings.

The Codex OAuth behavior used here is unsupported and can change without notice.

## Project Structure

```text
src/app/page.tsx                 Chat UI and OAuth start button
src/app/auth/callback/page.tsx   OAuth callback page
src/app/api/token/route.ts       Authorization code exchange
src/app/api/session/route.ts     Session read and logout
src/app/api/chat/route.ts        Server-side chat streaming proxy
src/lib/auth.ts                  PKCE helpers and public OAuth config
src/lib/server-session.ts        Local server-side session store
```

## Scripts

```bash
pnpm dev        # run on http://localhost:1455
pnpm lint       # run ESLint
pnpm typecheck  # run TypeScript without emitting files
pnpm build      # create a production build
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Keep changes focused on this demo's purpose: OAuth handoff, safer local session handling, and streaming chat.

## Security

See [SECURITY.md](./SECURITY.md). Do not report token theft steps or account data in public issues.

## License

MIT. See [LICENSE](./LICENSE).
