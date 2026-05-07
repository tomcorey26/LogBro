import { describe, it, expect, beforeEach } from 'vitest';
import { useRoutineSessionStore } from './routine-session-store';

describe('routine-session-store', () => {
  beforeEach(() => useRoutineSessionStore.getState().reset());

  it('starts in inactive mode', () => {
    expect(useRoutineSessionStore.getState().mode).toBe('inactive');
  });

  it('hydrate sets active session and mode', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: 'iso', finishedAt: null, sets: [], activeTimer: null,
    });
    expect(useRoutineSessionStore.getState().mode).toBe('active');
  });

  it('mode is "summary" when summary is set', () => {
    useRoutineSessionStore.getState().setSummary({ routineNameSnapshot: 'M', startedAt: '', finishedAt: '', totalElapsedSeconds: 0, totalActiveSeconds: 0, completedSetCount: 0, byHabit: [] });
    expect(useRoutineSessionStore.getState().mode).toBe('summary');
  });
});
