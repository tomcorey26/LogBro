import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { startRoutineSessionForUser } from '@/server/db/routine-sessions';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const routineId = Number(id);
  if (!Number.isInteger(routineId) || routineId <= 0)
    return NextResponse.json({ error: 'Invalid routine id' }, { status: 400 });

  const result = await startRoutineSessionForUser(userId, routineId);
  if (!result) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
  if ('conflict' in result) {
    const error =
      result.conflict === 'empty_routine'
        ? 'Routine has no sets'
        : result.conflict === 'active_session_exists'
          ? 'Another routine is already in progress'
          : 'Active timer exists';
    return NextResponse.json({ error, code: result.conflict }, { status: 409 });
  }

  return NextResponse.json({ session: result }, { status: 201 });
}
