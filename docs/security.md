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
| Score fraud | One-time run ticket issued at launch: a run is accepted only if its ticket is at least as old as the run (5 s slack), unused, and under 3 h old. Plausibility envelope (score, level, bosses and kills against duration); 60 runs per hour per IP; every reject logged with its reason | `handleRunStart`, `handleScore`, `security_events` |
| Economy abuse | Server-side prices; atomic buy with no double purchase; prototype keys rejected; welcome grant paid once; referral paid once, only for a first run of at least 60 s and never between pilots that signed up from the same network; per-player action, raid-room and strike limits; special modes (hardcore, raids) never reach the shared board | `lib/arena.ts`, `game.js` |
| Lost or stolen access | One-time recovery codes (20 chars from a 31-letter alphabet, about 99 bits, rejection-sampled), stored only as a hash and spent atomically; brute force capped at 10 tries per hour per IP and logged; at most 5 active sessions per pilot, the oldest is signed out | `lib/session.ts` |
| Persistent abusers | Rejections an honest browser rarely produces (forged runs, cross-site or malformed writes, failed recovery codes, flooding) count as strikes; 40 in 10 minutes blocks that IP's API access for 30 minutes and is logged. Board polling never counts | `server.mjs` |
| Raid snooping | Only members can read a raid room | `handleRaid` |
| Account ids exposed through the board | Rows carry only a truncated `sha256("forge-board:" + id)` | `handleLeaderboard` |
| Flooding | In-memory per-IP limits before any database work (1200 requests/min overall, 300/min to the API) plus per-route limits; the board ranking is computed at most once per 5 s | `server.mjs`, `rateLimit`, `rankedBoard` |
| XSS, clickjacking, sniffing | Strict CSP (`script-src 'self'`, no inline scripts), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, COOP and CORP, Permissions-Policy, HSTS | `server.mjs` |
| Path traversal and file disclosure | Decoded path must resolve inside `public/`; dotfiles, `_headers`, NUL bytes and broken encodings are refused | `staticFile` |
| Host-header attacks | Only `ALLOWED_HOSTS` are served (421 otherwise) | `server.mjs` |
| Slow-loris and huge bodies | Header timeout 15 s and request timeout 30 s; Caddy also caps bodies at 64 KB and enforces read timeouts | `server.mjs`, Caddyfile |

## Infrastructure
- **TLS:** Caddy obtains and renews Let's Encrypt certificates and redirects HTTP to HTTPS and `www` to the apex domain. Caddy also runs read-only, with all capabilities dropped except binding ports 80 and 443.
- **Disclosure:** `/.well-known/security.txt` publishes `SECURITY_CONTACT`.
- **App container:**
  - runs as non-root (uid 1000) on a read-only root filesystem, with `/tmp` as a `noexec,nosuid,nodev` tmpfs;
  - all capabilities dropped, `no-new-privileges`;
  - memory and PID limits;
  - on an internal network with no route to the internet and no published port.
- **Host** (`infra/setup-ubuntu.sh`):
  - ufw allows only SSH, 80 and 443;
  - fail2ban guards SSH;
  - unattended security upgrades are on;
  - kernel network hardening is on (SYN cookies, reverse-path filtering, no ICMP redirects or source routing);
  - Docker runs with log rotation, `no-new-privileges` by default and no inter-container traffic on the default bridge;
  - optionally, key-only SSH with no root login.
- **Data:**
  - SQLite in WAL mode;
  - an online `VACUUM INTO` backup daily, keeping 14;
  - `infra/backup-download.sh` copies them off the server;
  - hourly cleanup of expired sessions, old rate-limit rows, security events older than 90 days and raids older than 7 days.

## Known gaps
- **Client-side scoring.** Someone who really plays for N seconds can still inflate that run's score up to the plausibility ceiling for N seconds. The fix is to replay each run on the server from its seed and input log.
- **Volumetric DDoS.** Needs edge protection, such as the Cloudflare proxy (see DEPLOY.md) or the hosting provider's own.
- **Recovery depends on the player.** A pilot who never saved a recovery code and clears the browser loses access.
- **Shared networks.** Per-IP limits and blocks apply to everyone behind one address (offices, mobile carrier NAT).

## Tests
- `node apps/arcade/scripts/test-forge-server.mjs` runs 16 board checks against the real migrations.
- `node apps/arcade/scripts/test-server-http.mjs` runs 59 end-to-end checks against the real server:
  - headers and caching;
  - traversal and Host attacks;
  - forged identity headers and cookies;
  - CSRF, content-type, size and JSON checks;
  - reserved and duplicate callsigns;
  - token hashing;
  - shop and grant rules;
  - run checks, run tickets (missing, invented, reused, faster than real time) and the security log;
  - raid privacy and same-network referrals;
  - recovery codes (format, hashing, single use, wrong codes) and the session cap;
  - security.txt and the automatic ban;
  - board privacy;
  - sign-up flood limits, including spoofed X-Forwarded-For;
  - sign-out revocation;
  - backups.
