# Theming Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the warm cream + terracotta palette ("Claude-like") with a light-default indigo-purple palette, centralize all colors as Tailwind v4 design tokens in `globals.css`, add a dark-mode toggle, and prevent regressions with a lint guardrail.

**Architecture:** Tailwind v4 `@theme inline` already maps CSS custom properties → utilities. We extend that with new semantic tokens (`success`, `info`, `rank-gold`, `rank-silver`, `rank-bronze`) so components can use `bg-success` / `text-info` instead of `bg-emerald-500` / `text-sky-500`. A small in-house `ThemeProvider` (no external deps) toggles a `dark` class on `<html>` with localStorage persistence and a no-flash inline script.

**Tech Stack:** Tailwind v4, Next.js 16 App Router, React 19, shadcn/ui, vitest + jsdom + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-06-theming-refresh-design.md`

---

## File Structure

**Modify:**
- `src/app/globals.css` — palette tokens (`:root`, `.dark`) + new semantic tokens registered in `@theme inline`.
- `src/components/RankingsView.tsx` — rank colors → tokens.
- `src/components/ActiveRoutineView.tsx` — sky → info.
- `src/components/ActiveRoutineSetRow.tsx` — emerald/sky → success/info.
- `src/components/RoutineActionBar.tsx` — emerald/sky utilities + hex shadows → tokens.
- `src/app/layout.tsx` — add no-flash inline script + render `ThemeProvider`.
- `src/app/(app)/layout.tsx` — add `<ThemeToggle />` to the header.
- `package.json` — add `lint:colors` script; chain into `lint`.

**Create:**
- `src/components/ThemeProvider.tsx` — context + provider (`light` | `dark` | `system`).
- `src/components/ThemeProvider.test.tsx` — vitest tests for the provider.
- `src/components/ThemeToggle.tsx` — single icon button cycling sun → moon → monitor.
- `scripts/check-colors.mjs` — Node script flagging hard-coded color utilities & literals.

**Don't touch:**
- `--chart-1..5` tokens (no consumers in current views).
- Existing landing page colors beyond palette tokens (already token-driven).

---

## Task 1: Replace base palette in globals.css

**Files:**
- Modify: `src/app/globals.css:51-86` (`:root`), `src/app/globals.css:88-121` (`.dark`)

- [ ] **Step 1: Replace `:root` block with new light palette**

Replace the contents of the `:root` block (lines 51-86) with:

```css
:root {
  --radius: 0.875rem;
  --background: hsl(240 20% 99%);
  --foreground: hsl(240 25% 12%);
  --card: hsl(240 20% 97%);
  --card-foreground: hsl(240 25% 12%);
  --popover: hsl(240 20% 99%);
  --popover-foreground: hsl(240 25% 12%);
  --primary: hsl(239 84% 67%);
  --primary-foreground: hsl(0 0% 100%);
  --secondary: hsl(240 15% 94%);
  --secondary-foreground: hsl(240 25% 12%);
  --muted: hsl(240 15% 94%);
  --muted-foreground: hsl(240 10% 45%);
  --accent: hsl(239 84% 95%);
  --accent-foreground: hsl(239 84% 35%);
  --destructive: hsl(0 84% 60%);
  --destructive-foreground: hsl(0 0% 98%);
  --border: hsl(240 15% 90%);
  --input: hsl(240 15% 90%);
  --input-background: hsl(240 20% 99%);
  --ring: hsl(239 84% 67%);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: hsl(240 20% 99%);
  --sidebar-foreground: hsl(240 25% 12%);
  --sidebar-primary: hsl(239 84% 67%);
  --sidebar-primary-foreground: hsl(0 0% 100%);
  --sidebar-accent: hsl(240 15% 94%);
  --sidebar-accent-foreground: hsl(240 25% 12%);
  --sidebar-border: hsl(240 15% 90%);
  --sidebar-ring: hsl(239 84% 67%);
  --success: hsl(152 60% 42%);
  --success-foreground: hsl(0 0% 100%);
  --info: hsl(199 89% 48%);
  --info-foreground: hsl(0 0% 100%);
  --rank-gold: hsl(45 95% 55%);
  --rank-silver: hsl(220 8% 65%);
  --rank-bronze: hsl(25 70% 50%);
}
```

- [ ] **Step 2: Replace `.dark` block with new dark palette**

Replace the contents of the `.dark` block (lines 88-121) with:

```css
.dark {
  --background: hsl(240 25% 8%);
  --foreground: hsl(240 15% 92%);
  --card: hsl(240 22% 12%);
  --card-foreground: hsl(240 15% 92%);
  --popover: hsl(240 22% 12%);
  --popover-foreground: hsl(240 15% 92%);
  --primary: hsl(239 90% 72%);
  --primary-foreground: hsl(240 25% 8%);
  --secondary: hsl(240 18% 18%);
  --secondary-foreground: hsl(240 15% 92%);
  --muted: hsl(240 18% 18%);
  --muted-foreground: hsl(240 10% 65%);
  --accent: hsl(239 50% 22%);
  --accent-foreground: hsl(239 90% 88%);
  --destructive: hsl(0 62% 50%);
  --destructive-foreground: hsl(0 0% 98%);
  --border: hsl(240 18% 22%);
  --input: hsl(240 18% 22%);
  --input-background: hsl(240 22% 14%);
  --ring: hsl(239 90% 72%);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: hsl(240 22% 10%);
  --sidebar-foreground: hsl(240 15% 92%);
  --sidebar-primary: hsl(239 90% 72%);
  --sidebar-primary-foreground: hsl(240 25% 8%);
  --sidebar-accent: hsl(240 18% 18%);
  --sidebar-accent-foreground: hsl(240 15% 92%);
  --sidebar-border: hsl(240 18% 22%);
  --sidebar-ring: hsl(239 90% 72%);
  --success: hsl(152 55% 55%);
  --success-foreground: hsl(240 25% 8%);
  --info: hsl(199 89% 60%);
  --info-foreground: hsl(240 25% 8%);
  --rank-gold: hsl(45 95% 65%);
  --rank-silver: hsl(220 8% 75%);
  --rank-bronze: hsl(25 70% 60%);
}
```

- [ ] **Step 3: Register the new semantic tokens in `@theme inline`**

In the `@theme inline { ... }` block (`src/app/globals.css:7-49`), append the seven new color mappings. Add them after the existing `--color-card: var(--card);` line (i.e. before `--radius-sm`):

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-rank-gold: var(--rank-gold);
  --color-rank-silver: var(--rank-silver);
  --color-rank-bronze: var(--rank-bronze);
```

