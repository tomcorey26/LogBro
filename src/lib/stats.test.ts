import { describe, it, expect } from "vitest";
import {
  bucketSeconds,
  computeCurrentStreak,
  computeLongestStreak,
  buildHeatmapGrid,
} from "./stats";

describe("bucketSeconds", () => {
  it("returns 0 for zero seconds", () => {
    expect(bucketSeconds(0)).toBe(0);
  });
  it("returns 1 for 1 second up to 15 minutes", () => {
    expect(bucketSeconds(1)).toBe(1);
    expect(bucketSeconds(15 * 60)).toBe(1);
  });
  it("returns 2 for >15min up to 60min", () => {
    expect(bucketSeconds(15 * 60 + 1)).toBe(2);
    expect(bucketSeconds(60 * 60)).toBe(2);
  });
  it("returns 3 for >60min up to 3h", () => {
    expect(bucketSeconds(60 * 60 + 1)).toBe(3);
    expect(bucketSeconds(3 * 60 * 60)).toBe(3);
  });
  it("returns 4 for >3h", () => {
    expect(bucketSeconds(3 * 60 * 60 + 1)).toBe(4);
    expect(bucketSeconds(10 * 60 * 60)).toBe(4);
  });
});

describe("computeCurrentStreak", () => {
  it("returns 0 for empty set", () => {
    expect(computeCurrentStreak(new Set(), "2026-05-06")).toBe(0);
  });
  it("counts back from today when today is present", () => {
    const dates = new Set(["2026-05-06", "2026-05-05", "2026-05-04"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(3);
  });
  it("counts back from yesterday when today missing but yesterday present", () => {
    const dates = new Set(["2026-05-05", "2026-05-04"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(2);
  });
  it("returns 0 when neither today nor yesterday is present", () => {
    const dates = new Set(["2026-05-04", "2026-05-03"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(0);
  });
  it("stops at the first gap", () => {
    const dates = new Set(["2026-05-06", "2026-05-05", "2026-05-03"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(2);
  });
});

describe("computeLongestStreak", () => {
  it("returns 0 for empty set", () => {
    expect(computeLongestStreak(new Set())).toBe(0);
  });
  it("returns 1 for a single day", () => {
    expect(computeLongestStreak(new Set(["2026-05-06"]))).toBe(1);
  });
  it("finds longest run anywhere in history", () => {
    const dates = new Set([
      "2026-01-01", "2026-01-02", // 2
      "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", // 5
      "2026-03-01", // 1
    ]);
    expect(computeLongestStreak(dates)).toBe(5);
  });
  it("handles unsorted input", () => {
    const dates = new Set(["2026-01-03", "2026-01-01", "2026-01-02"]);
    expect(computeLongestStreak(dates)).toBe(3);
  });
});

describe("buildHeatmapGrid", () => {
  it("produces 53 weeks × 7 days = 371 cells", () => {
    const grid = buildHeatmapGrid({}, "2026-05-06");
    expect(grid.weeks).toHaveLength(53);
    for (const week of grid.weeks) expect(week.days).toHaveLength(7);
  });
  it("ends on Sunday of the current week (Mon-start, Sun=last)", () => {
    // 2026-05-06 is a Wednesday. Sunday of that week is 2026-05-10.
    const grid = buildHeatmapGrid({}, "2026-05-06");
    const lastWeek = grid.weeks[grid.weeks.length - 1];
    expect(lastWeek.days[6].date).toBe("2026-05-10");
  });
  it("sets seconds for known dates and 0 for unknown", () => {
    const grid = buildHeatmapGrid({ "2026-05-06": 600 }, "2026-05-06");
    const found = grid.weeks
      .flatMap((w) => w.days)
      .find((d) => d.date === "2026-05-06");
    expect(found?.seconds).toBe(600);
    expect(found?.bucket).toBe(1);
  });
  it("flags days after today as future (no cell render)", () => {
    const grid = buildHeatmapGrid({}, "2026-05-06");
    const future = grid.weeks
      .flatMap((w) => w.days)
      .find((d) => d.date === "2026-05-10");
    expect(future?.isFuture).toBe(true);
  });
});
