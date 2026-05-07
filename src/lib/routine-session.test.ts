import { describe, it, expect } from 'vitest';
import { computeNextPhase, computeReplayForward, computeSummary, snapshotRoutineToSets, computeSetRowState } from './routine-session';
import type { RoutineSessionSet, RoutineSessionActiveTimer, Routine } from './types';

function makeSet(partial: Partial<RoutineSessionSet> & { blockIndex: number; setIndex: number }): RoutineSessionSet {
  return {
    id: partial.blockIndex * 100 + partial.setIndex,
    sessionId: 1,
    habitId: 1,
    habitNameSnapshot: 'Guitar',
    notesSnapshot: null,
    plannedDurationSeconds: 60,
    plannedBreakSeconds: 30,
    actualDurationSeconds: null,
    startedAt: null,
    completedAt: null,
    ...partial,
  };
}

describe('computeNextPhase', () => {
  it('returns break when set has break and is not the final set', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0 }),
      makeSet({ blockIndex: 0, setIndex: 1 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[0].id });
    expect(result).toEqual({ phase: 'break', breakSeconds: 30, setRowId: sets[0].id });
  });

  it('returns idle when completed set has zero break', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0, plannedBreakSeconds: 0 }),
      makeSet({ blockIndex: 0, setIndex: 1 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[0].id });
    expect(result).toEqual({ phase: 'idle' });
  });

  it('returns idle when this is the final set of the final block', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0 }),
      makeSet({ blockIndex: 0, setIndex: 1 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[1].id });
    expect(result).toEqual({ phase: 'idle' });
  });

  it('returns break when last set of a non-final block has a break', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0 }),
      makeSet({ blockIndex: 1, setIndex: 0 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[0].id });
    expect(result).toEqual({ phase: 'break', breakSeconds: 30, setRowId: sets[0].id });
  });
});

function makeTimer(p: Partial<RoutineSessionActiveTimer> = {}): RoutineSessionActiveTimer {
  return {
    routineSessionSetId: 1,
    phase: 'set',
    startTime: '2026-05-02T00:00:00.000Z',
    targetDurationSeconds: 60,
    ...p,
  };
}

describe('computeReplayForward', () => {
  it('returns stable when no timer', () => {
    expect(computeReplayForward(null, new Date())).toEqual({ action: 'stable' });
  });

  it('returns stable when timer has not elapsed', () => {
    const start = new Date('2026-05-02T00:00:00.000Z');
    const now = new Date(start.getTime() + 30_000);
    expect(computeReplayForward(makeTimer({ targetDurationSeconds: 60 }), now)).toEqual({ action: 'stable' });
  });

  it('returns complete-set when set timer elapsed', () => {
    const start = new Date('2026-05-02T00:00:00.000Z');
    const now = new Date(start.getTime() + 120_000);
    expect(computeReplayForward(makeTimer({ phase: 'set', targetDurationSeconds: 60 }), now)).toEqual({
      action: 'complete-set',
      setRowId: 1,
    });
  });

  it('returns complete-break when break timer elapsed', () => {
    const start = new Date('2026-05-02T00:00:00.000Z');
    const now = new Date(start.getTime() + 120_000);
    expect(computeReplayForward(makeTimer({ phase: 'break', targetDurationSeconds: 60 }), now)).toEqual({
      action: 'complete-break',
    });
  });
});

