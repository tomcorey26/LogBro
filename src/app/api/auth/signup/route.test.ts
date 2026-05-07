import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(),
  setSessionCookie: vi.fn(),
}));

const mockCreateUser = vi.fn();
const mockGetUserByUsername = vi.fn();
const mockSeedDefaultHabits = vi.fn();
const mockSeedDefaultRoutine = vi.fn();

vi.mock("@/server/db/users", () => ({
  createUser: (...args: any[]) => mockCreateUser(...args),
  getUserByUsername: (...args: any[]) => mockGetUserByUsername(...args),
}));

vi.mock("@/server/db/habits", () => ({
  seedDefaultHabits: (...args: any[]) => mockSeedDefaultHabits(...args),
}));

vi.mock("@/server/db/routines", () => ({
  seedDefaultRoutine: (...args: any[]) => mockSeedDefaultRoutine(...args),
}));

import { hashPassword, setSessionCookie } from "@/lib/auth";

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hashPassword).mockResolvedValue("hashed");
    vi.mocked(setSessionCookie).mockResolvedValue(undefined);
  });

  it("seeds default habits and an example routine after creating user", async () => {
    const seededHabits = [
      { id: 1, name: "Coding" },
      { id: 2, name: "Guitar" },
      { id: 3, name: "Reading" },
    ];
    mockGetUserByUsername.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ id: 42, username: "newuser" });
    mockSeedDefaultHabits.mockResolvedValue(seededHabits);
    mockSeedDefaultRoutine.mockResolvedValue(undefined);

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
    expect(mockSeedDefaultRoutine).toHaveBeenCalledTimes(1);
    expect(mockSeedDefaultRoutine).toHaveBeenCalledWith(42, seededHabits);
  });

  it("does not seed routine if habit seeding fails", async () => {
    mockGetUserByUsername.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ id: 42, username: "newuser" });
    mockSeedDefaultHabits.mockRejectedValue(new Error("DB down"));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "newuser", password: "password123" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSeedDefaultRoutine).not.toHaveBeenCalled();
  });

  it("normalizes username to lowercase before lookup and create", async () => {
    mockGetUserByUsername.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ id: 7, username: "mixedcase" });
    mockSeedDefaultHabits.mockResolvedValue([]);
    mockSeedDefaultRoutine.mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "MixedCase", password: "password123" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockGetUserByUsername).toHaveBeenCalledWith("mixedcase");
    expect(mockCreateUser).toHaveBeenCalledWith("mixedcase", "hashed");
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
    expect(mockSeedDefaultRoutine).not.toHaveBeenCalled();
  });
});
