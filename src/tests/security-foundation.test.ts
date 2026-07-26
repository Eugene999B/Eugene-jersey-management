import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, strongPasswordSchema } from "@/lib/password-policy";
import { persistentSessionCookieOptions } from "@/lib/session-cookie";

describe("security foundations", () => {
  it("uses a strong shared password policy", () => {
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(12);
    expect(strongPasswordSchema.safeParse("short1").success).toBe(false);
    expect(strongPasswordSchema.safeParse("letters-only-password").success).toBe(false);
    expect(strongPasswordSchema.safeParse("123456789012345").success).toBe(false);
    expect(strongPasswordSchema.safeParse("SecurePassword2026").success).toBe(true);
  });

  it("creates durable, HTTP-only, high-priority session cookies", () => {
    const before = Date.now();
    const options = persistentSessionCookieOptions(3600, true);

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.secure).toBe(true);
    expect(options.priority).toBe("high");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(3600);
    expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + 3_599_000);
  });

  it("never verifies or deletes a valid staff session inside Proxy", () => {
    const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

    expect(source).toContain("hasSessionCookie");
    expect(source).not.toContain("verifySessionToken");
    expect(source).not.toContain("response.cookies.delete");
    expect(source).not.toContain("cookies.delete");
  });
});
