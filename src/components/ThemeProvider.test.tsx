// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';

const STORAGE_KEY = 'logbro:theme';

function ThemeReader({ onRender }: { onRender: (ctx: ReturnType<typeof useTheme>) => void }) {
  const ctx = useTheme();
  onRender(ctx);
  return null;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light when no preference is stored', () => {
    let captured: ReturnType<typeof useTheme> | undefined;
    render(
      <ThemeProvider>
        <ThemeReader onRender={(ctx) => { captured = ctx; }} />
      </ThemeProvider>
    );
    expect(captured?.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reads stored dark preference on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    let captured: ReturnType<typeof useTheme> | undefined;
    render(
      <ThemeProvider>
        <ThemeReader onRender={(ctx) => { captured = ctx; }} />
      </ThemeProvider>
    );
    expect(captured?.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme persists and toggles the dark class', () => {
    let captured: ReturnType<typeof useTheme> | undefined;
    render(
      <ThemeProvider>
        <ThemeReader onRender={(ctx) => { captured = ctx; }} />
      </ThemeProvider>
    );
    act(() => { captured!.setTheme('dark'); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => { captured!.setTheme('light'); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
