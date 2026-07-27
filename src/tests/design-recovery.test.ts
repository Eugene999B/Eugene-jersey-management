import { describe, expect, it } from "vitest";
import {
  DESIGN_PROJECT_VERSION,
  designRecoveryStorageKey,
  isMeaningfulDesignProject,
  isRecoveryNewerThanSaved,
  migrateDesignProject,
  parseDesignRecoveryDraft,
  serializeDesignRecoveryDraft,
} from "@/lib/design-recovery";

function project(overrides: Record<string, unknown> = {}) {
  return {
    version: 3,
    jobName: "Team finals",
    customer: "Accra Academy",
    layers: [{ id: "layer-1", kind: "text", name: "Number" }],
    ...overrides,
  };
}

describe("design recovery", () => {
  it("migrates older projects to the current version without dropping their data", () => {
    const migrated = migrateDesignProject(project({ mirror: false }));

    expect(migrated.version).toBe(DESIGN_PROJECT_VERSION);
    expect(migrated.jobName).toBe("Team finals");
    expect(migrated.mirror).toBe(false);
    expect(migrated.snap).toBe(true);
    expect(migrated.machineProfile).toBe("Generic SVG");
  });

  it("rejects projects created by a newer unsupported studio", () => {
    expect(() => migrateDesignProject(project({ version: DESIGN_PROJECT_VERSION + 1 }))).toThrow(/newer studio version/i);
  });

  it("serializes and restores a size-limited recovery draft", () => {
    const now = new Date("2026-07-27T15:00:00.000Z");
    const serialized = serializeDesignRecoveryDraft({ project: project(), designJobId: "design-1", now });

    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;

    const restored = parseDesignRecoveryDraft({ raw: serialized.value, now: new Date("2026-07-27T15:05:00.000Z") });
    expect(restored?.designJobId).toBe("design-1");
    expect(restored?.project.version).toBe(DESIGN_PROJECT_VERSION);
    expect(restored?.project.jobName).toBe("Team finals");
  });

  it("rejects expired, corrupt and oversized drafts", () => {
    const serialized = serializeDesignRecoveryDraft({
      project: project(),
      designJobId: null,
      now: new Date("2026-07-01T00:00:00.000Z"),
    });
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;

    expect(parseDesignRecoveryDraft({ raw: serialized.value, now: new Date("2026-07-27T00:00:00.000Z") })).toBeNull();
    expect(parseDesignRecoveryDraft({ raw: "not-json" })).toBeNull();
    expect(serializeDesignRecoveryDraft({ project: project({ huge: "x".repeat(500) }), designJobId: null, maxBytes: 100 }).ok).toBe(false);
  });

  it("uses scoped storage keys and recognises meaningful work", () => {
    expect(designRecoveryStorageKey("shop-a:user-a")).not.toBe(designRecoveryStorageKey("shop-a:user-b"));
    expect(isMeaningfulDesignProject({ version: 4, layers: [], jobName: "New design job", customer: "" })).toBe(false);
    expect(isMeaningfulDesignProject({ version: 4, layers: [], jobName: "Final kit", customer: "" })).toBe(true);
    expect(isMeaningfulDesignProject({ version: 4, layers: [{ id: "one" }] })).toBe(true);
  });

  it("offers recovery only when it is newer than the server copy", () => {
    const serialized = serializeDesignRecoveryDraft({
      project: project(),
      designJobId: "design-1",
      now: new Date("2026-07-27T15:00:00.000Z"),
    });
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;

    expect(isRecoveryNewerThanSaved({ draft: serialized.draft, savedDesignUpdatedAt: "2026-07-27T14:59:00.000Z" })).toBe(true);
    expect(isRecoveryNewerThanSaved({ draft: serialized.draft, savedDesignUpdatedAt: "2026-07-27T15:01:00.000Z" })).toBe(false);
  });
});
