import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, startSetForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  startSetForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ startSetForUser }));

import { POST } from './route';

function req() {
  return new Request('http://localhost/api/routines/active/sets/1/start', { method: 'POST' });
}

describe('POST /api/routines/active/sets/[setRowId]/start', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when set not found', async () => {
    getSessionUserId.mockResolvedValue(1);
    startSetForUser.mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 with code when conflict', async () => {
    getSessionUserId.mockResolvedValue(1);
    startSetForUser.mockResolvedValue({ conflict: 'set_already_running' });
    const res = await POST(req(), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('set_already_running');
  });

  it('returns 200 with session', async () => {
    getSessionUserId.mockResolvedValue(1);
    startSetForUser.mockResolvedValue({ id: 5, sets: [] });
    const res = await POST(req(), { params: Promise.resolve({ setRowId: '1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe(5);
  });
});
