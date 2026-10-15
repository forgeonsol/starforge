// Checks for lib/forge-server.ts: real migrations on SQLite, the live board and its protections.
// Run: node scripts/test-forge-server.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as S from "../lib/forge-server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const sqlite = new DatabaseSync(":memory:");
for (const f of readdirSync(root + "drizzle").filter((f) => f.endsWith(".sql")).sort())
  for (const stmt of readFileSync(root + "drizzle/" + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) sqlite.exec(stmt);

// minimal D1 facade
const db = {
  prepare(sql) {
    let args = [];
    const st = {
      bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return st; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async run() { if (/\bRETURNING\b/i.test(sql)) { const r = sqlite.prepare(sql).all(...args); return { results: r, meta: { changes: r.length } }; } const r = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
      _exec() { return /\bRETURNING\b/i.test(sql) ? sqlite.prepare(sql).all(...args) : sqlite.prepare(sql).run(...args); },
    };
    return st;
  },
  async batch(list) { sqlite.exec("BEGIN"); try { const out = list.map((s) => s._exec()); sqlite.exec("COMMIT"); return out; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
};

let pass = 0, failN = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log("  ✓", name); } else { failN++; console.log("  ✗", name); } };
const req = (path, ip = "10.0.0.1") => new Request("https://forge.example" + path, { headers: { "cf-connecting-ip": ip } });
const body = async (r) => r.clone().json();

const today = new Date().toISOString().slice(0, 10), yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const player = (id, callsign) => sqlite.prepare("INSERT INTO players (id, callsign, referral_code) VALUES (?, ?, ?)").run(id, callsign, id.slice(-6));
const score = (id, day, s) => sqlite.prepare("INSERT INTO arena_scores (player_id, day_key, score, duration_seconds, level, bosses_defeated) VALUES (?,?,?,?,?,?)").run(id, day, s, 150, 4, 3);
player("user-aaa", "NIGHTDRIFTER"); player("user-bbb", "ANA_SOL"); player("user-ccc", "KAITO"); player("user-ddd", "NEWCOMER");
score("user-aaa", yday, 8000); score("user-aaa", today, 21500);
score("user-bbb", yday, 17800);
score("user-ccc", yday, 9000); score("user-ccc", today, 9400);
score("user-ddd", today, 12000);

console.log("\nleaderboard");
const lb = await body(await S.handleLeaderboard(req("/api/leaderboard?limit=10"), db, "user-bbb"));
console.log("   ", lb.rows.map((r) => `#${r.rank} ${r.name} ${r.score} (${r.change == null ? "new" : r.change > 0 ? "+" + r.change : r.change})${r.isYou ? " you" : ""}`).join(" | "));
ok(lb.rows.map((r) => r.name).join(",") === "NIGHTDRIFTER,ANA_SOL,NEWCOMER,KAITO", "players are ranked by their best run across days");
ok(lb.rows[0].change === 2 && lb.rows[1].change === -1 && lb.rows[3].change === -2, "rank change is computed against yesterday's standings");
ok(lb.rows[2].change === null, "players new today are flagged as new");
ok(lb.rows.filter((r) => r.isYou).length === 1 && lb.rows[1].isYou, "only the signed-in player's row is marked as theirs");
ok(!JSON.stringify(lb).includes("user-"), "account ids never leave the server (rows carry an opaque key)");
ok(new Set(lb.rows.map((r) => r.key)).size === lb.rows.length && lb.rows.every((r) => /^[0-9a-f]{16}$/.test(r.key)), "every row has a stable opaque key");
const again = await body(await S.handleLeaderboard(req("/api/leaderboard"), db, null));
ok(again.rows[0].key === lb.rows[0].key && again.rows.every((r) => !r.isYou), "keys are stable between requests; anonymous viewers have no 'you' row");
const q = await body(await S.handleLeaderboard(req("/api/leaderboard?q=ana"), db));
ok(q.rows.length === 1 && q.rows[0].name === "ANA_SOL", "search by name works");
const wk = await body(await S.handleLeaderboard(req("/api/leaderboard?scope=week&limit=2"), db));
ok(wk.scope === "week" && wk.rows.length <= 2, "scope and limit are honoured");
const big = await body(await S.handleLeaderboard(req("/api/leaderboard?limit=999999"), db));
ok(big.rows.length <= 500, "limit is capped server-side");
const hdr = (await S.handleLeaderboard(req("/api/leaderboard"), db)).headers;
ok(hdr.get("x-content-type-options") === "nosniff" && /max-age/.test(hdr.get("strict-transport-security") || "") && hdr.get("cache-control") === "no-store", "responses carry security headers");
let limited = false; for (let i = 0; i < 130; i++) { const r = await S.handleLeaderboard(req("/api/leaderboard", "10.9.9.9"), db); if (r.status === 429) { limited = true; break; } }
ok(limited, "the board endpoint is rate limited per IP");

console.log("\nrun checks");
ok(S.plausibleRun({ score: 19800, duration: 150, level: 4, bossesDefeated: 3, kills: 210 }), "a normal run passes the plausibility envelope");
ok(!S.plausibleRun({ score: 400000, duration: 30, level: 1, bossesDefeated: 0, kills: 1 }), "an impossible score for the run length fails");
ok(!S.plausibleRun({ score: 5000, duration: 60, level: 9, bossesDefeated: 0, kills: 10 }), "an impossible level for the run length fails");
await S.logSecurity(db, "implausible_run", "user-x", "{}");
ok(sqlite.prepare("SELECT COUNT(*) AS n FROM security_events").get().n === 1, "rejected runs are written to security_events");

console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
