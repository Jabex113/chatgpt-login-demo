# Security Policy

## Supported versions

This demo is early-stage. Security fixes should target the current `main` branch unless maintainers decide to cut releases.

## Reporting a vulnerability

Please do not open a public issue with working token theft steps, live account data, private cookies, or provider responses that include sensitive details.

If GitHub private vulnerability reporting is enabled for this repository, use that. Otherwise, report privately to the repository owner or maintainers. If a public security contact is added later, update this file before promoting the repo more widely.

## Security notes

- OAuth access and refresh tokens are kept server-side behind an HTTP-only session cookie.
- The browser receives only non-token account/session metadata.
- The local server keeps token sessions in memory. That is enough for a local demo, but production use should replace it with an encrypted durable store.
- The Codex OAuth flow used here is unsupported by OpenAI. Treat provider behavior as subject to change.
