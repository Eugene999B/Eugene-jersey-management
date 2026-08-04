import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("dependency security policy", () => {
  it("allows only the reviewed unpublished fast-uri advisory path", () => {
    const verifier = source("../../scripts/verify-dependency-security.mjs");
    expect(verifier).toContain("1130719");
    expect(verifier).toContain("GHSA-7p8r-x3mc-p8w7");
    expect(verifier).toContain('new Set(["fast-uri", "ajv"])');
    expect(verifier).toContain('node_modules/@prisma/streams-local/node_modules/ajv');
    expect(verifier).toContain('installedFastUri?.version !== "4.1.1"');
    expect(verifier).toContain("2026-09-04");
    expect(verifier).toContain("unexpected high/critical advisories");
  });

  it("proves the reviewed chain remains dev-optional in the committed lock", () => {
    const lock = JSON.parse(source("../../package-lock.json")) as {
      packages: Record<string, { version?: string; devOptional?: boolean }>;
    };
    expect(lock.packages["node_modules/@prisma/streams-local"]?.devOptional).toBe(true);
    expect(lock.packages["node_modules/@prisma/streams-local/node_modules/ajv"]?.devOptional).toBe(true);
    expect(lock.packages["node_modules/fast-uri"]?.version).toBe("4.1.1");
  });

  it("fails if build-only vulnerable packages enter the standalone deployment", () => {
    const verifier = source("../../scripts/verify-standalone-runtime-dependencies.mjs");
    expect(verifier).toContain('"@prisma/streams-local"');
    expect(verifier).toContain('"fast-uri"');
    expect(verifier).toContain('"hono"');
    expect(verifier).toContain('"postcss"');
    expect(verifier).toContain("build-only or currently vulnerable packages were copied into the deployable server");
  });

  it("keeps the CI workflow read-only and runs both verification layers", () => {
    const workflow = source("../../.github/workflows/ci.yml");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("node scripts/verify-dependency-security.mjs npm-audit.json");
    expect(workflow).toContain("node scripts/verify-standalone-runtime-dependencies.mjs");
    expect(workflow).not.toContain("git push origin");
  });
});