- [ ] **Step 4: Run dev server to verify no parse errors**

```bash
npm run dev
```

Expected: server starts on `http://localhost:3000` with no Tailwind/PostCSS warnings. The app renders with the new indigo-purple palette (some components — RoutineActionBar, ActiveRoutineSetRow, RankingsView — will still show emerald/sky/yellow colors; those get migrated in later tasks).

Press Ctrl+C to stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(theme): swap palette to indigo-purple, add semantic tokens

Replaces cream/terracotta with light-default indigo + parallel dark
palette. Registers --color-success, --color-info, --color-rank-{gold,
silver,bronze} as Tailwind v4 utilities. Components still use legacy
emerald/sky/yellow classes — migrated in following commits.
EOF
)"
```

---

## Task 2: Migrate RankingsView to rank tokens

**Files:**
- Modify: `src/components/RankingsView.tsx:8-12`

- [ ] **Step 1: Replace the RANK_COLORS map**

Replace lines 8-12:

```tsx
const RANK_COLORS: Record<number, string> = {
  1: 'text-rank-gold',
  2: 'text-rank-silver',
  3: 'text-rank-bronze',
};
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit -- RankingsView 2>&1 | tail -20
```

Expected: tests pass (no `RankingsView.test.tsx` exists; vitest reports "No test files found matching" or runs zero — both acceptable). If any test in the suite breaks, fix it before continuing.

- [ ] **Step 3: Manual smoke check**

```bash
npm run dev
```

Open `http://localhost:3000/rankings`. Verify the #1 medal color is gold-yellow, #2 is silver-gray, #3 is bronze-amber. Both light and dark modes (toggle the `dark` class on `<html>` via DevTools — toggle UI ships in Task 8).

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/RankingsView.tsx
git commit -m "refactor(rankings): use rank-{gold,silver,bronze} tokens"
```

---

## Task 3: Migrate ActiveRoutineView sky → info

**Files:**
- Modify: `src/components/ActiveRoutineView.tsx:107-113`

- [ ] **Step 1: Replace the dotClass ternary**

Replace lines 108-113:

```tsx
const dotClass =
  phase === 'set'
    ? 'bg-primary animate-pulse'
    : phase === 'break'
      ? 'bg-info animate-pulse'
      : 'bg-muted-foreground/60';
