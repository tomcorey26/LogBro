# Theming Refresh — Design

Tracking issue: [#49](https://github.com/tomcorey26/LogBro/issues/49)

## Goal

Replace the current cream + terracotta palette (reads as "Claude") with a vibrant, indigo-purple palette. While doing it, fully centralize colors in `src/app/globals.css` so future palette changes are a one-file edit. Add dark-mode support with a user-facing toggle.

## Non-goals

- Redesigning component layouts, spacing, typography, or radii.
- Touching `--chart-1..5` (no usage found in current views).
- Bespoke marketing/landing-page artwork.

## Palette

### Light mode (default)

| Token | Value |
|---|---|
| `--background` | `hsl(240 20% 99%)` |
| `--foreground` | `hsl(240 25% 12%)` |
| `--card` | `hsl(240 20% 97%)` |
| `--card-foreground` | `hsl(240 25% 12%)` |
| `--popover` | `hsl(240 20% 99%)` |
| `--popover-foreground` | `hsl(240 25% 12%)` |
| `--primary` | `hsl(239 84% 67%)` (≈ `#6366F1`) |
| `--primary-foreground` | `hsl(0 0% 100%)` |
| `--secondary` | `hsl(240 15% 94%)` |
| `--secondary-foreground` | `hsl(240 25% 12%)` |
| `--muted` | `hsl(240 15% 94%)` |
| `--muted-foreground` | `hsl(240 10% 45%)` |
| `--accent` | `hsl(239 84% 95%)` |
| `--accent-foreground` | `hsl(239 84% 35%)` |
| `--destructive` | `hsl(0 84% 60%)` |
| `--destructive-foreground` | `hsl(0 0% 98%)` |
| `--border` | `hsl(240 15% 90%)` |
| `--input` | `hsl(240 15% 90%)` |
| `--input-background` | `hsl(240 20% 99%)` |
| `--ring` | `hsl(239 84% 67%)` |

Sidebar tokens mirror the main palette (sidebar = background, sidebar-primary = primary, etc.).

### Dark mode

| Token | Value |
|---|---|
| `--background` | `hsl(240 25% 8%)` |
| `--foreground` | `hsl(240 15% 92%)` |
| `--card` | `hsl(240 22% 12%)` |
| `--card-foreground` | `hsl(240 15% 92%)` |
| `--popover` | `hsl(240 22% 12%)` |
| `--popover-foreground` | `hsl(240 15% 92%)` |
| `--primary` | `hsl(239 90% 72%)` |
| `--primary-foreground` | `hsl(240 25% 8%)` |
| `--secondary` | `hsl(240 18% 18%)` |
| `--secondary-foreground` | `hsl(240 15% 92%)` |
| `--muted` | `hsl(240 18% 18%)` |
| `--muted-foreground` | `hsl(240 10% 65%)` |
| `--accent` | `hsl(239 50% 22%)` |
| `--accent-foreground` | `hsl(239 90% 88%)` |
| `--destructive` | `hsl(0 62% 50%)` |
| `--border` | `hsl(240 18% 22%)` |
| `--input` | `hsl(240 18% 22%)` |
| `--input-background` | `hsl(240 22% 14%)` |
| `--ring` | `hsl(239 90% 72%)` |

Sidebar tokens mirror the dark palette.

## New semantic tokens

Currently hard-coded as Tailwind utilities in components. Centralizing as named tokens:

| Token | Light | Dark | Replaces |
|---|---|---|---|
| `--success` | `hsl(152 60% 42%)` | `hsl(152 55% 55%)` | `bg-emerald-*`, `text-emerald-*` (set complete, finish-routine) |
| `--success-foreground` | `hsl(0 0% 100%)` | `hsl(240 25% 8%)` | white text on success bg |
| `--info` | `hsl(199 89% 48%)` | `hsl(199 89% 60%)` | `bg-sky-*`, `text-sky-*` (breaks, active timer) |
| `--info-foreground` | `hsl(0 0% 100%)` | `hsl(240 25% 8%)` | white text on info bg |
| `--rank-gold` | `hsl(45 95% 55%)` | `hsl(45 95% 65%)` | `text-yellow-500` (1st place) |
| `--rank-silver` | `hsl(220 8% 65%)` | `hsl(220 8% 75%)` | `text-gray-400` (2nd place) |
| `--rank-bronze` | `hsl(25 70% 50%)` | `hsl(25 70% 60%)` | `text-amber-600` (3rd place) |

Rationale for keeping success=green and info=blue despite a purple brand: these are semantic signals ("done" and "rest"), not brand expression. Recoloring would hurt scanability.

All seven tokens are registered in the `@theme inline` block as `--color-success`, `--color-success-foreground`, `--color-info`, `--color-info-foreground`, `--color-rank-gold`, `--color-rank-silver`, `--color-rank-bronze`. Tailwind v4 derives the matching utilities (`bg-success`, `text-info`, `text-rank-gold`, etc.) automatically.

## Component migrations

All four files identified by audit:

### `src/components/RoutineActionBar.tsx`
- `bg-emerald-500/15`, `border-emerald-500/40`, `hover:bg-emerald-500/20` → `bg-success/15`, `border-success/40`, `hover:bg-success/20`
- `text-emerald-700 dark:text-emerald-400` → `text-success`
- `text-emerald-800 dark:text-emerald-300` → `text-success` (one shade is sufficient — token already varies by mode)
- `bg-emerald-600 hover:bg-emerald-700 text-white` → `bg-success hover:bg-success/90 text-success-foreground`
- `shadow-[0_5px_0_0_color-mix(in_srgb,#059669_70%,black)]` → `shadow-[0_5px_0_0_color-mix(in_srgb,var(--color-success)_70%,black)]`
- Same pattern for sky → info on the timer/break controls (line 160 onward).

### `src/components/ActiveRoutineSetRow.tsx`
- `bg-sky-500/15 border-l-4 border-sky-500 ring-1 ring-sky-500/30` → `bg-info/15 border-l-4 border-info ring-1 ring-info/30`
- `bg-emerald-500/10 border-l-4 border-emerald-500/70` → `bg-success/10 border-l-4 border-success/70`
- Pill backgrounds and text: emerald → success, sky → info, including opacity modifiers (`/20`, `/30`).
- `bg-sky-500 animate-pulse` (active break dot) → `bg-info animate-pulse`
- `bg-sky-500 hover:bg-sky-600 text-white` (skip-break button) → `bg-info hover:bg-info/90 text-info-foreground`
- `bg-emerald-500 text-white` (completed checkmark) → `bg-success text-success-foreground`
- Conditional `isBreak ? 'bg-sky-500/20' : 'bg-primary/20'` → `isBreak ? 'bg-info/20' : 'bg-primary/20'` (primary stays — already tokenized).

### `src/components/ActiveRoutineView.tsx`
- `bg-sky-500 animate-pulse` → `bg-info animate-pulse`.

### `src/components/RankingsView.tsx`
- `text-yellow-500` → `text-rank-gold`
- `text-gray-400` → `text-rank-silver`
- `text-amber-600` → `text-rank-bronze`

## Dark-mode toggle

The codebase has `.dark` styles but no toggle. Adding one with these properties:

- **Storage:** `localStorage` key `logbro:theme` with values `light` | `dark` | `system`. Default = `light` (per user preference).
- **Application:** A small `ThemeProvider` (no external library) that on mount reads storage, applies `light`/`dark` class to `<html>`, and listens to `prefers-color-scheme` only when value is `system`.
- **SSR flash prevention:** Inline a tiny pre-hydration script in `app/layout.tsx` that reads localStorage and sets the class on `<html>` before React paints (standard pattern).
- **Toggle UI:** A single icon button (sun/moon/monitor cycling) in the existing top-level navigation. Exact placement decided during implementation by inspection — must not crowd existing controls.

Not adopting `next-themes` to avoid a dependency for ~30 lines of code. If we ever need finer control (custom themes beyond light/dark), revisit.

## Lint guardrail

Add a `package.json` script `lint:colors` that uses `rg` to fail when:
- A hard-coded Tailwind color utility (`bg-emerald-*`, `text-sky-*`, …) appears in `src/**/*.{ts,tsx,css}` excluding `src/app/globals.css`.
- A hex literal `#RRGGBB` or `hsl(`/`rgb(` call appears in the same scope.

Wire into `lint` (or CI) so a regression fails the build.

## Acceptance criteria

- [ ] No hard-coded Tailwind color utilities (`bg-emerald-*`, `text-sky-*`, etc.) in `src/`.
- [ ] No hex/rgb/hsl literals in component files (only in `globals.css`).
- [ ] Changing a single token in `globals.css` recolors the whole app for that role.
- [ ] Light + dark both render correctly on: `/routines`, an active routine session (set rows + action bar), `/rankings`, dashboard, log-session screens.
- [ ] Dark-mode toggle present in nav; `light` default; preference persists; no FOUC on reload.
- [ ] `lint:colors` script passes; existing `vitest` and `playwright` suites pass.

## Open questions

None.
