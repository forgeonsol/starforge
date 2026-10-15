// Local integration server: serves a static site folder and routes /api/* to lib/forge-server.ts on SQLite.
// Usage: node scripts/dev-forge-server.mjs <site-dir> [port]   (online-config.js is served as online)
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "../lib/forge-server.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const site = process.argv[2], port = Number(process.argv[3] || 8790);
const sqlite = new DatabaseSync(process.env.FORGE_DB || ":memory:");
const migrated = sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'wallet_accounts'").get();
if (!migrated) for (const f of readdirSync(root + "drizzle").filter((f) => f.endsWith(".sql")).sort())
  for (const stmt of readFileSync(root + "drizzle/" + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) sqlite.exec(stmt);
const db = {
  prepare(sql) { let args = []; const st = {
    bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return st; },
    async first() { return sqlite.prepare(sql).get(...args) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async run() { if (/\bRETURNING\b/i.test(sql)) { const r = sqlite.prepare(sql).all(...args); return { results: r, meta: { changes: r.length } }; } const r = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    _exec() { return /\bRETURNING\b/i.test(sql) ? sqlite.prepare(sql).all(...args) : sqlite.prepare(sql).run(...args); } }; return st; },
  async batch(list) { sqlite.exec("BEGIN"); try { const o = list.map((s) => s._exec()); sqlite.exec("COMMIT"); return o; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
};
// dev only: a "dev_user" cookie stands in for the signed-in player; a few sample players are seeded
const devUser = (req) => (/(?:^|;\s*)dev_user=([\w-]+)/.exec(req.headers.cookie || "") || [])[1] || null;
if (!sqlite.prepare("SELECT COUNT(*) AS n FROM players").get().n && process.env.FORGE_SEED !== "0") {
  const today = new Date().toISOString().slice(0, 10), yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  for (const [id, cs, y, t] of [["dev-1", "NIGHTDRIFTER", 8000, 21500], ["dev-2", "ANA_SOL", 17800, null], ["dev-3", "KAITO", 9000, 9400], ["dev-me", "ROOKIE", null, 14250]]) {
    sqlite.prepare("INSERT INTO players (id, callsign, referral_code) VALUES (?, ?, ?)").run(id, cs, id);
    if (y != null) sqlite.prepare("INSERT INTO arena_scores (player_id, day_key, score, duration_seconds, level, bosses_defeated) VALUES (?,?,?,?,?,?)").run(id, yday, y, 150, 4, 3);
    if (t != null) sqlite.prepare("INSERT INTO arena_scores (player_id, day_key, score, duration_seconds, level, bosses_defeated) VALUES (?,?,?,?,?,?)").run(id, today, t, 150, 4, 3);
  }
}
const ROUTES = { "GET /api/leaderboard": (request, d, req) => S.handleLeaderboard(request, d, devUser(req)) };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const handler = ROUTES[`${req.method} ${url.pathname}`];
  if (handler) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    const request = new Request(url, { method: req.method, headers, body: req.method === "GET" ? undefined : Buffer.concat(chunks) });
    const out = await handler(request, db, req);
    res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer())); return;
  }
  if (url.pathname === "/online-config.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); res.end("window.FORGE_ONLINE = true;"); return; }
  if (url.pathname.startsWith("/api/")) { res.writeHead(404, { "Content-Type": "application/json" }); res.end('{"error":"not here"}'); return; }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ""); if (p.endsWith("/")) p += "index.html";
  const file = join(site, p);
  if (!file.startsWith(site) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }); res.end(readFileSync(file));
}).listen(port, "127.0.0.1", () => console.log(`forge dev server on http://127.0.0.1:${port}`));
