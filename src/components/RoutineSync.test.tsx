// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { api } from '@/lib/api';
import { RoutineSync } from './RoutineSync';
import { useRoutineSessionStore } from '@/stores/routine-session-store';

const mockedApi = vi.mocked(api);

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// Build a session whose set timer has already expired by `expiredBySeconds`,
// so RoutineSync's replay-forward driver sees `complete-set` on the first tick.
function expiredSetSession(expiredBySeconds = 5) {
  const targetDurationSeconds = 60;
  const startTime = new Date(
    Date.now() - (targetDurationSeconds + expiredBySeconds) * 1000,
  ).toISOString();
  return {
    session: {
      id: 1,
      routineId: 1,
      routineNameSnapshot: 'Morning routine',
      status: 'active' as const,
      startedAt: startTime,
      finishedAt: null,
      sets: [
        {
          id: 100,
          sessionId: 1,
          blockIndex: 0,
          setIndex: 0,
          habitId: 7,
          habitNameSnapshot: 'Guitar',
          notesSnapshot: null,
          plannedDurationSeconds: targetDurationSeconds,
          plannedBreakSeconds: 30,
          actualDurationSeconds: null,
          startedAt: startTime,
          completedAt: null,
        },
      ],
      activeTimer: {
        routineSessionSetId: 100,
        phase: 'set' as const,
        startTime,
        targetDurationSeconds,
      },
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.clearAllMocks();
  useRoutineSessionStore.getState().reset();
  vi.stubGlobal('Notification', { permission: 'denied' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RoutineSync — replay-forward driver', () => {
  it('fires complete-set exactly once when the set timer has expired, even while the request is in flight', async () => {
    let completeCallCount = 0;
    // Hang the complete request forever — simulates a slow / never-resolving
    // server. If the driver re-fires while the first call is in flight, we'll
    // see completeCallCount climb past 1.
    const hangingComplete = new Promise(() => {});

    mockedApi.mockImplementation((url: string) => {
      if (url === '/api/routines/active') {
        return Promise.resolve(expiredSetSession()) as Promise<unknown>;
      }
      if (url.endsWith('/complete')) {
        completeCallCount++;
        return hangingComplete as Promise<unknown>;
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    renderHook(() => RoutineSync(), { wrapper: createWrapper() });

    // Wait for the active-routine fetch to resolve and the effect to mount.
    await vi.waitFor(() => {
      expect(completeCallCount).toBeGreaterThanOrEqual(1);
    });

    // Advance well past several tick intervals (1s each) while the mutation
    // hangs. If the bug regressed, this is where duplicates would pile up.
    await vi.advanceTimersByTimeAsync(10_000);

    expect(completeCallCount).toBe(1);
  });
});
