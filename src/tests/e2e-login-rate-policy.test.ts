import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("browser acceptance login volume policy", () => {
  it("keeps production limits unchanged and requires both CI and E2E flags", () => {
    const route = source("../app/api/auth/login/route.ts");
    expect(route).toContain('process.env.CI === "true" && process.env.E2E_TESTING === "true"');
    expect(route).toContain("CI_E2E_LOGIN_VOLUME ? 100 : 10");
    expect(route).toContain("CI_E2E_LOGIN_VOLUME ? 500 : 60");
    expect(route).toContain("MAX_FAILED_LOGINS = 5");
    expect(route).toContain("LOCK_MINUTES = 15");
  });

  it("enables the higher valid-login volume only for the Chromium CI step", () => {
    const workflow = source("../../.github/workflows/ci.yml");
    expect(workflow).toContain('- name: Run Chromium browser acceptance');
    expect(workflow).toContain('CI: "true"\n          E2E_TESTING: "true"');
    expect(workflow).toContain("permissions:\n  contents: read");
  });
});
