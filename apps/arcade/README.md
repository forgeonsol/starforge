# apps/arcade

The Starforge app: landing, arena and leaderboard (static files in `public/`) plus the arena API.

- **Production (VPS):** `server/server.mjs` — Node 22 + SQLite, in Docker behind Caddy. See [DEPLOY.md](../../DEPLOY.md).
- **Original host:** the Next.js/vinext files (`app/`, `db/`) still build for Cloudflare Workers + D1 with the host's ChatGPT sign-in. Both paths share `lib/`.

| Path | What |
|---|---|
| `public/index.html`, `landing.js` | landing page |
| `public/game.html`, `game.js` | the arena |
| `public/leaderboard.js`, `leaderboard.css` | live board shared by both pages |
| `app/api/*/route.ts` | thin route wrappers (original host only) |
| `lib/arena.ts` | profile, shop, raids, run submission |
| `lib/session.ts` | sign-in without registration (session cookie) |
| `lib/forge-server.ts` | server core: ranking, rate limits, plausibility, headers |
| `db/schema.ts`, `drizzle/` | schema and migrations |
| `server/server.mjs` | self-hosted production server (Node 22 + SQLite, no npm deps) |
| `Dockerfile` | the production image |
| `scripts/test-server-http.mjs` | end-to-end security tests against the real server |
| `scripts/test-forge-server.mjs` | server tests |

`TOOLING.md` documents the starter's build tooling. Setup and deployment are in the root [README](../../README.md) and [DEPLOY.md](../../DEPLOY.md).
