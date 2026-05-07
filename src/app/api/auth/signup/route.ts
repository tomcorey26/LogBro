import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { createUser, getUserByUsername } from "@/server/db/users";
import { seedDefaultHabits } from "@/server/db/habits";

const signupSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid username (3-32 chars, letters/digits/_/- only) or password (min 8 chars)" },
      { status: 400 },
    );
  }

  const { username, password } = parsed.data;

  const existing = await getUserByUsername(username);
  if (existing) {
    return NextResponse.json(
      { error: "Username already in use" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser(username, passwordHash);
  try {
    await seedDefaultHabits(user.id);
  } catch (err) {
    console.error("Failed to seed default habits:", err);
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ id: user.id, username: user.username });
}
