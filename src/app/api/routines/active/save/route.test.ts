import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, saveActiveRoutineSessionForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  saveActiveRoutineSessionForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ saveActiveRoutineSessionForUser }));

import { POST } from './route';

describe('POST /api/routines/active/save', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 404 when no active session', async () => {
    getSessionUserId.mockResolvedValue(1);
    saveActiveRoutineSessionForUser.mockResolvedValue({ ok: false, reason: 'no_active_session' });
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it('returns 409 when no completed sets', async () => {
    getSessionUserId.mockResolvedValue(1);
    saveActiveRoutineSessionForUser.mockResolvedValue({ ok: false, reason: 'no_completed_sets' });
    const res = await POST();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('no_completed_sets');
  });

  it('returns 200 with sessionId on success', async () => {
    getSessionUserId.mockResolvedValue(1);
    saveActiveRoutineSessionForUser.mockResolvedValue({ ok: true, sessionId: 42 });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe(42);
  });
});
