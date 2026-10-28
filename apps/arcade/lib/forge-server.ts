/* $FORGE server core — the live leaderboard (plus shared helpers: rate limits, security log, headers).
 *
 * Framework-free on purpose: handlers take a standard Request plus a D1-compatible database and return a
 * Response, so the Next route files stay one-liners and the logic can be exercised in plain Node against
 * SQLite (see scripts/test-forge-server.mjs).
 *
 * Players are the existing signed-in accounts (players / arena_scores, written by /api/score after its
 * plausibility checks). The board never exposes account ids: each row carries an opaque hashed key and the
 * player's chosen callsign only.
 */

export type D1Result<T = Record<string, unknown>> = { results?: T[]; meta?: { changes?: number } };
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
  batch(statements: D1Stmt[]): Promise<D1Result[]>;
}

const MAX_RUN_SECONDS = 60 * 60;

// ------------------------------------------------------------------ small helpers
export const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();

function hex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256Hex(text: string): Promise<string> { return hex(await crypto.subtle.digest("SHA-256", enc.encode(text))); }

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...extra });
  return new Response(JSON.stringify(data), { status, headers });
}
export function fail(status: number, error: string, extra: Record<string, string> = {}): Response { return json({ error }, status, extra); }

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}

/** Same-origin guard for state-changing requests (CSRF defence on top of SameSite cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

/** Fixed-window limiter; returns true when the request is allowed. */
export async function rateLimit(db: D1Like, bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(now() / windowSec) * windowSec;
  const row = await db.prepare(
    `INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)
     ON CONFLICT(bucket) DO UPDATE SET hits = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.hits + 1 ELSE 1 END,
                                       window_start = excluded.window_start
     RETURNING hits`,
  ).bind(bucket, win).first<{ hits: number }>();
  return Number(row?.hits || 0) <= limit;
}

export async function logSecurity(db: D1Like, kind: string, subject: string, detail: string): Promise<void> {
  try { await db.prepare("INSERT INTO security_events (kind, subject, detail, created_at) VALUES (?, ?, ?, ?)").bind(kind, subject.slice(0, 64), detail.slice(0, 300), now()).run(); } catch { /* never break a request on logging */ }
}

/** Same plausibility envelope the arena has always used: score, level, bosses and kills must fit the run length. */
export function plausibleRun(r: { score: number; duration: number; level: number; bossesDefeated: number; kills: number }): boolean {
  const ints = [r.score, r.duration, r.level, r.bossesDefeated, r.kills].every(Number.isInteger);
  if (!ints) return false;
  const maxLevel = Math.floor(r.duration / 40) + 1;
  return r.score >= 0 && r.score <= 500_000 && r.duration >= 5 && r.duration <= MAX_RUN_SECONDS &&
    r.level >= 1 && r.level <= maxLevel && r.bossesDefeated >= 0 && r.bossesDefeated <= Math.floor(r.duration / 40) &&
    r.kills >= 0 && r.kills <= r.duration * 16 + 20 && r.score <= r.duration * 240 + r.bossesDefeated * 1_800 + 250;
}

// ------------------------------------------------------------------ leaderboard
export type BoardRow = { rank: number; key: string; name: string; score: number; change: number | null; runs: number; isYou: boolean };

const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
function weekStart(): string { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }

/** GET /api/leaderboard?scope=all|week&limit=1..500&q=   (meId: the signed-in player id, if any) */
export async function handleLeaderboard(request: Request, db: D1Like, meId: string | null = null): Promise<Response> {
  const url = new URL(request.url);
  if (!(await rateLimit(db, `board:${clientIp(request)}`, 300, 60))) return fail(429, "Slow down a little.");
  const scope = url.searchParams.get("scope") === "week" ? "week" : "all";
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit")) || 200));
  const q = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 24);
  const today = utcDay(), from = scope === "week" ? weekStart() : "0000-00-00";
  const ranked = await rankedBoard(db, scope, today, from);
  let out: BoardRow[] = ranked.map((r) => ({ rank: r.rank, key: r.key, name: r.name, score: r.score, change: r.change, runs: r.runs, isYou: !!meId && meId === r.id }));
  if (q) out = out.filter((r) => r.name.toLowerCase().includes(q));
  return json({ scope, generatedAt: new Date(ranked.builtAt).toISOString(), total: ranked.length, rows: out.slice(0, limit), signedIn: !!meId });
}

// The ranking is the same for every viewer, so it is computed at most once per BOARD_TTL_MS per scope;
// a burst of board requests then costs one query instead of one each.
const BOARD_TTL_MS = 5000;
type Ranked = Array<Omit<BoardRow, "isYou"> & { id: string }> & { builtAt: number };
const boardCache = new Map<string, Ranked>();
async function rankedBoard(db: D1Like, scope: string, today: string, from: string): Promise<Ranked> {
  const cacheKey = `${scope}:${today}`;
  const hit = boardCache.get(cacheKey);
  if (hit && Date.now() - hit.builtAt < BOARD_TTL_MS) return hit;
  const rows = (await db.prepare(
    `SELECT p.id AS id, p.callsign AS name, MAX(s.score) AS best,
            MAX(CASE WHEN s.day_key < ? THEN s.score END) AS prevBest, COUNT(*) AS runs, p.created_at AS createdAt
     FROM players p JOIN arena_scores s ON s.player_id = p.id
     WHERE s.day_key >= ?
     GROUP BY p.id ORDER BY best DESC, p.created_at ASC LIMIT 1000`,
  ).bind(today, from).all<{ id: string; name: string; best: number; prevBest: number | null; runs: number; createdAt: string }>()).results || [];
  // rank change = position by yesterday's best vs position now (null = new on the board today)
  const prev = rows.filter((r) => r.prevBest != null).sort((a, b) => Number(b.prevBest) - Number(a.prevBest) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const prevRank = new Map(prev.map((r, i) => [r.id, i + 1]));
  const out = [] as unknown as Ranked;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    out.push({ id: r.id, rank: i + 1, key: (await sha256Hex("forge-board:" + r.id)).slice(0, 16), name: String(r.name || "PILOT"), score: Number(r.best),
      change: prevRank.has(r.id) ? (prevRank.get(r.id) as number) - (i + 1) : null, runs: Number(r.runs) });
  }
  out.builtAt = Date.now();
  boardCache.set(cacheKey, out);
  if (boardCache.size > 8) boardCache.delete(boardCache.keys().next().value as string);
  return out;
}

/** Drops the cached ranking (a new run was accepted). */
export function invalidateBoard(): void { boardCache.clear(); }
