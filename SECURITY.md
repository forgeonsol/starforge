# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.
Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it and what an attacker could do with it. We aim to reply within 72 hours.

## In scope
- The score and leaderboard APIs (`apps/arcade/app/api`, `apps/arcade/lib/forge-server.ts`)
- Anything that lets one player change another player's data, or exposes account ids
- Bypasses of the rate limits or the run plausibility checks
- XSS or CSP bypasses on the landing or the arena

## Out of scope
- Submitting a forged run that stays within the plausibility envelope. This is a known limitation (see the README).
- Volumetric DDoS. It is handled at the edge.
- Anything about the $FORGE token. The token has not launched.
