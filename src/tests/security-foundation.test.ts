import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, strongPasswordSchema } from "@/lib/password-policy";
import { persistentSessionCookieOptions } from "@/lib/session-cookie";
import { isTrustedApplicationOrigin, publicRequestOrigin } from "@/lib/request-origin";
import { buildHpgl, buildPrintDocument, checkProductionDesign, clampLayerToSheet, type ProductionLayer } from "@/lib/design-production";

const rectangle: ProductionLayer = {
  id: "rect-1",
  kind: "rectangle",
  name: "Badge",
  visible: true,
  locked: false,
  x: 50,
  y: 50,
  width: 30,
  height: 20,
  rotation: 0,
  color: "#111827",
};

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

  it("submits staff login with same-origin fetch instead of native form-action", () => {
    const formSource = readFileSync(new URL("../components/auth/staff-login-form.tsx", import.meta.url), "utf8");
    const routeSource = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");

    expect(formSource).toContain('event.preventDefault()');
    expect(formSource).toContain('fetch("/api/auth/login"');
    expect(formSource).toContain('credentials: "same-origin"');
    expect(formSource).not.toContain('action="/api/auth/login"');
    expect(routeSource).toContain('"X-EJM-Login"');
    expect(routeSource).toContain("redirectPath");
    expect(routeSource).toContain('"Cache-Control": "no-store"');
  });

  it("trusts the forwarded public origin but rejects an unrelated origin", () => {
    const request = new NextRequest("https://internal.railway/api/designs", {
      headers: {
        host: "internal.railway",
        origin: "https://shops.example.com",
        "x-forwarded-host": "shops.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicRequestOrigin(request)).toBe("https://shops.example.com");
    expect(isTrustedApplicationOrigin(request)).toBe(true);

    const attacker = new NextRequest("https://internal.railway/api/designs", {
      headers: {
        host: "internal.railway",
        origin: "https://attacker.example",
        "x-forwarded-host": "shops.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(isTrustedApplicationOrigin(attacker)).toBe(false);
  });

  it("keeps rotated production layers inside the sheet", () => {
    const clamped = clampLayerToSheet({ ...rectangle, x: -100, y: 900, rotation: 45 }, { width: 100, height: 100 });
    expect(clamped.x).toBeGreaterThan(0);
    expect(clamped.y).toBeLessThan(100);
  });

  it("blocks unsupported direct HPGL content", () => {
    const check = checkProductionDesign({
      layers: [{ ...rectangle, kind: "text", name: "Player name" }],
      sheet: { width: 210, height: 297 },
      machineProfile: "HPGL / PLT cutter",
      material: "htv",
      mirror: true,
      registrationMarks: false,
      copies: 1,
    });
    expect(check.errors.join(" ")).toContain("rectangle and circle vector layers only");
  });

  it("creates deterministic HPGL and the selected number of print pages", () => {
    const hpgl = buildHpgl({ layers: [rectangle], sheet: { width: 210, height: 297 }, mirror: true, weedBox: true });
    expect(hpgl).toContain("IN;PA;SP1");
    expect(hpgl).not.toContain("NaN");

    const printDocument = buildPrintDocument({ title: "Test", svg: "<svg></svg>", widthMm: 210, heightMm: 297, copies: 3 });
    expect(printDocument.match(/class="page"/g)).toHaveLength(3);
    expect(printDocument).toContain("@page{size:210mm 297mm");
  });
});
