import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, startRoutineSessionForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  startRoutineSessionForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ startRoutineSessionForUser }));

import { POST } from './route';

function req() {
  return new Request('http://localhost/api/routines/1/start', { method: 'POST' });
}

describe('POST /api/routines/[id]/start', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when routine not found', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 with code+message when active timer conflict', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue({ conflict: 'active_timer_exists' });
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('active_timer_exists');
    expect(body.error).toMatch(/timer/i);
  });

  it('returns 409 with distinct message when active session conflict', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue({ conflict: 'active_session_exists' });
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('active_session_exists');
    expect(body.error).toMatch(/routine/i);
    expect(body.error).not.toMatch(/timer/i);
  });

  it('returns 409 with code when routine is empty', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue({ conflict: 'empty_routine' });
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('empty_routine');
    expect(body.error).toBe('Routine has no sets');
  });

  it('returns 201 with session', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue({ id: 99, sets: [] });
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session.id).toBe(99);
  });
});
