#!/usr/bin/env bash
# Update the running site to the latest code:  bash infra/deploy.sh
# Takes a database backup first, rebuilds the app, restarts with zero config changes, and checks health.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "infra/.env is missing: cp .env.example .env and fill it in"; exit 1; }

if docker compose ps --status running --services 2>/dev/null | grep -q '^app$'; then
  echo "==> backup before update"
  docker compose exec -T app node --disable-warning=ExperimentalWarning -e \
    "import('/app/server/sqlite-d1.mjs').then(m=>console.log(m.backup(m.openDb('/data/forge.db'),'/data/backups',Number(process.env.BACKUP_KEEP||14))))"
fi

echo "==> pull code"
git -C .. pull --ff-only

echo "==> build and restart"
docker compose build app
docker compose up -d

echo "==> wait for health"
for i in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)")" = "healthy" ]; then
    echo "app is healthy"; docker image prune -f >/dev/null; exit 0
  fi
  sleep 2
done
echo "!! app did not become healthy; recent logs:"; docker compose logs --tail 50 app; exit 1
