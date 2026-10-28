# Contributing

The source is published for review; contributions are by invitation. If you were invited:

1. Branch from `main`. Keep each pull request to one change.
2. Run the checks before you push:
   ```bash
   cd apps/arcade
   node scripts/test-forge-server.mjs
   node scripts/test-server-http.mjs
   for f in public/*.js; do node --check "$f"; done
   ```
3. Keep the CSP intact: no inline `<script>` blocks and no inline event handlers.
4. Never present simulated data as real: the leaderboard lists real players only, and in-game AI rivals are named as AI.
5. Never commit secrets, `.env` files, `.wrangler/` or `.sites-runtime/`.
