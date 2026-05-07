import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { completeBreakForUser } from '@/server/db/routine-sessions';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await completeBreakForUser(userId);
  if (!result) return NextResponse.json({ error: 'No break running' }, { status: 404 });
  return NextResponse.json({ session: result });
}
