import { getChatGPTUser } from "../../chatgpt-auth";
import { getArenaDb } from "../../../db/d1";
import { handleRaid } from "../../../lib/arena.ts";

export async function GET(request: Request) {
  const user = await getChatGPTUser().catch(() => null);
  return handleRaid(request, getArenaDb(), user ? user.userId : null);
}
