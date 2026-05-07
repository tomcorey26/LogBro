import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { completeSetForUser } from '@/server/db/routine-sessions';

const bodySchema = z.object({
  endedEarlyAt: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ setRowId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { setRowId } = await params;
  const id = Number(setRowId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: 'Invalid set id' }, { status: 400 });

  let body: unknown = {};
  try { body = await req.json(); } catch {}
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const endedAt = parsed.data.endedEarlyAt ? new Date(parsed.data.endedEarlyAt) : undefined;
  const result = await completeSetForUser(userId, id, endedAt);
  if (!result) return NextResponse.json({ error: 'Set not found' }, { status: 404 });
  return NextResponse.json({ session: result });
}