```

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit -- ActiveRoutineView 2>&1 | tail -20
```

Expected: existing `ActiveRoutineView.test.tsx` passes. If a test asserts on the literal `bg-sky-500` class, update it to `bg-info` (these tests check rendering, not visual styling — class string mismatches will surface).

- [ ] **Step 3: Commit**

```bash
git add src/components/ActiveRoutineView.tsx
git commit -m "refactor(active-routine-view): break dot uses info token"
```

If a test was updated, include it in the commit:

```bash
git add src/components/ActiveRoutineView.tsx src/components/ActiveRoutineView.test.tsx
git commit -m "refactor(active-routine-view): break dot uses info token"
```

---

## Task 4: Migrate ActiveRoutineSetRow emerald/sky → success/info

**Files:**
- Modify: `src/components/ActiveRoutineSetRow.tsx:48-49`, `:54-56`, `:67`, `:107`, `:142`, `:148`, `:157`, `:162`

- [ ] **Step 1: Replace `rowClasses` break and completed lines**

In `src/components/ActiveRoutineSetRow.tsx`, replace lines 48-49 with:

```tsx
    isBreak ? 'bg-info/15 border-l-4 border-info ring-1 ring-info/30' : '',
    isCompleted ? 'bg-success/10 border-l-4 border-success/70 opacity-90' : '',
```

- [ ] **Step 2: Replace `setNumberCircleClass` ternary (lines 53-57)**

```tsx
  const setNumberCircleClass = isCompleted
    ? 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-success/20 text-success text-[10px] font-mono font-medium relative'
    : isBreak
      ? 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-info/20 text-info text-[10px] font-mono font-medium relative'
      : 'inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-medium relative';
```

- [ ] **Step 3: Replace `bg-sky-500 animate-pulse` on line 67**

```tsx
          <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-info animate-pulse" />
```

- [ ] **Step 4: Replace break-running label classes (line 107)**

```tsx
        <span className="inline-flex items-center gap-1.5 text-base font-mono font-bold text-info">
```

- [ ] **Step 5: Replace skip-break button classes (line 142)**

```tsx
            className="bg-info hover:bg-info/90 text-info-foreground"
```

- [ ] **Step 6: Replace completed-checkmark span (line 148)**

```tsx
          <span aria-label="Set completed" className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-success text-success-foreground">
```

- [ ] **Step 7: Replace progress-bar background and fill (lines 157, 162)**

Line 157:

```tsx
            isBreak ? 'bg-info/20' : 'bg-primary/20'
```

Line 162:

```tsx
              isBreak ? 'bg-info' : 'bg-primary'
```

- [ ] **Step 8: Run unit tests**

```bash
npm run test:unit -- ActiveRoutineSetRow 2>&1 | tail -30
```

Expected: existing `ActiveRoutineSetRow.test.tsx` passes. If a test asserts on a literal `bg-sky-*` / `bg-emerald-*` class, update the assertion to the new token (`bg-info` / `bg-success`). Visual structure assertions should not change.

- [ ] **Step 9: Commit**

```bash
git add src/components/ActiveRoutineSetRow.tsx
git commit -m "refactor(routine-set-row): use success/info tokens"
```

If a test file was edited:

```bash
git add src/components/ActiveRoutineSetRow.tsx src/components/ActiveRoutineSetRow.test.tsx
git commit -m "refactor(routine-set-row): use success/info tokens"
```

---

