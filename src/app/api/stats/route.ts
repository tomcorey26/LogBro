import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getStatsForUser } from "@/server/db/stats";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await getStatsForUser(userId);
  return NextResponse.json({ stats });
}
