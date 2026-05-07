import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HistoryListItem } from "@/lib/types";

vi.mock("@/lib/auth", () => ({
  getSessionUserId: vi.fn().mockResolvedValue(1),
}));

const getHistoryForUserMock = vi.fn();
const createManualHistoryEntryMock = vi.fn().mockResolvedValue({ id: 1 });

vi.mock("@/server/db/history", () => ({
  createManualHistoryEntry: createManualHistoryEntryMock,
  getHistoryForUser: getHistoryForUserMock,
}));

describe("POST /api/history", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns 403 when FEATURE_LOG_SESSION is not enabled", async () => {
    vi.stubEnv("FEATURE_LOG_SESSION", "false");
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: 1, date: "2026-04-01", durationMinutes: 30 }),
    });
    const response = await POST(request as any);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Feature not available");
  });

  it("allows POST when FEATURE_LOG_SESSION is enabled", async () => {
    vi.stubEnv("FEATURE_LOG_SESSION", "true");
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: 1, date: "2026-04-01", durationMinutes: 30 }),
    });
    const response = await POST(request as any);
    expect(response.status).not.toBe(403);
  });
});

describe("GET /api/history", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    getHistoryForUserMock.mockReset();
  });

  it("returns flat session items in the new shape", async () => {
    const history: HistoryListItem[] = [
      {
        kind: "session",
        entry: {
          id: 1,
          habitId: 10,
          habitName: "Read",
          startTime: "2026-04-01T10:00:00.000Z",
          endTime: "2026-04-01T10:30:00.000Z",
          durationSeconds: 1800,
          timerMode: "stopwatch",
        },
      },
    ];
    getHistoryForUserMock.mockResolvedValue({ history, totalSeconds: 1800 });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/history?range=all");
    const response = await GET(request as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.totalSeconds).toBe(1800);
    expect(body.history).toHaveLength(1);
    expect(body.history[0].kind).toBe("session");
    expect(body.history[0].entry.habitName).toBe("Read");
  });

  it("returns a routine group containing entries when sessions are part of a routine", async () => {
    const history: HistoryListItem[] = [
      {
        kind: "routine",
        routineSessionId: 42,
        routineNameSnapshot: "Morning Routine",
        startedAt: "2026-04-01T07:00:00.000Z",
        finishedAt: "2026-04-01T07:30:00.000Z",
        totalDurationSeconds: 1500,
        entries: [
          {
            id: 11,
            habitId: 1,
            habitName: "Stretch",
            startTime: "2026-04-01T07:00:00.000Z",
            endTime: "2026-04-01T07:10:00.000Z",
            durationSeconds: 600,
            timerMode: "routine",
          },
          {
            id: 12,
            habitId: 2,
            habitName: "Meditate",
            startTime: "2026-04-01T07:15:00.000Z",
            endTime: "2026-04-01T07:30:00.000Z",
            durationSeconds: 900,
            timerMode: "routine",
          },
        ],
      },
    ];
    getHistoryForUserMock.mockResolvedValue({ history, totalSeconds: 1500 });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/history?range=all");
    const response = await GET(request as any);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.history).toHaveLength(1);
    const group = body.history[0];
    expect(group.kind).toBe("routine");
    expect(group.routineSessionId).toBe(42);
    expect(group.routineNameSnapshot).toBe("Morning Routine");
    expect(group.entries).toHaveLength(2);
    expect(group.totalDurationSeconds).toBe(1500);
  });
});
