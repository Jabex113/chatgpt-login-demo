# Contributing

Thanks for taking a look at this project.

This repo is a small Next.js demo for the ChatGPT Codex OAuth flow and a local chat client. Keep changes focused on that purpose. Avoid broad rewrites, visual redesigns, or unrelated framework changes unless an issue clearly calls for them.

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:1455`.

Before opening a pull request, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Pull requests

Good pull requests usually include:

- A short explanation of the problem.
- The smallest practical fix.
- Any manual test notes, especially around OAuth callback and chat streaming.
- No committed `.env` files, tokens, cookies, screenshots with account details, or copied provider responses that include private data.

## Scope

This project intentionally uses an unsupported Codex OAuth flow. Contributions should make that flow easier to understand, safer to run locally, or easier to adapt into a real backend session model. Do not present it as an official OpenAI integration.
