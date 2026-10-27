import { getChatGPTUser } from "../../chatgpt-auth";
import { handleLeaderboard } from "../../../lib/forge-server.ts";
import { getArenaDb } from "../../../db/d1";

export async function GET(request: Request) {
  const user = await getChatGPTUser().catch(() => null);
  return handleLeaderboard(request, getArenaDb(), user ? user.userId : null);
}
