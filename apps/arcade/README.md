# apps/arcade

The deployable Starforge app: landing, arena and leaderboard (static files in `public/`) plus the score and leaderboard API, on Next.js/vinext for Cloudflare Workers + D1.

| Path | What |
|---|---|
| `public/index.html`, `landing.js` | landing page |
| `public/game.html`, `game.js` | the arena |
| `public/leaderboard.js`, `leaderboard.css` | live board shared by both pages |
| `app/api/*/route.ts` | thin route wrappers |
| `lib/forge-server.ts` | server core: ranking, rate limits, plausibility, headers |
| `db/schema.ts`, `drizzle/` | schema and migrations |
| `scripts/dev-forge-server.mjs` | local server with in-memory SQLite |
| `scripts/test-forge-server.mjs` | server tests |

`TOOLING.md` documents the starter's build tooling. Setup and deployment are in the root [README](../../README.md) and [DEPLOY.md](../../DEPLOY.md).
