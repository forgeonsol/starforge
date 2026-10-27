// Original-host wrapper: identity comes from the host's ChatGPT sign-in. Logic lives in lib/arena.ts.
// The self-hosted server (server/server.mjs) does not use this file.
import { getChatGPTUser } from "../../chatgpt-auth";
import { getArenaDb } from "../../../db/d1";
import { handleProfileGet, handleProfilePost } from "../../../lib/arena.ts";

const me = async () => (await getChatGPTUser().catch(() => null))?.userId ?? null;
export async function GET(request: Request) { return handleProfileGet(request, getArenaDb(), await me()); }
export async function POST(request: Request) { return handleProfilePost(request, getArenaDb(), await me()); }
