import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { buildSummaryForUser } from '@/server/db/routine-sessions';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await buildSummaryForUser(userId);
  if (!result.ok && result.reason === 'no_active_session')
    return NextResponse.json({ error: 'No active session', code: result.reason }, { status: 404 });
  if (!result.ok && result.reason === 'no_completed_sets')
    return NextResponse.json({ error: 'No completed sets', code: result.reason }, { status: 409 });
  return NextResponse.json({ summary: (result as Extract<typeof result, { ok: true }>).summary });
}
