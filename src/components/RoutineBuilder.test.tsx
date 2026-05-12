// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRoutineBuilder } from '@/hooks/use-routine-builder';
import { RoutineBuilder } from './RoutineBuilder';
import type { Habit, Routine } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));
vi.mock('@/hooks/use-navigation-guard', () => ({
  useNavigationGuard: () => {},
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/hooks/use-habits', () => ({
  useHabits: (initial: Habit[]) => ({ data: initial }),
  useAddHabit: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/use-routines', () => ({
  useCreateRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const HABITS: Habit[] = [
  { id: 1, name: 'Guitar', todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
  { id: 2, name: 'Reading', todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
  { id: 3, name: 'Pushups', todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
];

const ROUTINE: Routine = {
  id: 7,
  name: 'Evening',
  blocks: [
    {
      id: 100,
      habitId: 1,
      habitName: 'Guitar',
      sortOrder: 0,
      notes: 'Scales',
      sets: [
        { durationSeconds: 480, breakSeconds: 60 },
        { durationSeconds: 480, breakSeconds: 60 },
      ],
    },
  ],
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

function Harness({ routine = ROUTINE }: { routine?: Routine }) {
  const builder = useRoutineBuilder('edit', routine);
  return (
    <RoutineBuilder mode="edit" initialHabits={HABITS} builder={builder} />
  );
}

describe('RoutineBuilder — Replace habit flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Replace habit opens the picker with the replace title', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));

    expect(
      await screen.findByRole('heading', { name: /^replace "guitar"$/i })
    ).toBeInTheDocument();
  });

  it('picking a habit opens the config form prefilled with current block values', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));

    expect(await screen.findByRole('heading', { name: /^reading$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Scales');
    const setsInput = screen.getByLabelText('Number of Sets') as HTMLInputElement;
    expect(setsInput.value).toBe('2');
    const durationInput = screen.getByLabelText('Duration in minutes') as HTMLInputElement;
    expect(durationInput.value).toBe('8');
    const breakInput = screen.getByLabelText('Break in minutes') as HTMLInputElement;
    expect(breakInput.value).toBe('1');
    expect(screen.getByRole('button', { name: /^replace$/i })).toBeInTheDocument();
  });

  it('submitting Replace swaps the block in place', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));
    await user.click(await screen.findByRole('button', { name: /^replace$/i }));

    await waitFor(() => {
      // Wait for the dialog (h2 config form heading) to close
      expect(screen.queryByRole('heading', { level: 2, name: /^reading$/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 3, name: /reading/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: /guitar/i })).not.toBeInTheDocument();
  });

  it('cancelling Replace from the config form leaves the block unchanged', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));
    // Cancel goes back to the list; press Escape to close the picker entirely
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }));
    await user.keyboard('{Escape}');

    expect(await screen.findByRole('heading', { level: 3, name: /guitar/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: /reading/i })).not.toBeInTheDocument();
  });

  it('no state leak: Replace prefill does not bleed into next Add flow', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    // Start Replace, walk into the prefilled form, then cancel and close the picker.
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));
    // Cancel goes back to the list; press Escape to fully close the picker
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }));
    await user.keyboard('{Escape}');

    // Now open Add Habits and pick a habit.
    await user.click(screen.getByRole('button', { name: /add habits/i }));
    await user.click(await screen.findByRole('button', { name: /^pushups$/i }));

    // Form should show defaults, not the leaked Replace values.
    const setsInput = screen.getByLabelText('Number of Sets') as HTMLInputElement;
    expect(setsInput.value).toBe('3'); // default
    const durationInput = screen.getByLabelText('Duration in minutes') as HTMLInputElement;
    expect(durationInput.value).toBe('25'); // default
    const breakInput = screen.getByLabelText('Break in minutes') as HTMLInputElement;
    expect(breakInput.value).toBe('5'); // default
    expect(screen.getByLabelText(/notes/i)).toHaveValue(''); // default
    expect(screen.getByRole('button', { name: /add to routine/i })).toBeInTheDocument();
  });
});
