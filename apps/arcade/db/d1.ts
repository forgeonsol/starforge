import { env } from "cloudflare:workers";

export function getArenaDb() {
  if (!env.DB) throw new Error("The arena leaderboard is temporarily unavailable.");
  return env.DB;
}
