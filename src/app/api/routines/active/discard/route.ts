import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { discardActiveRoutineSessionForUser } from '@/server/db/routine-sessions';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await discardActiveRoutineSessionForUser(userId);
  return NextResponse.json(result);
}
