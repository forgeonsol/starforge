# Security model

Applies to the self-hosted deployment (`apps/arcade/server` + `infra/`).

## Application
| Threat | Mitigation | Where |
|---|---|---|
| Session theft or forgery | Random 256-bit token in a `__Host-forge_sid` cookie (HttpOnly, Secure, SameSite=Lax, Path=/). Only `sha256` of the token is stored; sessions slide over 180 days and can be revoked | `lib/session.ts` |
| Impersonation through headers | `oai-*`, `cf-connecting-ip`, `x-real-ip` and `forwarded` are stripped; identity comes only from the session cookie | `server/server.mjs` |
| CSRF | Every write needs a matching `Origin`, `Content-Type: application/json` and a body of at most 8 KB (16 KB at the socket) | `readWriteBody`, `server.mjs` |
| Account farming | 5 new pilots per hour and 20 per day per IP; the real IP comes from Caddy, not from the client | `handleSessionCreate`, Caddyfile |
| Name squatting and impersonation of staff | Case-insensitive unique callsigns; staff-like names are reserved | `callsignProblem` |
| Score fraud | Plausibility envelope (score, level, bosses and kills against duration); runs can't arrive faster than they can be played; 60 runs per hour per IP; rejects are logged | `handleScore`, `security_events` |
| Economy abuse | Server-side prices; atomic buy with no double purchase; prototype keys rejected; welcome grant paid once; referral paid once, only for a first run of at least 60 s; per-player action, raid-room and strike limits | `lib/arena.ts` |
| Account ids exposed through the board | Rows carry only a truncated `sha256("forge-board:" + id)` | `handleLeaderboard` |
| Flooding | In-memory per-IP limits before any database work (1200 requests/min overall, 300/min to the API) plus D1-style limits per route | `server.mjs`, `rateLimit` |
| XSS, clickjacking, sniffing | Strict CSP (`script-src 'self'`, no inline scripts), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, COOP and CORP, Permissions-Policy, HSTS | `server.mjs` |
| Path traversal and file disclosure | Decoded path must resolve inside `public/`; dotfiles, `_headers`, NUL bytes and broken encodings are refused | `staticFile` |
| Host-header attacks | Only `ALLOWED_HOSTS` are served (421 otherwise) | `server.mjs` |
| Slow-loris and huge bodies | Header timeout 15 s and request timeout 30 s; Caddy also caps bodies at 64 KB and enforces read timeouts | `server.mjs`, Caddyfile |

## Infrastructure
- **TLS:** Caddy obtains and renews Let's Encrypt certificates and redirects HTTP to HTTPS and `www` to the apex domain.
- **App container:**
  - runs as non-root (uid 1000) on a read-only root filesystem, with `/tmp` as tmpfs;
  - all capabilities dropped, `no-new-privileges`;
  - memory and PID limits;
  - on an internal network with no route to the internet and no published port.
- **Host** (`infra/setup-ubuntu.sh`):
  - ufw allows only SSH, 80 and 443;
  - fail2ban guards SSH;
  - unattended security upgrades are on;
  - Docker log rotation is on;
  - optionally, key-only SSH with no root login.
- **Data:**
  - SQLite in WAL mode;
  - an online `VACUUM INTO` backup daily, keeping 14;
  - `infra/backup-download.sh` copies them off the server;
  - hourly cleanup of expired sessions, old rate-limit rows, security events older than 90 days and raids older than 7 days.

## Known gaps
- **Client-side scoring.** A plausible forged run passes. The fix is to replay each run on the server from its seed and input log.
- **Volumetric DDoS.** Needs edge protection, such as the Cloudflare proxy (see DEPLOY.md) or the hosting provider's own.
- **Browser-bound accounts.** A cleared cookie loses access to that pilot. Recovery codes or e-mail login would fix this.

## Tests
- `node apps/arcade/scripts/test-forge-server.mjs` runs 16 board checks against the real migrations.
- `node apps/arcade/scripts/test-server-http.mjs` runs 39 end-to-end checks against the real server:
  - headers and caching;
  - traversal and Host attacks;
  - forged identity headers and cookies;
  - CSRF, content-type, size and JSON checks;
  - reserved and duplicate callsigns;
  - token hashing;
  - shop and grant rules;
  - run checks and the security log;
  - board privacy;
  - sign-up flood limits, including spoofed X-Forwarded-For;
  - sign-out revocation;
  - backups.
