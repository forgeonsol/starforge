import { getChatGPTUser } from "../../chatgpt-auth";
import { getArenaDb } from "../../../db/d1";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to view a raid." }, { status: 401 });
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (!code) return Response.json({ error: "Room code required." }, { status: 400 });
  try {
    const db = getArenaDb();
    const room = await db.prepare("SELECT code, boss, hp, max_hp AS maxHp, status FROM raid_rooms WHERE code = ?").bind(code).first();
    if (!room) return Response.json({ error: "Raid room not found." }, { status: 404 });
    const members = await db.prepare("SELECT callsign, damage FROM raid_members WHERE room_id = (SELECT id FROM raid_rooms WHERE code = ?)").bind(code).all();
    return Response.json({ room, members: members.results ?? [] });
  } catch (error) {
    console.error("raid read failed", error);
    return Response.json({ error: "Raid status unavailable." }, { status: 503 });
  }
}
