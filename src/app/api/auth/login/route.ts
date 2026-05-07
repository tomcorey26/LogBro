import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { getUserByUsername } from "@/server/db/users";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string(),
});

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();
  const { password } = parsed.data;

  const user = await getUserByUsername(username);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ id: user.id, username: user.username });
}
