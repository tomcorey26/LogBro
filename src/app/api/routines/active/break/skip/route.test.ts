import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, skipBreakForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  skipBreakForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ skipBreakForUser }));

import { POST } from './route';

describe('POST /api/routines/active/break/skip', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('returns 404 when no break running', async () => {
    getSessionUserId.mockResolvedValue(1);
    skipBreakForUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(404);
  });

  it('returns 200 with session on success', async () => {
    getSessionUserId.mockResolvedValue(1);
    skipBreakForUser.mockResolvedValue({ id: 7, sets: [] });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe(7);
  });
});
