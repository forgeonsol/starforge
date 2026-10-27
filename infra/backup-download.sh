#!/usr/bin/env bash
# Copy the newest database backup off the server. Run on YOUR computer:
#   bash infra/backup-download.sh forge@203.0.113.10 ~/starforge-backups
# Backups inside the server's volume do not survive the loss of the server itself, so pull one regularly.
set -euo pipefail
HOST="${1:?usage: backup-download.sh user@server [local-dir]}"
DEST="${2:-./backups}"
REPO="${REPO_DIR:-starforge}"
mkdir -p "$DEST"
FILE=$(ssh "$HOST" "cd $REPO/infra && docker compose exec -T app node -e \"const f=require('fs');const l=f.readdirSync('/data/backups').filter(x=>x.endsWith('.db')).sort();console.log(l[l.length-1]||'')\"")
[ -n "$FILE" ] || { echo "no backups on the server yet"; exit 1; }
ssh "$HOST" "cd $REPO/infra && docker compose exec -T app node -e \"process.stdout.write(require('fs').readFileSync('/data/backups/$FILE'))\"" > "$DEST/$FILE"
echo "saved $DEST/$FILE ($(du -h "$DEST/$FILE" | cut -f1))"