## Task 5: Migrate RoutineActionBar emerald/sky → success/info

**Files:**
- Modify: `src/components/RoutineActionBar.tsx:70`, `:74`, `:76`, `:88`, `:160`, `:166`

- [ ] **Step 1: Replace the all-complete container className (line 70)**

```tsx
        className="w-full px-4 py-3 bg-success/15 border-t border-success/40 flex items-center justify-between hover:bg-success/20 transition-colors cursor-pointer"
```

- [ ] **Step 2: Replace the Trophy icon className (line 74)**

```tsx
          <Trophy className="h-4 w-4 text-success shrink-0" />
```

- [ ] **Step 3: Replace the "Routine complete" span className (line 76)**

```tsx
            <span className="font-semibold text-sm text-success">
```

- [ ] **Step 4: Replace the Finish PressableButton className (line 88)**

```tsx
          className="bg-success hover:bg-success/90 text-success-foreground shadow-[0_5px_0_0_color-mix(in_srgb,var(--color-success)_70%,black)] active:shadow-none active:translate-y-1.25"
```

- [ ] **Step 5: Replace the break timer span className (line 160)**

```tsx
          <span className="font-mono text-sm text-info font-semibold">{displayTime}</span>
```

- [ ] **Step 6: Replace the skip-break PressableButton className (line 166)**

```tsx
            className="bg-info hover:bg-info/90 text-info-foreground shadow-[0_5px_0_0_color-mix(in_srgb,var(--color-info)_70%,black)] active:shadow-none active:translate-y-1.25"
```

- [ ] **Step 7: Run unit tests**

```bash
npm run test:unit -- RoutineActionBar 2>&1 | tail -30
```

Expected: existing `RoutineActionBar.test.tsx` passes. Update any literal-class assertions if necessary.

- [ ] **Step 8: Manual smoke check (light + dark)**

```bash
npm run dev
```

Trigger an active routine session: start a set (verify primary indigo), let it complete and enter break (verify info-blue progress bar + dot + button), complete all sets (verify success-green action bar + Finish button shadow). Toggle `dark` class on `<html>` in DevTools and re-verify.

Stop the server.

- [ ] **Step 9: Commit**

```bash
git add src/components/RoutineActionBar.tsx
git commit -m "refactor(routine-action-bar): use success/info tokens, drop hex shadows"
```

If a test file was edited:

```bash
git add src/components/RoutineActionBar.tsx src/components/RoutineActionBar.test.tsx
git commit -m "refactor(routine-action-bar): use success/info tokens, drop hex shadows"
```

---

