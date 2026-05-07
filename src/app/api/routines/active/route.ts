import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getActiveRoutineSessionForUser } from '@/server/db/routine-sessions';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getActiveRoutineSessionForUser(userId);
  return NextResponse.json({ session });
}
