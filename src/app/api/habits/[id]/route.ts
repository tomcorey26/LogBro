import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { deleteHabitForUserGuarded } from "@/server/db/habits";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const habitId = parseInt(id, 10);
  if (isNaN(habitId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const result = await deleteHabitForUserGuarded(habitId, userId);
  if (!result.ok) {
    if (result.reason === "habit_in_use") {
      return NextResponse.json(
        { error: "Habit is in use by your active routine", code: "habit_in_use" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
