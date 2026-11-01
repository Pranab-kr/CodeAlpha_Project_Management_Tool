import { describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "../../src/lib/password.js";
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../../src/lib/tokens.js";
import { setAuthCookies } from "../../src/lib/cookies.js";

describe("auth primitives", () => {
  it("hashes and verifies a password without storing plaintext", async () => {
    const hash = await hashPassword("Password123!");
    expect(hash).not.toContain("Password123!");
    await expect(verifyPassword("Password123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("signs and verifies an access token with issuer/audience", async () => {
    const token = await signAccessToken({
      id: "11111111-1111-4111-8111-111111111111",
      email: "a@example.com",
    });
    await expect(verifyAccessToken(token)).resolves.toMatchObject({
      sub: "11111111-1111-4111-8111-111111111111",
      email: "a@example.com",
    });
    await expect(verifyAccessToken(`${token}x`)).rejects.toThrow();
  });

  it("generates opaque refresh tokens and hashes them deterministically", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(40);
    expect(hashRefreshToken(a)).toBe(hashRefreshToken(a));
    expect(hashRefreshToken(a)).not.toBe(hashRefreshToken(b));
  });

  it("sets httpOnly cookies with the expected names and paths", () => {
    const res = { cookie: vi.fn() };
    setAuthCookies(res as never, "access-token", "refresh-token");
    expect(res.cookie).toHaveBeenCalledWith(
      "ca_access",
      "access-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "ca_refresh",
      "refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/api/v1/auth",
      }),
    );
  });
});