## Task 6: Add ThemeProvider with TDD

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Create: `src/components/ThemeProvider.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `src/components/ThemeProvider.test.tsx`:

```tsx
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
    let captured: { theme: string } | undefined;
    render(
      <ThemeProvider>
        <ThemeReader onRender={(ctx) => { captured = ctx; }} />
      </ThemeProvider>
    );
    expect(captured?.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reads stored preference on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    let captured: { theme: string } | undefined;
    render(
      <ThemeProvider>
        <ThemeReader onRender={(ctx) => { captured = ctx; }} />
      </ThemeProvider>
    );
    expect(captured?.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme persists and applies the dark class', () => {
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

  it('setTheme("system") follows prefers-color-scheme', () => {
    const mql = {
      matches: true,
      media: '(prefers-color-scheme: dark)',
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
    window.matchMedia = () => mql;

    let captured: ReturnType<typeof useTheme> | undefined;
    render(
      <ThemeProvider>
        <ThemeReader onRender={(ctx) => { captured = ctx; }} />
      </ThemeProvider>
    );
    act(() => { captured!.setTheme('system'); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:unit -- ThemeProvider 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module './ThemeProvider'" or similar.

- [ ] **Step 3: Write the minimal ThemeProvider implementation**

Create `src/components/ThemeProvider.tsx`:

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
};

const STORAGE_KEY = 'logbro:theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): Theme {
  if (typeof window === 'undefined') return 'light';
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === 'dark' || value === 'system' ? value : 'light';
}

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStored());

  useEffect(() => {
    applyClass(resolve(theme));
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyClass(resolve('system'));
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:unit -- ThemeProvider 2>&1 | tail -20
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ThemeProvider.tsx src/components/ThemeProvider.test.tsx
git commit -m "feat(theme): add ThemeProvider with light/dark/system + localStorage"
```

---

## Task 7: Wire ThemeProvider + no-flash script into root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update root layout to inject the no-flash script and wrap children**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { APP_NAME } from "@/data/app";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Track what you practice',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const NO_FLASH_SCRIPT = `(function() {
  try {
    var stored = localStorage.getItem('logbro:theme');
    var theme = stored === 'dark' || stored === 'system' ? stored : 'light';
    var resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Run unit tests to ensure nothing regressed**

```bash
npm run test:unit 2>&1 | tail -20
```

Expected: full suite passes (existing tests unaffected; ThemeProvider tests still pass).

- [ ] **Step 3: Manual smoke check — no FOUC**

```bash
npm run dev
```

In DevTools console, run `localStorage.setItem('logbro:theme', 'dark')`, hard-reload (Cmd+Shift+R). The page should render in dark mode immediately — no white flash. Run `localStorage.setItem('logbro:theme', 'light')`, hard-reload, confirm light mode with no dark flash.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(theme): wire ThemeProvider + no-flash script in root layout"
```

---

## Task 8: Add ThemeToggle UI to app header

**Files:**
- Create: `src/components/ThemeToggle.tsx`
- Modify: `src/app/(app)/layout.tsx:24-32` (header right side)

- [ ] **Step 1: Create the toggle component**

Create `src/components/ThemeToggle.tsx`:

```tsx
'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';

const NEXT: Record<'light' | 'dark' | 'system', 'light' | 'dark' | 'system'> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICON = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const LABEL = {
  light: 'Switch to dark mode',
  dark: 'Switch to system mode',
  system: 'Switch to light mode',
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme];
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={LABEL[theme]}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
```

- [ ] **Step 2: Add the toggle to the (app) header**

In `src/app/(app)/layout.tsx`, add the import and the toggle inside the existing right-side header `div`. After:

```tsx
import { LogoutButton } from "@/components/LogoutButton";
```

Add:

```tsx
import { ThemeToggle } from "@/components/ThemeToggle";
```

Then change lines 24-32 from:

```tsx
          <div className="flex items-center gap-1">
            <Link
              href="/account"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Account
            </Link>
            <LogoutButton />
          </div>
```

to:

```tsx
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/account"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Account
            </Link>
            <LogoutButton />
          </div>
```

- [ ] **Step 3: Manual smoke check — toggle works end to end**

```bash
npm run dev
```

Open `http://localhost:3000/routines` (log in if needed). Click the sun icon — page goes dark, icon becomes moon. Click again — icon becomes monitor (system); confirm `localStorage.getItem('logbro:theme')` is `'system'` in DevTools. Click again — back to light. Hard-reload after each — preference persists with no flash.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThemeToggle.tsx src/app/(app)/layout.tsx
git commit -m "feat(theme): add ThemeToggle button in app header"
```

---

## Task 9: Add lint:colors guardrail script

**Files:**
- Create: `scripts/check-colors.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

Create `scripts/check-colors.mjs`:

```js
#!/usr/bin/env node
// Fails when hard-coded color utility classes or color literals appear
// outside src/app/globals.css. Run via `npm run lint:colors`.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const ALLOWLIST = new Set([join('src', 'app', 'globals.css')]);

const COLOR_NAMES = [
  'red','orange','amber','yellow','lime','green','emerald','teal','cyan',
  'sky','blue','indigo','violet','purple','fuchsia','pink','rose',
  'slate','gray','zinc','neutral','stone',
];
const PROPS = [
  'bg','text','border','ring','fill','stroke','from','to','via',
  'outline','divide','shadow','placeholder','caret','accent',
];
const utilityRegex = new RegExp(
  String.raw`\b(${PROPS.join('|')})-(${COLOR_NAMES.join('|')})-\d`,
);
const hexRegex = /#[0-9a-fA-F]{6}\b/;
const hslRgbRegex = /\b(hsl|hsla|rgb|rgba)\s*\(/;

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) yield path;
  }
}

const violations = [];

for await (const path of walk(SRC)) {
  const rel = relative(ROOT, path).split(sep).join('/');
  const allowKey = ALLOWLIST.has(relative(ROOT, path)) || ALLOWLIST.has(rel.split('/').join(sep));
  if (allowKey) continue;
  const text = await readFile(path, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (utilityRegex.test(line)) {
      violations.push({ path: rel, line: i + 1, kind: 'utility', snippet: line.trim() });
    }
    if (hexRegex.test(line)) {
      violations.push({ path: rel, line: i + 1, kind: 'hex', snippet: line.trim() });
    }
    if (hslRgbRegex.test(line)) {
      violations.push({ path: rel, line: i + 1, kind: 'hsl/rgb', snippet: line.trim() });
    }
  });
}

if (violations.length === 0) {
  console.log('lint:colors — no hard-coded colors found.');
  process.exit(0);
}

console.error(`lint:colors — ${violations.length} violation(s):`);
for (const v of violations) {
  console.error(`  ${v.path}:${v.line} [${v.kind}] ${v.snippet}`);
}
console.error(
  '\nDefine the color in src/app/globals.css (as a token) and use a Tailwind utility derived from it.',
);
process.exit(1);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to the `scripts` block:

```json
"lint:colors": "node scripts/check-colors.mjs",
```

Also extend the existing `lint` script. Change:

```json
"lint": "eslint",
```

to:

```json
"lint": "eslint && node scripts/check-colors.mjs",
```

- [ ] **Step 3: Run the script to verify it passes on the cleaned codebase**

```bash
npm run lint:colors
```

Expected output:

```
lint:colors — no hard-coded colors found.
```

If anything is reported, fix it (it means a previous task missed a replacement).

- [ ] **Step 4: Run a deliberate-failure check**

Temporarily add `<div className="bg-emerald-500" />` to the bottom of `src/components/RankingsView.tsx`. Run:

```bash
npm run lint:colors
```

Expected: exit code 1, output names `src/components/RankingsView.tsx` with the offending line. Remove the test line.

- [ ] **Step 5: Run full lint**

```bash
npm run lint
```

Expected: eslint passes, then `lint:colors` passes.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-colors.mjs package.json
git commit -m "feat(theme): add lint:colors guardrail script"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run full unit test suite**

```bash
npm run test:unit 2>&1 | tail -20
```

Expected: every test passes.

- [ ] **Step 2: Run e2e tests**

```bash
npm run test:e2e 2>&1 | tail -30
```

Expected: every test passes. If any test asserts on a specific old color string (e.g. screenshot or class assertion), update it to match the new tokens — those changes belong with the migration commits.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 4: Manual cross-screen smoke check**

```bash
npm run dev
```

Walk through each route in both modes (toggle via the new header button):
- `/routines` — list, primary buttons indigo.
- An active routine: start → break → complete → finish — verify primary, info (break), success (complete) tokens render correctly.
- `/habits` — habits list.
- `/history` — history view.
- `/rankings` — gold/silver/bronze medals.
- `/account` — account page.

Hard-reload each in dark mode — no FOUC.

Stop the server.

- [ ] **Step 5: Final commit / push readiness check**

```bash
git status && git log --oneline -10
```

Expected: clean working tree; the last 9 commits are the theming refresh tasks. Plan complete.

---

## Coverage Self-Check

Spec → plan mapping:
- Light + dark palette values → Task 1 (steps 1-3)
- New semantic tokens (`success`, `info`, rank tokens) → Task 1 (step 3)
- Component migrations (4 files) → Tasks 2, 3, 4, 5
- Dark-mode toggle (provider, no-flash, UI) → Tasks 6, 7, 8
- Lint guardrail → Task 9
- Acceptance criteria (no hard-coded colors, single-file palette swap, both modes work, FOUC-free, test suites green) → Task 9 + Task 10

No gaps. No placeholders. Type names (`Theme`, `STORAGE_KEY`, `useTheme`) and class names (`bg-info`, `bg-success`, `text-rank-gold`) are consistent across tasks.
