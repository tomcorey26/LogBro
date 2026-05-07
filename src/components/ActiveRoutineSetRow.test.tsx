// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ActiveRoutineSetRow } from './ActiveRoutineSetRow';
import type { RoutineSessionSet } from '@/lib/types';

const baseSet: RoutineSessionSet = {
  id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar',
  notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30,
  actualDurationSeconds: null, startedAt: null, completedAt: null,
};

describe('ActiveRoutineSetRow', () => {
  it('renders Start when upcoming and no other set running', () => {
    const onStart = vi.fn();
    render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="upcoming-idle" onStart={onStart} onEnd={() => {}} onSkipBreak={() => {}} onPatch={() => {}} displayTime="00:01:00" />);
    expect(screen.getByRole('button', { name: /start/i })).toBeEnabled();
  });

  it('disables Start when another set is running', () => {
    render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="upcoming-disabled" onStart={() => {}} onEnd={() => {}} onSkipBreak={() => {}} onPatch={() => {}} displayTime="00:01:00" />);
    expect(screen.getByRole('button', { name: /start/i })).toBeDisabled();
  });

  it('shows End when running', async () => {
    const onEnd = vi.fn();
    render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="running" onStart={() => {}} onEnd={onEnd} onSkipBreak={() => {}} onPatch={() => {}} displayTime="00:00:30" />);
    await userEvent.click(screen.getByRole('button', { name: /end/i }));
    expect(onEnd).toHaveBeenCalled();
  });

  it('shows checkmark when completed', () => {
    const completed = { ...baseSet, actualDurationSeconds: 60, startedAt: 'iso', completedAt: 'iso' };
    render(<ActiveRoutineSetRow set={completed} setNumber={1} state="completed" onStart={() => {}} onEnd={() => {}} onSkipBreak={() => {}} onPatch={() => {}} displayTime="" />);
    expect(screen.getByLabelText(/completed/i)).toBeInTheDocument();
  });

  it('calls onPatch when upcoming-idle duration stepper is incremented', async () => {
    const onPatch = vi.fn();
    render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="upcoming-idle" displayTime="" onStart={() => {}} onEnd={() => {}} onSkipBreak={() => {}} onPatch={onPatch} />);
    await userEvent.click(screen.getByLabelText(/Increase Set 1 duration/i));
    expect(onPatch).toHaveBeenCalledWith({ plannedDurationSeconds: 120 });
  });
});
