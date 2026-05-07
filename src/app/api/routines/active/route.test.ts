import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, getActiveRoutineSessionForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getActiveRoutineSessionForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ getActiveRoutineSessionForUser }));

import { GET } from './route';

describe('GET /api/routines/active', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 without auth', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns null when no active session', async () => {
    getSessionUserId.mockResolvedValue(1);
    getActiveRoutineSessionForUser.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.session).toBeNull();
  });

  it('returns session when present', async () => {
    getSessionUserId.mockResolvedValue(1);
    getActiveRoutineSessionForUser.mockResolvedValue({ id: 7, sets: [] });
    const res = await GET();
    const body = await res.json();
    expect(body.session.id).toBe(7);
  });
});
