import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, buildSummaryForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  buildSummaryForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ buildSummaryForUser }));

import { POST } from './route';

describe('POST /api/routines/active/finish', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 404 when no active session', async () => {
    getSessionUserId.mockResolvedValue(1);
    buildSummaryForUser.mockResolvedValue({ ok: false, reason: 'no_active_session' });
    const res = await POST();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('no_active_session');
  });

  it('returns 409 when no completed sets', async () => {
    getSessionUserId.mockResolvedValue(1);
    buildSummaryForUser.mockResolvedValue({ ok: false, reason: 'no_completed_sets' });
    const res = await POST();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('no_completed_sets');
  });

  it('returns 200 with summary on success', async () => {
    getSessionUserId.mockResolvedValue(1);
    const summary = { routineNameSnapshot: 'Test', startedAt: '', finishedAt: '', totalElapsedSeconds: 60, totalActiveSeconds: 30, completedSetCount: 1, byHabit: [] };
    buildSummaryForUser.mockResolvedValue({ ok: true, summary });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.completedSetCount).toBe(1);
  });
});
