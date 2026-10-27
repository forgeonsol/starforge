import { getChatGPTUser } from "../../chatgpt-auth";
import { getArenaDb } from "../../../db/d1";
import { handleScore } from "../../../lib/arena.ts";

export async function POST(request: Request) {
  const user = await getChatGPTUser().catch(() => null);
  return handleScore(request, getArenaDb(), user ? user.userId : null);
}
