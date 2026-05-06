export type Habit = {
  id: number;
  name: string;
  todaySeconds: number;
  totalSeconds: number;
  streak: number;
  activeTimer: {
    startTime: string;
    targetDurationSeconds: number | null;
  } | null;
};

export type HistoryEntry = {
  id: number;
  habitName: string;
  habitId: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  timerMode: 'stopwatch' | 'countdown' | 'manual' | 'routine';
};

export type RoutineSet = {
  durationSeconds: number;
  breakSeconds: number;
};

export type RoutineBlock = {
  id: number;
  habitId: number;
  habitName: string;
  sortOrder: number;
  notes: string | null;
  sets: RoutineSet[];
};

export type Routine = {
  id: number;
  name: string;
  blocks: RoutineBlock[];
  createdAt: string;
  updatedAt: string;
};

export type BuilderSet = RoutineSet & {
  clientId: string;
};

export type BuilderBlock = {
  clientId: string;
  habitId: number;
  habitName: string;
  notes: string | null;
  sets: BuilderSet[];
};

export type RoutineSessionStatus = 'active' | 'completed';
export type RoutineSessionPhase = 'idle' | 'set-running' | 'break-running' | 'summary';
export type ActiveTimerPhase = 'set' | 'break';

export type RoutineSessionSet = {
  id: number;
  sessionId: number;
  blockIndex: number;
  setIndex: number;
  habitId: number | null;
  habitNameSnapshot: string;
  notesSnapshot: string | null;
  plannedDurationSeconds: number;
  plannedBreakSeconds: number;
  actualDurationSeconds: number | null;
  startedAt: string | null;       // ISO
  completedAt: string | null;     // ISO
};

export type RoutineSessionActiveTimer = {
  routineSessionSetId: number;
  phase: ActiveTimerPhase;
  startTime: string;              // ISO
  targetDurationSeconds: number;  // both phases have a target
};

export type ActiveRoutineSession = {
  id: number;
  routineId: number | null;
  routineNameSnapshot: string;
  status: RoutineSessionStatus;
  startedAt: string;              // ISO
  finishedAt: string | null;      // ISO
  sets: RoutineSessionSet[];
  activeTimer: RoutineSessionActiveTimer | null;
};

export type RoutineSessionSummary = {
  routineNameSnapshot: string;
  startedAt: string;
  finishedAt: string;
  totalElapsedSeconds: number;
  totalActiveSeconds: number;
  completedSetCount: number;
  byHabit: Array<{ habitName: string; sets: number; totalSeconds: number }>;
};

export type HistoryRoutineGroup = {
  kind: 'routine';
  routineSessionId: number;
  routineNameSnapshot: string;
  startedAt: string;
  finishedAt: string;
  totalDurationSeconds: number;
  entries: HistoryEntry[];
};

export type HistoryListItem =
  | { kind: 'session'; entry: HistoryEntry }
  | HistoryRoutineGroup;
