// End-to-end security checks for the self-hosted server: starts server/server.mjs on a temp database and
// attacks it over real HTTP.   Run: node scripts/test-server-http.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { backup, openDb } from "../server/sqlite-d1.mjs";

const APP = fileURLToPath(new URL("..", import.meta.url));
const DATA = mkdtempSync(join(tmpdir(), "forge-test-"));
const PORT = 3900 + Math.floor(Math.random() * 90);
const B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "server/server.mjs"], {
  cwd: APP, env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA, COOKIE_SECURE: "0", TRUST_PROXY: "0", ALLOWED_HOSTS: "127.0.0.1,localhost", BACKUP_HOURS: "0" },
  stdio: ["ignore", "pipe", "inherit"],
});
let logs = ""; srv.stdout.on("data", (c) => { logs += c; });
for (let i = 0; i < 50; i++) { try { if ((await fetch(B + "/healthz")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

let pass = 0, failN = 0;
const ok = (c, name) => { if (c) { pass++; console.log("  ✓", name); } else { failN++; console.log("  ✗", name); } };
const ORIGIN = B;
const post = (path, body, { cookie = "", origin = ORIGIN, type = "application/json", method = "POST", headers = {} } = {}) =>
  fetch(B + path, { method, headers: { ...(type ? { "Content-Type": type } : {}), ...(origin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (path, cookie = "", headers = {}) => fetch(B + path, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers }, redirect: "manual" });
const rawHost = (host) => new Promise((res) => http.get({ host: "127.0.0.1", port: PORT, path: "/index.html", headers: { Host: host } }, (r) => { r.resume(); res(r.statusCode); }));

try {
  console.log("\nstatic files");
  const idx = await get("/index.html");
  ok(idx.status === 200, "landing is served");
  const csp = idx.headers.get("content-security-policy") || "";
  ok(/script-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && idx.headers.get("x-frame-options") === "DENY" && idx.headers.get("x-content-type-options") === "nosniff", "pages carry CSP, frame and sniffing protection");
  ok(idx.headers.get("cache-control") === "no-cache", "HTML is revalidated on every visit");
  const etag = idx.headers.get("etag");
  ok((await get("/index.html", "", { "If-None-Match": etag })).status === 304, "unchanged files answer 304 (ETag)");
  const asset = readdirSync(join(APP, "public/assets"), { recursive: true }).find((f) => String(f).endsWith(".webp"));
  ok((await get("/assets/" + asset)).headers.get("cache-control")?.includes("immutable"), "assets are cached as immutable");
  ok((await get("/")).status === 302, "/ redirects to the landing");
  let traversal = true;
  for (const p of ["/../server/server.mjs", "/%2e%2e/package.json", "/..%2fpackage.json", "/%2e%2e%2f%2e%2e%2fetc/passwd", "/.env", "/.git/config", "/_headers", "/assets/%00x", "/%E0%A4%A"]) {
    const s = (await get(p)).status; if (s === 200) { traversal = false; console.log("     leaked", p); }
  }
  ok(traversal, "path traversal, dotfiles, _headers and broken encodings are refused");
  ok((await post("/index.html", {})).status === 405, "static files only answer GET/HEAD");
  ok((await rawHost("evil.example")) === 421 && (await rawHost("127.0.0.1")) === 200, "unknown Host headers are rejected");

  console.log("\nidentity");
  const isGuest = async (r) => { const b = await r.json(); return r.status === 200 && b.guest === true && b.player === null; };
  ok(await isGuest(await get("/api/profile")), "no session, no profile (the caller is a guest)");
  ok(await isGuest(await get("/api/profile", "", { "oai-authenticated-user-id": "victim", "oai-authenticated-user-email": "v@x.io" })), "spoofed hosting identity headers are ignored");
  ok(await isGuest(await get("/api/profile", "forge_sid=" + "A".repeat(43))), "a forged session cookie is ignored");

  console.log("\nsign-up without registration");
  ok((await post("/api/session", { callsign: "ACE" }, { origin: "" })).status === 403, "writes without Origin are refused (CSRF)");
  ok((await post("/api/session", { callsign: "ACE" }, { origin: "https://evil.example" })).status === 403, "writes from another site are refused (CSRF)");
  ok((await post("/api/session", "callsign=ACE", { type: "application/x-www-form-urlencoded" })).status === 415, "non-JSON writes are refused");
  ok((await post("/api/session", JSON.stringify({ callsign: "A".repeat(40000) }))).status === 413, "oversized bodies are refused");
  ok((await post("/api/session", "{bad json")).status === 400, "malformed JSON is refused");
  ok((await post("/api/session", { callsign: "ADMIN" })).status === 409, "reserved callsigns are refused");
  const s1 = await post("/api/session", { callsign: "Ace_1" });
  const setCookie = s1.headers.get("set-cookie") || "";
  ok(s1.status === 201 && /HttpOnly/.test(setCookie) && /SameSite=Lax/.test(setCookie) && /Max-Age=\d+/.test(setCookie), "a pilot is created with an HttpOnly, SameSite session cookie");
  const cookie = setCookie.split(";")[0];
  ok((await post("/api/session", { callsign: "ace_1" })).status === 409, "callsigns are unique regardless of case");
  const sqlite = new DatabaseSync(join(DATA, "forge.db"));
  const stored = sqlite.prepare("SELECT token_hash FROM player_sessions").all();
  ok(stored.length === 1 && !stored[0].token_hash.includes(cookie.split("=")[1]), "only a hash of the session token is stored");

  console.log("\nprofile and shop");
  const prof = await (await get("/api/profile", cookie)).json();
  ok(prof.player?.callsign === "ACE_1", "the session opens the pilot's profile");
  const w1 = await (await post("/api/profile", { action: "welcome" }, { cookie })).json();
  const w2 = await (await post("/api/profile", { action: "welcome" }, { cookie })).json();
  ok(w1.claimed === true && w2.claimed === false, "the welcome grant pays once");
  ok((await post("/api/profile", { action: "buy", item: "constructor" }, { cookie })).status === 400, "prototype keys are not catalog items");
  ok((await post("/api/profile", { action: "buy", item: "ion" }, { cookie })).status === 200, "a catalog item can be bought");
  ok((await post("/api/profile", { action: "buy", item: "ion" }, { cookie })).status === 402, "the same item cannot be bought twice");
  ok((await post("/api/profile", { action: "equip-skin", skinId: "skin-40" }, { cookie })).status === 403, "locked skins cannot be equipped");

  console.log("\nruns and board");
  ok((await post("/api/score", { score: 400000, duration: 30, level: 1, bossesDefeated: 0, kills: 1 }, { cookie })).status === 400, "an impossible run is rejected");
  ok(sqlite.prepare("SELECT COUNT(*) AS n FROM security_events WHERE kind = 'implausible_run'").get().n === 1, "the rejected run is in the security log");
  const sc = await post("/api/score", { callsign: "ADMIN", score: 15000, duration: 150, level: 4, bossesDefeated: 3, kills: 200 }, { cookie });
  const scBody = await sc.json();
  ok(sc.status === 201 && scBody.callsign === "ACE_1", "a valid run is saved, and a reserved callsign in it is ignored");
  ok((await post("/api/score", { score: 15100, duration: 150, level: 4, bossesDefeated: 3, kills: 200 }, { cookie })).status === 429, "runs posted faster than they can be played are refused");
  const board = await (await get("/api/leaderboard", cookie)).json();
  ok(board.rows.length === 1 && board.rows[0].name === "ACE_1" && board.rows[0].isYou, "the run is on the board as this player's row");
  ok(!JSON.stringify(board).includes("p_"), "no account id appears on the board");
  ok((await post("/api/score", { score: 100, duration: 60, level: 1, bossesDefeated: 0, kills: 5 })).status === 401, "runs need a session");

  console.log("\nflood limits");
  let created = 1, limited = false;
  for (let i = 0; i < 8; i++) { const r = await post("/api/session", { callsign: "BOT" + i }, { headers: { "X-Forwarded-For": `10.0.0.${i}` } }); if (r.status === 201) created++; if (r.status === 429) { limited = true; break; } }
  ok(limited && created <= 5, "new pilots per network are capped, and a spoofed X-Forwarded-For does not get around it");

  console.log("\nsign-out");
  const out = await post("/api/session", {}, { cookie, method: "DELETE" });
  ok(out.status === 200 && /Max-Age=0/.test(out.headers.get("set-cookie") || ""), "sign-out clears the cookie");
  ok(await isGuest(await get("/api/profile", cookie)), "and revokes the session on the server");

  console.log("\nbackups");
  const copy = backup(openDb(join(DATA, "forge.db")), join(DATA, "backups"), 2);
  const restored = new DatabaseSync(copy);
  ok(existsSync(copy) && restored.prepare("SELECT COUNT(*) AS n FROM players").get().n >= 1, "an online backup holds the data");
  ok(!/"level":"error"/.test(logs), "the server logged no errors");
} finally {
  srv.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 300));
  rmSync(DATA, { recursive: true, force: true });
}
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
