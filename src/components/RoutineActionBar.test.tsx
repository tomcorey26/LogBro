// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRoutineSessionStore } from '@/stores/routine-session-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

vi.mock('@/hooks/use-active-routine', () => ({
  useFinishRoutineSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useStartSet: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useSkipBreak: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useCompleteSet: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

import { RoutineActionBar } from './RoutineActionBar';

describe('RoutineActionBar', () => {
  it('renders nothing when inactive', () => {
    useRoutineSessionStore.getState().reset();
    const { container } = render(<RoutineActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it('shows habit name + set X of Y when running', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30, actualDurationSeconds: null, startedAt: '2026-05-02T00:00:00Z', completedAt: null },
        { id: 2, sessionId: 1, blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: null, startedAt: null, completedAt: null },
      ],
      activeTimer: { routineSessionSetId: 1, phase: 'set', startTime: '2026-05-02T00:00:00Z', targetDurationSeconds: 60 },
    });
    render(<RoutineActionBar />);
    expect(screen.getByText(/Guitar/)).toBeInTheDocument();
    expect(screen.getByText(/Set 1 of 2/i)).toBeInTheDocument();
  });

  it('shows a Play button when idle (no active timer, sets remaining)', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: 60, startedAt: '2026-05-02T00:00:00Z', completedAt: '2026-05-02T00:01:00Z' },
        { id: 2, sessionId: 1, blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: null, startedAt: null, completedAt: null },
      ],
      activeTimer: null,
    });
    render(<RoutineActionBar />);
    expect(screen.getByRole('button', { name: /start set 2/i })).toBeInTheDocument();
    expect(screen.getByText(/Ready for set 2/i)).toBeInTheDocument();
  });

  it('shows an End-set button when a set is running', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: null, startedAt: '2026-05-02T00:00:00Z', completedAt: null },
      ],
      activeTimer: { routineSessionSetId: 1, phase: 'set', startTime: '2026-05-02T00:00:00Z', targetDurationSeconds: 60 },
    });
    render(<RoutineActionBar />);
    expect(screen.getByRole('button', { name: /end set/i })).toBeInTheDocument();
  });

  it('shows a Skip button when a break is running', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30, actualDurationSeconds: 60, startedAt: '2026-05-02T00:00:00Z', completedAt: '2026-05-02T00:01:00Z' },
        { id: 2, sessionId: 1, blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: null, startedAt: null, completedAt: null },
      ],
      activeTimer: { routineSessionSetId: 1, phase: 'break', startTime: '2026-05-02T00:01:00Z', targetDurationSeconds: 30 },
    });
    render(<RoutineActionBar />);
    expect(screen.getByRole('button', { name: /skip break/i })).toBeInTheDocument();
  });

  it('during break, label points to the upcoming (not just-completed) set', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30, actualDurationSeconds: 60, startedAt: '2026-05-02T00:00:00Z', completedAt: '2026-05-02T00:01:00Z' },
        { id: 2, sessionId: 1, blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: null, startedAt: null, completedAt: null },
        { id: 3, sessionId: 1, blockIndex: 0, setIndex: 2, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: null, startedAt: null, completedAt: null },
      ],
      // Timer's routineSessionSetId == 1 (the just-completed set), but during
      // break we want the UI to advance to set 2.
      activeTimer: { routineSessionSetId: 1, phase: 'break', startTime: '2026-05-02T00:01:00Z', targetDurationSeconds: 30 },
    });
    render(<RoutineActionBar />);
    expect(screen.getByText(/Set 2 of 3/i)).toBeInTheDocument();
  });

  it('during break of the last set, label still shows that set (no next)', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30, actualDurationSeconds: 60, startedAt: '2026-05-02T00:00:00Z', completedAt: '2026-05-02T00:01:00Z' },
        { id: 2, sessionId: 1, blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30, actualDurationSeconds: 60, startedAt: '2026-05-02T00:01:30Z', completedAt: '2026-05-02T00:02:30Z' },
      ],
      // All sets complete, but break of last set is still running.
      activeTimer: { routineSessionSetId: 2, phase: 'break', startTime: '2026-05-02T00:02:30Z', targetDurationSeconds: 30 },
    });
    render(<RoutineActionBar />);
    expect(screen.getByText(/Set 2 of 2/i)).toBeInTheDocument();
  });

  it('shows "Routine complete" + Finish button when every set is completed', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: 60, startedAt: '2026-05-02T00:00:00Z', completedAt: '2026-05-02T00:01:00Z' },
        { id: 2, sessionId: 1, blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: 60, startedAt: '2026-05-02T00:01:00Z', completedAt: '2026-05-02T00:02:00Z' },
      ],
      activeTimer: null,
    });
    render(<RoutineActionBar />);
    expect(screen.getByText(/routine complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^finish$/i })).toBeInTheDocument();
  });
});
