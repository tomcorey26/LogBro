<p align="center">
  <img src="public/web-app-manifest-512x512.png" alt="LogBro" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">LogBro</h1>

<p align="center">
  <em>A workout tracker, but for skills.</em>
</p>

<p align="center">
  Time block your day like a workout routine
</p>

---

## The Idea

The "10,000 hours" rule says it takes roughly 10,000 hours of deliberate practice to master a skill. Whether or not the exact number holds up, the core truth is real: consistent, tracked practice is how you get better at anything.

LogBro is a app I built to scratch my own itch. I wanted a simple way to time my practice sessions across multiple skills, stack them into daily routines, and actually see the hours add up over time. Think of it like a gym tracker, but for your brain.

## What It Does

- **Routines** — Stack skills into daily practice blocks (guitar 30 min, coding 45 min, reading 15 min) like sets in a workout
- **Timer** — Stopwatch mode for flow state, countdown mode for focused blocks. Just hit play
- **Streaks** — Daily streaks keep you accountable. Show up, log your time, keep the chain going
- **Stats** — Dashboard with lifetime totals, weekly/monthly time, streaks, a year-long practice heat map, and rankings of your skills by total hours
- **Sessions** — Full history of every practice session with duration, date, and mode

## Tech Stack

This project was a playground for me to go deep on a modern full-stack setup, and also test the abilities of agentic coding

| Layer | Tech |
|-------|------|
| **Framework** | Next.js 16 (App Router) with React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 + Radix UI primitives |
| **Animations** | Framer Motion |
| **State** | Zustand + TanStack React Query |
| **Database** | SQLite via Drizzle ORM |
| **Auth** | Custom JWT implementation (jose + bcrypt) |
| **Validation** | Zod + React Hook Form |
| **Testing** | Playwright (E2E) + Vitest (Unit) |

## Running Locally

```bash
# Clone and install
git clone https://github.com/tomcorey26/10000-hours.git
cd 10000-hours
npm install

# Set up environment
# Create a .env file with:
#   DATABASE_URL=file:local.db
#   JWT_SECRET=your-secret-here

# Run database migrations
npx drizzle-kit push

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
src/
├── app/              # Next.js pages and API routes
│   ├── (app)/        # Authenticated app (habits, sessions, rankings, routines)
│   ├── api/          # REST API (auth, habits, sessions, timer)
│   └── login/        # Auth pages
├── components/       # React components (timers, habit cards, modals, UI)
├── db/               # Drizzle schema and database config
├── hooks/            # Custom React hooks
├── stores/           # Zustand state stores
└── lib/              # Utilities and helpers
```

## What I Learned

Building this taught me a lot about real-time state sync (keeping a running timer consistent between client, server, and database), optimistic UI updates with TanStack Query, and structuring a Next.js app that feels snappy as a native mobile app (PWA + haptic feedback + smooth animations).

I also learned how to work with AI agents in a way that produces good results. I utilized agent skills (https://github.com/obra/superpowers has lead to amazing results), context management, validation with linting/tests, a TTS mic input for prompting, claude code review for PRs. It is undeniable that this new AI tooling is incredibly useful.

---

<p align="center">
  Built by <a href="https://github.com/tomcorey26">Tom Corey</a>
</p>
