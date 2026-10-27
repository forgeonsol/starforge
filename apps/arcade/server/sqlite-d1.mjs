// SQLite for the self-hosted server: open + harden, apply drizzle migrations once, expose a D1-compatible
// facade (so lib/*.ts runs unchanged), and do housekeeping (cleanup + rotating backups).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA trusted_schema = OFF;");
  return db;
}

/** Applies every drizzle/*.sql not applied yet, each in its own transaction. Returns the names applied. */
export function migrate(db, dir) {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const done = new Set(db.prepare("SELECT name FROM _migrations").all().map((r) => r.name));
  const applied = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    db.exec("BEGIN");
    try {
      for (const stmt of readFileSync(join(dir, f), "utf8").split("--> statement-breakpoint")) if (stmt.trim()) db.exec(stmt);
      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(f, Date.now());
      db.exec("COMMIT");
      applied.push(f);
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(`migration ${f} failed: ${e.message}`);
    }
  }
  return applied;
}

/** The subset of the Cloudflare D1 API that lib/*.ts uses. */
export function d1(db) {
  const isReturning = (sql) => /\bRETURNING\b/i.test(sql);
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v)); return st; },
        async first() { return db.prepare(sql).get(...args) ?? null; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() {
          if (isReturning(sql)) { const r = db.prepare(sql).all(...args); return { results: r, meta: { changes: r.length } }; }
          const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } };
        },
        _exec() {
          if (isReturning(sql)) { const r = db.prepare(sql).all(...args); return { results: r, meta: { changes: r.length } }; }
          const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } };
        },
      };
      return st;
    },
    async batch(list) {
      db.exec("BEGIN IMMEDIATE");
      try { const out = list.map((s) => s._exec()); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}

/** Drops rows that are only useful for a while. */
export function cleanup(db) {
  const t = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM rate_limits WHERE window_start < ?").run(t - 2 * 86400);
  db.prepare("DELETE FROM player_sessions WHERE expires_at < ?").run(t);
  db.prepare("DELETE FROM security_events WHERE created_at < ?").run(t - 90 * 86400);
  const old = Date.now() - 7 * 86400 * 1000;
  db.prepare("DELETE FROM raid_members WHERE room_id IN (SELECT id FROM raid_rooms WHERE created_at < ?)").run(old);
  db.prepare("DELETE FROM raid_rooms WHERE created_at < ?").run(old);
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
}

/** Consistent online copy via VACUUM INTO; keeps the newest `keep` files. Returns the new file's path. */
export function backup(db, dir, keep = 14) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `forge-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  db.prepare("VACUUM INTO ?").run(file);
  const files = readdirSync(dir).filter((f) => /^forge-.*\.db$/.test(f)).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(keep)) rmSync(join(dir, f));
  return file;
}
