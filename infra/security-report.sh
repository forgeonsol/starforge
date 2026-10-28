#!/usr/bin/env bash
# What the server has refused lately:  bash infra/security-report.sh [hours]   (default 24)
set -euo pipefail
cd "$(dirname "$0")"
HOURS="${1:-24}"
case "$HOURS" in (*[!0-9]*|'') echo "hours must be a number"; exit 1 ;; esac
docker compose exec -T -e HOURS="$HOURS" app node --disable-warning=ExperimentalWarning -e '
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("/data/forge.db", { readOnly: true });
const hours = Number(process.env.HOURS), now = Math.floor(Date.now() / 1000), since = now - hours * 3600;
console.log(`Security events, last ${hours} h`);
console.table(db.prepare("SELECT kind, COUNT(*) AS events, COUNT(DISTINCT subject) AS sources FROM security_events WHERE created_at >= ? GROUP BY kind ORDER BY events DESC").all(since));
console.log("Most frequent sources (pilot id or IP)");
console.table(db.prepare("SELECT subject, COUNT(*) AS events, GROUP_CONCAT(DISTINCT kind) AS kinds FROM security_events WHERE created_at >= ? GROUP BY subject ORDER BY events DESC LIMIT 10").all(since));
console.log("Blocked IPs");
console.table(db.prepare("SELECT subject AS ip, datetime(created_at, ?) AS blocked_at FROM security_events WHERE kind = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 20").all("unixepoch", "ip_banned", since));
console.log("Pilots:", db.prepare("SELECT COUNT(*) AS n FROM players").get().n, "· active sessions:", db.prepare("SELECT COUNT(*) AS n FROM player_sessions WHERE expires_at > ?").get(now).n);
'
