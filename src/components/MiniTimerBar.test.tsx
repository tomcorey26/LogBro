// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useTimerStore } from "@/stores/timer-store";
import { useRoutineSessionStore } from "@/stores/routine-session-store";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/history",
}));

vi.mock("@/hooks/use-haptics", () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

import { MiniTimerBar } from "./MiniTimerBar";

describe("MiniTimerBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.setState({
      activeTimer: null,
      view: { type: "habits_list" },
      displayTime: "00:00:00",
    });
    useRoutineSessionStore.getState().reset();
  });

  it("renders nothing when no active timer", () => {
    const { container } = render(<MiniTimerBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders timer info when active timer exists", () => {
    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: new Date().toISOString(),
        targetDurationSeconds: null,
      },
      displayTime: "00:05:30",
      view: { type: "active_timer" },
    });

    render(<MiniTimerBar />);
    expect(screen.getByText("Guitar")).toBeInTheDocument();
    expect(screen.getByText("00:05:30")).toBeInTheDocument();
  });

  it("renders nothing when routine session is active", () => {
    // Set a timer so we'd otherwise render
    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: new Date().toISOString(),
        targetDurationSeconds: null,
      },
      displayTime: "00:05:30",
      view: { type: "active_timer" },
    });

    // Hydrate routine store -> mode becomes 'active'
    useRoutineSessionStore.getState().hydrate({
      id: 1,
      routineId: 1,
      routineNameSnapshot: "Morning",
      status: "active",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      sets: [],
      activeTimer: null,
    });

    const { container } = render(<MiniTimerBar />);
    expect(container.firstChild).toBeNull();
  });
});
