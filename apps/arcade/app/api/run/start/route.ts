import { getArenaDb } from "../../../../db/d1";
import { handleRunStart } from "../../../../lib/arena.ts";

export async function POST(request: Request) { return handleRunStart(request, getArenaDb()); }
