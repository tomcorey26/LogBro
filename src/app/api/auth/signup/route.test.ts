import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(),
  setSessionCookie: vi.fn(),
}));

const mockCreateUser = vi.fn();
const mockGetUserByUsername = vi.fn();
const mockSeedDefaultHabits = vi.fn();

vi.mock("@/server/db/users", () => ({
  createUser: (...args: any[]) => mockCreateUser(...args),
  getUserByUsername: (...args: any[]) => mockGetUserByUsername(...args),
}));

vi.mock("@/server/db/habits", () => ({
  seedDefaultHabits: (...args: any[]) => mockSeedDefaultHabits(...args),
}));

import { hashPassword, setSessionCookie } from "@/lib/auth";

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hashPassword).mockResolvedValue("hashed");
    vi.mocked(setSessionCookie).mockResolvedValue(undefined);
  });

  it("seeds default habits after creating user", async () => {
    mockGetUserByUsername.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ id: 42, username: "newuser" });
    mockSeedDefaultHabits.mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "newuser", password: "password123" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(mockSeedDefaultHabits).toHaveBeenCalledTimes(1);
    expect(mockSeedDefaultHabits).toHaveBeenCalledWith(42);
  });

  it("rejects usernames with disallowed characters", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "tom@example.com", password: "password123" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockGetUserByUsername).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("does not seed habits if user already exists", async () => {
    mockGetUserByUsername.mockResolvedValue({ id: 1, username: "existinguser" });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "existinguser", password: "password123" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockSeedDefaultHabits).not.toHaveBeenCalled();
  });
});
