import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, discardActiveRoutineSessionForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  discardActiveRoutineSessionForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ discardActiveRoutineSessionForUser }));

import { POST } from './route';

describe('POST /api/routines/active/discard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 200 with discarded:true when a session was discarded', async () => {
    getSessionUserId.mockResolvedValue(1);
    discardActiveRoutineSessionForUser.mockResolvedValue({ discarded: true });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discarded).toBe(true);
  });

  it('returns 200 with discarded:false when there was nothing to discard (idempotent)', async () => {
    getSessionUserId.mockResolvedValue(1);
    discardActiveRoutineSessionForUser.mockResolvedValue({ discarded: false });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.discarded).toBe(false);
  });
});
