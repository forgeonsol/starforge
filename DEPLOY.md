# Deploying

The deployable app is `apps/arcade`: Next.js on vinext, built for Cloudflare Workers with a D1 database bound as `DB`.

## 1. Build
```bash
cd apps/arcade
corepack pnpm install
corepack pnpm build
```

## 2. Database
Apply every migration in `apps/arcade/drizzle/` in order, the same way as the earlier ones. The latest is `0005_board_security.sql`, which adds:
- `rate_limits`
- `security_events` (with an index)
- the `arena_scores_player` index

Before the next `pnpm db:generate`, run `drizzle-kit generate` once and check that it doesn't duplicate tables: the drizzle snapshot for 0005 was not generated.

## 3. Online switch
`public/online-config.js` sets `window.FORGE_ONLINE`:
- `true` on the real deployment, so the leaderboard calls the API;
- `false` on a static preview, which shows demo profiles plus the visitor's best run on that device.

## 4. Headers
`public/_headers` sets the CSP, HSTS, frame, referrer and permissions policies, plus cache rules (`/assets` immutable, HTML not cached). It uses the Cloudflare static-assets format. On another host, set the same headers there.

## 5. Token launch
Fill in `public/token-config.js` with the contract address and links at launch. Until then, every buy and chart control shows "soon".
