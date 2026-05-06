// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRoutineSessionStore } from '@/stores/routine-session-store';

const discardMutateAsync = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/hooks/use-active-routine', () => ({
  useDiscardRoutineSession: () => ({ mutateAsync: discardMutateAsync, isPending: false }),
  useFinishRoutineSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useStartSet: () => ({ mutate: vi.fn(), isPending: false }),
  useCompleteSet: () => ({ mutate: vi.fn(), isPending: false }),
  usePatchSet: () => ({ mutate: vi.fn(), isPending: false }),
  useSkipBreak: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { toast } from 'sonner';
import { ActiveRoutineView } from './ActiveRoutineView';

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function hydrateActive() {
  useRoutineSessionStore.getState().hydrate({
    id: 1, routineId: 1, routineNameSnapshot: 'Morning', status: 'active',
    startedAt: '', finishedAt: null, sets: [], activeTimer: null,
  });
}

describe('ActiveRoutineView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Discard and Finish buttons in active mode', () => {
    hydrateActive();
    renderWithQuery(<ActiveRoutineView />);
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
  });

  it('shows toast.error if discard mutation rejects', async () => {
    discardMutateAsync.mockRejectedValueOnce(new Error('Network'));
    hydrateActive();
    renderWithQuery(<ActiveRoutineView />);

    // Open the discard dialog from the toolbar.
    await userEvent.click(screen.getByRole('button', { name: /discard/i }));
    // Dialog confirm appears in a portal and uses role="alertdialog".
    const dialog = await screen.findByRole('alertdialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /^discard$/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/discard/i));
    });
  });
});
