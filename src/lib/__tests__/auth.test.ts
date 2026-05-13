import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";
import { SignJWT } from "jose";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function signToken(payload: Record<string, unknown>, expiresIn = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets an httpOnly cookie named auth-token", async () => {
    await createSession("user-123", "test@example.com");
    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [cookieName, , options] = mockCookieStore.set.mock.calls[0];
    expect(cookieName).toBe("auth-token");
    expect(options.httpOnly).toBe(true);
  });

  test("sets cookie with sameSite lax and path /", async () => {
    await createSession("user-123", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("sets cookie expiry approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expiresAt = options.expires as Date;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("stores a valid JWT as cookie value", async () => {
    await createSession("user-abc", "user@test.com");
    const [, token] = mockCookieStore.set.mock.calls[0];
    expect(typeof token).toBe("string");
    // JWT tokens have 3 dot-separated parts
    expect(token.split(".")).toHaveLength(3);
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null when cookie value is falsy", async () => {
    mockCookieStore.get.mockReturnValue({ value: "" });
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await signToken({
      userId: "user-123",
      email: "user@example.com",
      expiresAt,
    });
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-123");
    expect(session?.email).toBe("user@example.com");
  });

  test("returns null for a token signed with wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    const token = await new SignJWT({ userId: "hacker", email: "bad@actor.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1d")
      .setIssuedAt()
      .sign(wrongSecret);

    mockCookieStore.get.mockReturnValue({ value: token });
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await signToken(
      { userId: "user-123", email: "expired@example.com" },
      "-1s"
    );
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for a malformed token string", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt.token" });
    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });

  test("calls delete exactly once", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  });
});

describe("verifySession", () => {
  function makeRequest(token?: string) {
    return {
      cookies: {
        get: (name: string) => (name === "auth-token" && token ? { value: token } : undefined),
      },
    } as any;
  }

  test("returns null when request has no auth-token cookie", async () => {
    const request = makeRequest();
    const session = await verifySession(request);
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await signToken({
      userId: "user-456",
      email: "verify@example.com",
      expiresAt: new Date(),
    });
    const request = makeRequest(token);

    const session = await verifySession(request);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-456");
    expect(session?.email).toBe("verify@example.com");
  });

  test("returns null for an expired token", async () => {
    const token = await signToken({ userId: "u1", email: "e@x.com" }, "-1s");
    const request = makeRequest(token);
    const session = await verifySession(request);
    expect(session).toBeNull();
  });

  test("returns null for a tampered token", async () => {
    const token = await signToken({ userId: "u1", email: "e@x.com" });
    const [header, payload, signature] = token.split(".");
    const tamperedToken = `${header}.${payload}X.${signature}`;
    const request = makeRequest(tamperedToken);

    const session = await verifySession(request);
    expect(session).toBeNull();
  });

  test("returns null when token is signed with wrong secret", async () => {
    const wrongSecret = new TextEncoder().encode("attacker-secret");
    const token = await new SignJWT({ userId: "evil", email: "evil@hack.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1d")
      .setIssuedAt()
      .sign(wrongSecret);

    const request = makeRequest(token);
    const session = await verifySession(request);
    expect(session).toBeNull();
  });

  test("returns null for a completely invalid token string", async () => {
    const request = makeRequest("garbage-token-value");
    const session = await verifySession(request);
    expect(session).toBeNull();
  });
});
