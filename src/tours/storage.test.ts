// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hasSeenTour,
  markTourSeen,
  resetAllTours,
  TOUR_SEEN_PREFIX,
  type TourId,
} from "./storage";

const TOUR_ID: TourId = "habits";

describe("tour storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("hasSeenTour returns false when nothing is stored", () => {
    expect(hasSeenTour(TOUR_ID)).toBe(false);
  });

  it("markTourSeen persists a flag retrievable by hasSeenTour", () => {
    markTourSeen(TOUR_ID);
    expect(hasSeenTour(TOUR_ID)).toBe(true);
  });

  it("flags are scoped per tour id", () => {
    markTourSeen("habits");
    expect(hasSeenTour("habits")).toBe(true);
    expect(hasSeenTour("routines")).toBe(false);
    expect(hasSeenTour("stats")).toBe(false);
  });

  it("resetAllTours clears every tour-seen key but leaves unrelated keys", () => {
    markTourSeen("habits");
    markTourSeen("routines");
    markTourSeen("stats");
    localStorage.setItem("unrelated.key", "keep-me");

    resetAllTours();

    expect(hasSeenTour("habits")).toBe(false);
    expect(hasSeenTour("routines")).toBe(false);
    expect(hasSeenTour("stats")).toBe(false);
    expect(localStorage.getItem("unrelated.key")).toBe("keep-me");
  });

  it("does not blow up when localStorage is unavailable", () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("no storage");
      },
    });
    try {
      expect(hasSeenTour(TOUR_ID)).toBe(false);
      expect(() => markTourSeen(TOUR_ID)).not.toThrow();
      expect(() => resetAllTours()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: original,
      });
    }
  });

  it("uses the documented key prefix", () => {
    markTourSeen("habits");
    expect(localStorage.getItem(`${TOUR_SEEN_PREFIX}habits`)).toBe("1");
  });
});
