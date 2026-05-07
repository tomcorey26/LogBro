import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export function getUserByUsername(username: string) {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export async function createUser(username: string, passwordHash: string) {
  const [user] = await db
    .insert(users)
    .values({ username, passwordHash })
    .returning();
  return user;
}

export function getUserById(userId: number) {
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
