# Deploying to your own server

The production setup is two containers on one VPS:

- **app** — `apps/arcade/server/server.mjs`, Node 22 + SQLite, no npm dependencies. It serves the site and the API.
- **caddy** — gets and renews the HTTPS certificate on its own, compresses responses and forwards traffic to the app.

The app has no route to the internet and no published port; only Caddy talks to it. A Russian step-by-step guide is in [docs/ru/VPS-RU.md](docs/ru/VPS-RU.md).

## Requirements
- A VPS with Ubuntu 22.04 or 24.04: 1 vCPU, 1 GB RAM and 10 GB disk are enough to start.
- A domain whose `A` record (and `AAAA` record, if the server has IPv6) points at the server.
- Ports 80 and 443 open. Caddy needs port 80 to obtain the certificate.

## 1. Prepare the server (once)
```bash
ssh root@SERVER_IP
git clone https://github.com/OWNER/starforge.git && cd starforge
sudo bash infra/setup-ubuntu.sh --deploy-user forge
```
This sets up:
- the firewall: only SSH, 80 and 443 are open;
- fail2ban for SSH;
- automatic security updates;
- Docker with log rotation;
- a `forge` user that has your SSH keys.

Once you have checked that `ssh forge@SERVER_IP` works with your key, turn off root and password logins:
```bash
sudo bash infra/setup-ubuntu.sh --deploy-user forge --harden-ssh
```

## 2. Configure
```bash
cd infra
cp .env.example .env
nano .env            # DOMAIN=your-domain.com  ACME_EMAIL=you@example.com  SECURITY_CONTACT=mailto:you@example.com
```

## 3. Start
```bash
docker compose up -d --build
docker compose ps        # app should be "healthy"
docker compose logs -f   # Caddy logs "certificate obtained successfully"
```
Open `https://your-domain.com`. The database is created and migrated on first start.

## 4. Update
```bash
bash infra/deploy.sh
```
The script:
1. backs up the database;
2. pulls the code;
3. rebuilds the app;
4. restarts it;
5. waits until the app reports healthy.

## Backups
- The app writes a consistent copy of the database every 24 hours and keeps the latest 14 (`BACKUP_HOURS`, `BACKUP_KEEP`). Copies go to `/data/backups` inside the `forge-data` volume.
- These copies live on the same server, so pull one off it regularly from your own computer:
  ```bash
  bash infra/backup-download.sh forge@SERVER_IP ~/starforge-backups
  ```
- **Restore:**
  ```bash
  docker compose stop app
  docker run --rm -v starforge_forge-data:/data -v "$PWD":/in alpine \
    sh -c 'rm -f /data/forge.db-wal /data/forge.db-shm && cp /in/forge-XXXX.db /data/forge.db && chown 1000:1000 /data/forge.db'
  docker compose start app
  ```

## Useful commands
| Task | Command |
|---|---|
| status | `docker compose ps` |
| app logs | `docker compose logs -f app` |
| security report (refusals, blocked IPs) | `bash infra/security-report.sh 24` |
| raw security log | `docker compose exec app node -e "const {DatabaseSync}=require('node:sqlite');console.table(new DatabaseSync('/data/forge.db',{readOnly:true}).prepare('SELECT kind,subject,detail,datetime(created_at,\'unixepoch\') t FROM security_events ORDER BY id DESC LIMIT 30').all())"` |
| restart | `docker compose restart app` |
| stop everything | `docker compose down` (data stays in the volumes) |

## Behind Cloudflare
DNS-only mode (grey cloud) works with no changes. If you switch on the Cloudflare proxy (orange cloud), every request reaches Caddy from a Cloudflare address, and the per-IP limits would treat all visitors as one. In that case:
1. Set SSL/TLS mode to **Full (strict)**.
2. Tell Caddy to trust Cloudflare and read the real client IP. Add this inside the `servers { }` block of the Caddyfile:
   ```
   trusted_proxies static 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22 2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
   client_ip_headers CF-Connecting-IP
   ```
   Then remove the `header_up -Cf-Connecting-Ip` line. Check the current ranges at cloudflare.com/ips.

## Local run (no Docker)
```bash
cd apps/arcade
COOKIE_SECURE=0 DEV_SEED=1 node --experimental-strip-types server/server.mjs
# http://127.0.0.1:3000  (sample players on the board; data in apps/arcade/data)
```

## Token launch
At launch, fill in `apps/arcade/public/token-config.js` with the contract address and links, then run `bash infra/deploy.sh`. Until then, every buy and chart control shows "soon".

## The original host (Cloudflare build)
The Next.js/vinext files in `apps/arcade` still build for the host the project started on: `corepack pnpm install && corepack pnpm build`, with migrations applied to D1.

That build trusts the host's `oai-authenticated-*` sign-in headers. **Never deploy it anywhere else**, because anyone could forge those headers. The self-hosted server ignores them.
