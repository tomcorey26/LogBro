import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { startTimerForUser } from "@/server/db/timers";

const MAX_CLOCK_SKEW_MS = 5_000;

const startSchema = z.object({
  habitId: z.number().int().positive(),
  targetDurationSeconds: z.number().int().min(5).max(86400).optional(),
  startTime: z
    .string()
    .datetime()
    .optional()
    .refine(
      (s) => {
        if (!s) return true;
        const diff = Date.now() - new Date(s).getTime();
        return diff >= 0 && diff <= MAX_CLOCK_SKEW_MS;
      },
      "startTime must be within 5s of server time",
    ),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 400 },
    );

  const { habitId, targetDurationSeconds, startTime } = parsed.data;

  const timer = await startTimerForUser({
    userId,
    habitId,
    targetDurationSeconds,
    startTime: startTime ? new Date(startTime) : undefined,
  });
  if (!timer)
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  if ("conflict" in timer)
    return NextResponse.json(
      { error: "Routine in progress", code: "routine_session_active" },
      { status: 409 },
    );

  return NextResponse.json(timer);
}
