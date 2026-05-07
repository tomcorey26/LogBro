import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { patchSetForUser } from '@/server/db/routine-sessions';

const bodySchema = z.object({
  plannedDurationSeconds: z.number().int().min(60).max(7200).optional(),
  plannedBreakSeconds: z.number().int().min(0).max(3600).optional(),
  actualDurationSeconds: z.number().int().min(1).max(7200).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ setRowId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { setRowId } = await params;
  const id = Number(setRowId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: 'Invalid set id' }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const result = await patchSetForUser(userId, id, parsed.data);
  if (!result) return NextResponse.json({ error: 'Set not found' }, { status: 404 });
  if ('conflict' in result)
    return NextResponse.json({ error: 'Set is locked', code: result.conflict }, { status: 409 });
  return NextResponse.json({ session: result });
}
