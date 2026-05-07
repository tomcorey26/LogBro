export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  habits: {
    all: ['habits'] as const,
  },
  history: {
    all: ['history'] as const,
    list: (filters: { habitId?: string; range?: string; viewMode: string }) =>
      ['history', 'list', filters] as const,
  },
  rankings: {
    all: ['rankings'] as const,
  },
  routines: {
    all: ['routines'] as const,
    detail: (id: number) => ['routines', id] as const,
  },
  features: {
    all: ['features'] as const,
  },
  routineSession: {
    active: ['routineSession', 'active'] as const,
  },
};
