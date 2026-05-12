'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
};

const STORAGE_KEY = 'logbro:theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

// The pre-hydration script in app/layout.tsx sets the `dark` class on <html>
// before React hydrates. After that, `setTheme` is the only thing that
// changes the class, so we notify subscribers synchronously from there
// rather than observing the DOM — keeps updates inside React's act() scope.

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getClientSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function getServerSnapshot(): Theme {
  return 'light';
}

function setThemeImpl(next: Theme) {
  window.localStorage.setItem(STORAGE_KEY, next);
  document.documentElement.classList.toggle('dark', next === 'dark');
  for (const l of listeners) l();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeImpl }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
