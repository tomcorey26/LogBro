import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  verifyPassword: vi.fn(),
  setSessionCookie: vi.fn(),
}));

const mockGetUserByUsername = vi.fn();

vi.mock("@/server/db/users", () => ({
  getUserByUsername: (...args: any[]) => mockGetUserByUsername(...args),
}));

import { verifyPassword, setSessionCookie } from "@/lib/auth";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setSessionCookie).mockResolvedValue(undefined);
  });

  it("normalizes username to lowercase before lookup", async () => {
    mockGetUserByUsername.mockResolvedValue({
      id: 7,
      username: "mixedcase",
      passwordHash: "hashed",
    });
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "MixedCase", password: "password123" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockGetUserByUsername).toHaveBeenCalledWith("mixedcase");
  });
});
