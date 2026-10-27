# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.
Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it and what an attacker could do with it. We aim to reply within 72 hours.

## In scope
- The self-hosted server and its API (`apps/arcade/server`, `apps/arcade/lib`)
- Session handling: stealing, forging or fixing another player's session
- Anything that lets one player change another player's data, or exposes account ids
- Bypasses of the rate limits or the run plausibility checks
- XSS or CSP bypasses on the landing or the arena
- Container or reverse-proxy configuration (`infra/`, `apps/arcade/Dockerfile`)

## Out of scope
- Submitting a forged run that stays within the plausibility envelope. This is a known limitation (see the README).
- Volumetric DDoS. It is handled at the edge.
- Anything about the $FORGE token. The token has not launched.
