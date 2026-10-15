# Security model

| Threat | Mitigation | Where |
|---|---|---|
| Account ids exposed through the board | Each row carries only `sha256("forge-board:" + id)` truncated to 16 hex characters | `handleLeaderboard` |
| Board scraping or flooding | 120 requests per minute per IP, fixed window in D1 | `rateLimit` |
| Score spam | 60 submissions per hour per IP | `app/api/score` |
| Impossible runs | Score, level, bosses and kills are checked against run length; rejects are logged | `plausibleRun`, `security_events` |
| Unbounded queries | `limit` capped at 500 on the server | `handleLeaderboard` |
| XSS | Strict CSP (`script-src 'self'`, no inline scripts); names are rendered as text | `public/_headers`, `leaderboard.js` |
| Clickjacking and sniffing | `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS | `public/_headers`, `json()` |
| Fake players passed off as real | Demo profiles are generated client-side, always tagged DEMO, never stored | `leaderboard.js` |

## Known gaps
- **Client-side scoring.** A plausible forged run passes. The fix is to replay each run on the server from its seed and input log.
- **Edge protection.** Bot and DDoS protection needs Cloudflare WAF or Turnstile.

## Tests
`node apps/arcade/scripts/test-forge-server.mjs` runs 16 checks against the real migrations on SQLite: ranking, change and "new" flags, the "you" row, no id leaks, stable keys, search, the limit cap, security headers, rate limiting, plausibility and the security log.
