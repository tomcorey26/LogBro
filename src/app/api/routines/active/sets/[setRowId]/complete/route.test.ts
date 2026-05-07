import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, completeSetForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  completeSetForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ completeSetForUser }));

import { POST } from './route';

function req(body?: unknown) {
  return new Request('http://localhost/api/routines/active/sets/1/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/routines/active/sets/[setRowId]/complete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when set not found', async () => {
    getSessionUserId.mockResolvedValue(1);
    completeSetForUser.mockResolvedValue(null);
    const res = await POST(req({}), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 with session on success (no body)', async () => {
    getSessionUserId.mockResolvedValue(1);
    completeSetForUser.mockResolvedValue({ id: 7, sets: [] });
    const res = await POST(req(), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe(7);
  });

  it('passes endedEarlyAt to the db function', async () => {
    getSessionUserId.mockResolvedValue(1);
    completeSetForUser.mockResolvedValue({ id: 7, sets: [] });
    const iso = '2026-05-02T01:23:45.000Z';
    const res = await POST(req({ endedEarlyAt: iso }), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(200);
    expect(completeSetForUser).toHaveBeenCalledWith(1, 1, new Date(iso));
  });
});
