import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, startTimerForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  startTimerForUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUserId,
}));

vi.mock("@/server/db/timers", () => ({
  startTimerForUser,
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/timer/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/timer/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    getSessionUserId.mockResolvedValue(null);

    const response = await POST(makeRequest({ habitId: 1 }));

    expect(response.status).toBe(401);
    expect(startTimerForUser).not.toHaveBeenCalled();
  });

  it("returns the started timer payload from the db module", async () => {
    getSessionUserId.mockResolvedValue(42);
    startTimerForUser.mockResolvedValue({
      startTime: "2026-04-30T00:00:00.000Z",
      habitId: 7,
      targetDurationSeconds: null,
    });

    const response = await POST(makeRequest({ habitId: 7 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      startTime: "2026-04-30T00:00:00.000Z",
      habitId: 7,
      targetDurationSeconds: null,
    });
  });

  it("returns 404 when habit is not found", async () => {
    getSessionUserId.mockResolvedValue(42);
    startTimerForUser.mockResolvedValue(null);

    const response = await POST(makeRequest({ habitId: 7 }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Habit not found",
    });
  });

  it("returns 409 when a routine session is active", async () => {
    getSessionUserId.mockResolvedValue(42);
    startTimerForUser.mockResolvedValue({ conflict: "routine_session_active" });

    const response = await POST(makeRequest({ habitId: 7 }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("routine_session_active");
    expect(body.error).toBe("Routine in progress");
  });
});
