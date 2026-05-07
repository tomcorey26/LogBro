import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { startSetForUser } from '@/server/db/routine-sessions';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ setRowId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { setRowId } = await params;
  const id = Number(setRowId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: 'Invalid set id' }, { status: 400 });
  const result = await startSetForUser(userId, id);
  if (!result) return NextResponse.json({ error: 'Set not found' }, { status: 404 });
  if ('conflict' in result)
    return NextResponse.json({ error: 'Conflict', code: result.conflict }, { status: 409 });
  return NextResponse.json({ session: result });
}
