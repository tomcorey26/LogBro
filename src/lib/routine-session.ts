import type { Routine, RoutineSessionActiveTimer, RoutineSessionSet, RoutineSessionSummary } from './types';

export type NextPhaseInput = {
  sets: RoutineSessionSet[];
  completedSetId: number;
};

export type NextPhaseResult =
  | { phase: 'idle' }
  | { phase: 'break'; breakSeconds: number; setRowId: number };

export function computeNextPhase({ sets, completedSetId }: NextPhaseInput): NextPhaseResult {
  const completed = sets.find((s) => s.id === completedSetId);
  if (!completed) return { phase: 'idle' };

  if (completed.plannedBreakSeconds === 0) return { phase: 'idle' };

  const sorted = [...sets].sort(
    (a, b) => a.blockIndex - b.blockIndex || a.setIndex - b.setIndex,
  );
  const last = sorted[sorted.length - 1];
  if (last.id === completedSetId) return { phase: 'idle' };

  return {
    phase: 'break',
    breakSeconds: completed.plannedBreakSeconds,
    setRowId: completed.id,
  };
}

export type ReplayAction =
  | { action: 'stable' }
  | { action: 'complete-set'; setRowId: number }
  | { action: 'complete-break' };

export function computeReplayForward(
  timer: RoutineSessionActiveTimer | null,
  now: Date,
): ReplayAction {
  if (!timer) return { action: 'stable' };

  const elapsed = (now.getTime() - new Date(timer.startTime).getTime()) / 1000;

  if (elapsed < timer.targetDurationSeconds) return { action: 'stable' };

  if (timer.phase === 'set') return { action: 'complete-set', setRowId: timer.routineSessionSetId };

  return { action: 'complete-break' };
}

export function computeSummary(input: {
  routineNameSnapshot: string;
  sets: RoutineSessionSet[];
  startedAt: string;
  finishedAt: string;
}): RoutineSessionSummary {
  // Filter must match saveActiveRoutineSessionForUser's filter exactly. If the
  // summary counted a row that save can't persist (deleted habit → habitId
  // null; or half-completed row), the user would see N sets here and N-1 in
  // history. Keep the two filters in lockstep.
  const completed = input.sets.filter(
    (s) =>
      s.completedAt !== null &&
      s.habitId !== null &&
      (s.actualDurationSeconds ?? 0) > 0,
  );
  const totalActiveSeconds = completed.reduce(
    (sum, s) => sum + (s.actualDurationSeconds ?? 0),
    0,
  );
  const totalElapsedSeconds = Math.max(
    0,
    Math.floor(
      (new Date(input.finishedAt).getTime() - new Date(input.startedAt).getTime()) / 1000,
    ),
  );
  const byHabitMap = new Map<string, { sets: number; totalSeconds: number }>();
  for (const s of completed) {
    const e = byHabitMap.get(s.habitNameSnapshot) ?? { sets: 0, totalSeconds: 0 };
    e.sets += 1;
    e.totalSeconds += s.actualDurationSeconds ?? 0;
    byHabitMap.set(s.habitNameSnapshot, e);
  }
  return {
    routineNameSnapshot: input.routineNameSnapshot,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    totalElapsedSeconds,
    totalActiveSeconds,
    completedSetCount: completed.length,
    byHabit: Array.from(byHabitMap, ([habitName, v]) => ({ habitName, ...v })),
  };
}

export type SnapshotInsert = {
  blockIndex: number;
  setIndex: number;
  habitId: number;
  habitNameSnapshot: string;
  notesSnapshot: string | null;
  plannedDurationSeconds: number;
  plannedBreakSeconds: number;
};

export type SetRowState =
  | 'upcoming-idle'
  | 'upcoming-disabled'
  | 'running'
  | 'break-running'
  | 'completed';

/**
 * Decide what state a single set's row should render in given the active timer.
 *
 * The active timer takes precedence over completedAt — when a break is running,
 * the underlying set is already completedAt, but the row should show
 * 'break-running' (with the Skip button) until the break finishes.
 */
export function computeSetRowState(
  set: RoutineSessionSet,
  activeTimer: RoutineSessionActiveTimer | null,
): SetRowState {
  if (activeTimer?.routineSessionSetId === set.id) {
    return activeTimer.phase === 'break' ? 'break-running' : 'running';
  }
  if (set.completedAt) return 'completed';
  return activeTimer ? 'upcoming-disabled' : 'upcoming-idle';
}

export function snapshotRoutineToSets(routine: Routine): SnapshotInsert[] {
  const sortedBlocks = [...routine.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  return sortedBlocks.flatMap((block, blockIndex) =>
    block.sets.map((set, setIndex) => ({
      blockIndex,
      setIndex,
      habitId: block.habitId,
      habitNameSnapshot: block.habitName,
      notesSnapshot: block.notes,
      plannedDurationSeconds: set.durationSeconds,
      plannedBreakSeconds: set.breakSeconds,
    })),
  );
}
