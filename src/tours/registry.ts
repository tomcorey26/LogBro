import type { DriveStep } from "driver.js";
import type { TourId } from "./storage";

type Tour = {
  steps: DriveStep[];
};

export const TOURS: Record<TourId, Tour> = {
  habits: {
    steps: [
      {
        popover: {
          title: "Welcome to LogBro 👋",
          description:
            "Each card here is a skill you're tracking. We seeded a few — feel free to delete any you don't want.",
        },
      },
      {
        element: '[data-tour="habits-add-form"]',
        popover: {
          title: "Add a skill",
          description: "Type a name and tap + to start tracking a new skill.",
        },
      },
      {
        element: '[data-tour="habits-first-card"]',
        popover: {
          title: "Start a session",
          description:
            "Tap a skill to launch a stopwatch or countdown timer.",
        },
      },
      {
        element: '[data-tour="tabnav-routines"]',
        popover: {
          title: "Build a routine",
          description:
            "Stack skills together into daily practice routines, like sets in a workout.",
        },
      },
    ],
  },
  routines: {
    steps: [
      {
        popover: {
          title: "Routines",
          description:
            "Stack skills into daily practice blocks. We added a 'Daily Practice' routine to show how it works.",
        },
      },
      {
        element: '[data-tour="routines-first-card"]',
        popover: {
          title: "Run a routine",
          description:
            "Tap a routine to start working through each block one at a time.",
        },
      },
      {
        element: '[data-tour="routines-new-button"]',
        popover: {
          title: "Build your own",
          description: "Tap here to design a new routine from scratch.",
        },
      },
    ],
  },
  stats: {
    steps: [
      {
        popover: {
          title: "Your progress",
          description:
            "Every minute you log shows up here. Come back any time to watch the hours add up.",
        },
      },
      {
        element: '[data-tour="stats-totals"]',
        popover: {
          title: "Lifetime totals",
          description: "Total hours and sessions across all your skills.",
        },
      },
      {
        element: '[data-tour="stats-streaks"]',
        popover: {
          title: "Streaks",
          description: "Show up daily to keep the chain going.",
        },
      },
      {
        element: '[data-tour="stats-heatmap"]',
        popover: {
          title: "Yearly heatmap",
          description: "A visual record of every practice day this year.",
        },
      },
    ],
  },
};
