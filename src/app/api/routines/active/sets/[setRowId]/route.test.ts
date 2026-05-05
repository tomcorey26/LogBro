import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, patchSetForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  patchSetForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ patchSetForUser }));

import { PATCH } from './route';

function req(body: unknown) {
  return new Request('http://localhost/api/routines/active/sets/1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/routines/active/sets/[setRowId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await PATCH(req({ plannedDurationSeconds: 120 }), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    getSessionUserId.mockResolvedValue(1);
    const res = await PATCH(req({ plannedDurationSeconds: 'not a number' }), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(400);
  });

  it('rejects actualDurationSeconds: 0', async () => {
    getSessionUserId.mockResolvedValue(1);
    const res = await PATCH(req({ actualDurationSeconds: 0 }), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when set not found', async () => {
    getSessionUserId.mockResolvedValue(1);
    patchSetForUser.mockResolvedValue(null);
    const res = await PATCH(req({ plannedDurationSeconds: 120 }), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 when set is locked', async () => {
    getSessionUserId.mockResolvedValue(1);
    patchSetForUser.mockResolvedValue({ conflict: 'set_locked' });
    const res = await PATCH(req({ plannedDurationSeconds: 120 }), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('set_locked');
  });

  it('returns 200 with session on success', async () => {
    getSessionUserId.mockResolvedValue(1);
    patchSetForUser.mockResolvedValue({ id: 5, sets: [] });
    const res = await PATCH(req({ plannedDurationSeconds: 120 }), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe(5);
  });
});
