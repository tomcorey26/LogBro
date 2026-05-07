import { create } from 'zustand';
import type { ActiveRoutineSession, RoutineSessionSummary } from '@/lib/types';

type Mode = 'inactive' | 'active' | 'summary';

type State = {
  session: ActiveRoutineSession | null;
  summary: RoutineSessionSummary | null;
  displayTime: string;
  mode: Mode;
  hydrate: (session: ActiveRoutineSession | null) => void;
  setSummary: (summary: RoutineSessionSummary | null) => void;
  setDisplayTime: (time: string) => void;
  reset: () => void;
};

export const useRoutineSessionStore = create<State>((set, get) => ({
  session: null,
  summary: null,
  displayTime: '00:00:00',
  mode: 'inactive',
  hydrate: (session) =>
    set({ session, mode: session ? 'active' : get().summary ? 'summary' : 'inactive' }),
  setSummary: (summary) =>
    set({ summary, mode: summary ? 'summary' : get().session ? 'active' : 'inactive' }),
  setDisplayTime: (time) => set({ displayTime: time }),
  reset: () => set({ session: null, summary: null, displayTime: '00:00:00', mode: 'inactive' }),
}));
