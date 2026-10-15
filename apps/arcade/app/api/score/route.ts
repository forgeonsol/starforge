import { getChatGPTUser } from "../../chatgpt-auth";
import { getArenaDb } from "../../../db/d1";
import { clientIp, logSecurity, rateLimit } from "../../../lib/forge-server";

const MAX_DURATION = 60 * 60;

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function cleanCallsign(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16).toUpperCase()
    : "";
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in before posting a run." }, { status: 401 });
  }

  try {
    if (!(await rateLimit(getArenaDb(), `score:${clientIp(request)}`, 60, 3600))) {
      return Response.json({ error: "Too many runs posted. Try again later." }, { status: 429 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const callsign = cleanCallsign(body.callsign);
    const score = Number(body.score);
    const duration = Number(body.duration);
    const level = Number(body.level);
    const bossesDefeated = Number(body.bossesDefeated);
    const kills = Number(body.kills);
    const maxLevel = Math.floor(duration / 40) + 1;
    const plausibleScore = duration * 240 + bossesDefeated * 1_800 + 250;

    if (!callsign || callsign.length < 2) {
      return Response.json({ error: "Use a callsign with at least two letters or numbers." }, { status: 400 });
    }
    if (
      !Number.isInteger(score) || score < 0 || score > 500_000 ||
      !Number.isInteger(duration) || duration < 0 || duration > MAX_DURATION ||
      !Number.isInteger(level) || level < 1 || level > maxLevel ||
      !Number.isInteger(bossesDefeated) || bossesDefeated < 0 || bossesDefeated > Math.floor(duration / 40) ||
      !Number.isInteger(kills) || kills < 0 || kills > duration * 16 + 20 ||
      score > plausibleScore
    ) {
      await logSecurity(getArenaDb(), "implausible_run", user.userId, JSON.stringify({ score, duration, level, bossesDefeated, kills }));
      return Response.json({ error: "That run could not be verified. Play another run and submit again." }, { status: 400 });
    }

    const db = getArenaDb();
    const existing = await db.prepare("SELECT last_submission_at AS last, play_seconds AS playSeconds FROM players WHERE id = ?")
      .bind(user.userId).first<{ last: number; playSeconds: number }>();
    const now = Math.floor(Date.now() / 1000);
    if (existing && now - Number(existing.last) < 8) {
      return Response.json({ error: "Please wait a few seconds before posting another run." }, { status: 429 });
    }

    const rewardCredits = Math.min(500, Math.floor(score / 350));
    const referral = await db.prepare("SELECT referred_by AS inviter, referral_rewarded AS rewarded FROM players WHERE id = ?")
      .bind(user.userId).first<{ inviter: string | null; rewarded: number }>();

    await db.batch([
      db.prepare(
        `INSERT INTO players (id, callsign, referral_code, last_submission_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET callsign = excluded.callsign, last_submission_at = excluded.last_submission_at`,
      ).bind(user.userId, callsign, crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase(), now),
      db.prepare(
        `INSERT INTO arena_scores (player_id, day_key, score, duration_seconds, level, bosses_defeated)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(player_id, day_key) DO UPDATE SET
           score = excluded.score,
           duration_seconds = excluded.duration_seconds,
           level = excluded.level,
           bosses_defeated = excluded.bosses_defeated,
           submitted_at = CURRENT_TIMESTAMP
         WHERE excluded.score > arena_scores.score`,
      ).bind(user.userId, utcDay(), score, duration, level, bossesDefeated),
      db.prepare("UPDATE players SET lifetime_xp = lifetime_xp + ?, total_runs = total_runs + 1, total_bosses = total_bosses + ?, total_kills = total_kills + ?, highest_level = MAX(highest_level, ?), play_seconds = play_seconds + ?, credits = credits + ? WHERE id = ?")
        .bind(score, bossesDefeated, kills, level, duration, rewardCredits, user.userId),
      ...(referral?.inviter && !Number(referral.rewarded) ? [
        db.prepare("UPDATE players SET credits = credits + 250 WHERE id = ?").bind(referral.inviter),
        db.prepare("UPDATE players SET referral_rewarded = 1 WHERE id = ? AND referral_rewarded = 0").bind(user.userId),
      ] : []),
    ]);

    const totalPlaySeconds = (Number(existing?.playSeconds) || 0) + duration;
    const earnedSkinCount = Math.min(10, 1 + Math.floor(totalPlaySeconds / 420));
    const newlyEarnedSkin = earnedSkinCount > Math.min(10, 1 + Math.floor((Number(existing?.playSeconds) || 0) / 420))
      ? `skin-${String(earnedSkinCount).padStart(2, "0")}`
      : null;
    return Response.json({ ok: true, score, creditsEarned: rewardCredits + (referral?.inviter && !Number(referral.rewarded) ? 250 : 0), totalPlaySeconds, newlyEarnedSkin, day: utcDay() }, { status: 201 });
  } catch (error) {
    console.error("score submit failed", error);
    return Response.json({ error: "Your run could not be saved. Your local record is still safe." }, { status: 503 });
  }
}