describe('computeSummary', () => {
  it('aggregates completed sets only', () => {
    const sets: RoutineSessionSet[] = [
      makeSet({ blockIndex: 0, setIndex: 0, habitNameSnapshot: 'Guitar', actualDurationSeconds: 60, completedAt: '2026-05-02T00:01:00.000Z' }),
      makeSet({ blockIndex: 0, setIndex: 1, habitNameSnapshot: 'Guitar', actualDurationSeconds: 30, completedAt: '2026-05-02T00:02:00.000Z' }),
      makeSet({ blockIndex: 1, setIndex: 0, habitNameSnapshot: 'Piano', actualDurationSeconds: 0 }),
      makeSet({ blockIndex: 1, setIndex: 1, habitNameSnapshot: 'Piano', actualDurationSeconds: null }),
    ];
    const startedAt = '2026-05-02T00:00:00.000Z';
    const finishedAt = '2026-05-02T00:10:00.000Z';
    const result = computeSummary({
      routineNameSnapshot: 'Morning',
      sets,
      startedAt,
      finishedAt,
    });
    expect(result.totalElapsedSeconds).toBe(600);
    expect(result.totalActiveSeconds).toBe(90);
    expect(result.completedSetCount).toBe(2);
    expect(result.byHabit).toEqual([
      { habitName: 'Guitar', sets: 2, totalSeconds: 90 },
    ]);
  });

  it('excludes sets whose habit was deleted (habitId === null), to match save filter', () => {
    // If a user deletes a habit mid-session, FK ON DELETE SET NULL clears habitId
    // on the routine_session_sets row. Save can't insert that row (time_sessions
    // requires habitId), so the summary must not count it either — otherwise the
    // user sees "3 sets" on the summary screen but only 2 land in history.
    const sets: RoutineSessionSet[] = [
      makeSet({ blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', actualDurationSeconds: 60, completedAt: '2026-05-02T00:01:00.000Z' }),
      makeSet({ blockIndex: 0, setIndex: 1, habitId: null, habitNameSnapshot: 'Guitar', actualDurationSeconds: 30, completedAt: '2026-05-02T00:02:00.000Z' }),
    ];
    const result = computeSummary({
      routineNameSnapshot: 'Morning',
      sets,
      startedAt: '2026-05-02T00:00:00.000Z',
      finishedAt: '2026-05-02T00:03:00.000Z',
    });
    expect(result.completedSetCount).toBe(1);
    expect(result.totalActiveSeconds).toBe(60);
    expect(result.byHabit).toEqual([
      { habitName: 'Guitar', sets: 1, totalSeconds: 60 },
    ]);
  });

  it('excludes sets with actualDurationSeconds set but no completedAt (defensive)', () => {
    // In production these are co-set, but the summary should defensively reject
    // half-completed rows so its "completed" definition matches save's.
    const sets: RoutineSessionSet[] = [
      makeSet({ blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', actualDurationSeconds: 60, completedAt: '2026-05-02T00:01:00.000Z' }),
      makeSet({ blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', actualDurationSeconds: 30, completedAt: null }),
    ];
    const result = computeSummary({
      routineNameSnapshot: 'Morning',
      sets,
      startedAt: '2026-05-02T00:00:00.000Z',
      finishedAt: '2026-05-02T00:03:00.000Z',
    });
    expect(result.completedSetCount).toBe(1);
  });
});

describe('snapshotRoutineToSets', () => {
  it('flattens routine blocks into ordered session sets', () => {
    const routine: Routine = {
      id: 1,
      name: 'Morning',
      blocks: [
        {
          id: 10,
          habitId: 100,
          habitName: 'Guitar',
          sortOrder: 0,
          notes: 'warm up',
          sets: [
            { durationSeconds: 60, breakSeconds: 30 },
            { durationSeconds: 90, breakSeconds: 0 },
          ],
        },
        {
          id: 11,
          habitId: 200,
          habitName: 'Piano',
          sortOrder: 1,
          notes: null,
          sets: [{ durationSeconds: 120, breakSeconds: 60 }],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };
    const result = snapshotRoutineToSets(routine);
    expect(result).toEqual([
      { blockIndex: 0, setIndex: 0, habitId: 100, habitNameSnapshot: 'Guitar', notesSnapshot: 'warm up', plannedDurationSeconds: 60, plannedBreakSeconds: 30 },
      { blockIndex: 0, setIndex: 1, habitId: 100, habitNameSnapshot: 'Guitar', notesSnapshot: 'warm up', plannedDurationSeconds: 90, plannedBreakSeconds: 0 },
      { blockIndex: 1, setIndex: 0, habitId: 200, habitNameSnapshot: 'Piano', notesSnapshot: null, plannedDurationSeconds: 120, plannedBreakSeconds: 60 },
    ]);
  });
});

describe('computeSetRowState', () => {
  const baseSet = makeSet({ blockIndex: 0, setIndex: 0 });

  function timer(p: Partial<RoutineSessionActiveTimer> = {}): RoutineSessionActiveTimer {
    return {
      routineSessionSetId: baseSet.id,
      phase: 'set',
      startTime: '2026-05-02T00:00:00Z',
      targetDurationSeconds: 60,
      ...p,
    };
  }

  it('returns upcoming-idle with no active timer and the set not started', () => {
    expect(computeSetRowState(baseSet, null)).toBe('upcoming-idle');
  });

  it('returns upcoming-disabled when another set has an active timer', () => {
    expect(computeSetRowState(baseSet, timer({ routineSessionSetId: 999 }))).toBe('upcoming-disabled');
  });

  it('returns running when this set has an active set-phase timer', () => {
    expect(computeSetRowState(baseSet, timer({ phase: 'set' }))).toBe('running');
  });

  it('returns completed when set has completedAt and no active timer', () => {
    const completed = { ...baseSet, completedAt: '2026-05-02T00:01:00Z' };
    expect(computeSetRowState(completed, null)).toBe('completed');
  });

  it('returns break-running for the just-completed set when its break timer is active (precedence over completed)', () => {
    // Regression: a completed set with an active break timer was previously
    // shadowed by the 'completed' branch, hiding the Skip button entirely.
    const completed = { ...baseSet, completedAt: '2026-05-02T00:01:00Z' };
    expect(
      computeSetRowState(completed, timer({ phase: 'break', routineSessionSetId: completed.id })),
    ).toBe('break-running');
  });
});
