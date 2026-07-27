export const DESIGN_PROJECT_VERSION = 6;
export const DESIGN_RECOVERY_VERSION = 1;
export const DESIGN_RECOVERY_MAX_BYTES = 1_800_000;
export const DESIGN_RECOVERY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type DesignProject = Record<string, unknown>;

export type DesignRecoveryDraft = {
  version: typeof DESIGN_RECOVERY_VERSION;
  savedAt: string;
  designJobId: string | null;
  project: DesignProject;
};

type SerializeResult =
  | { ok: true; value: string; draft: DesignRecoveryDraft; bytes: number }
  | { ok: false; reason: "too-large" | "invalid"; bytes?: number };

function objectRecord(value: unknown): DesignProject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as DesignProject
    : null;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function safeScope(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function designRecoveryStorageKey(scope: string) {
  return `ejm:design-recovery:v${DESIGN_RECOVERY_VERSION}:${safeScope(scope)}`;
}

export function migrateDesignProject(value: unknown): DesignProject {
  const project = objectRecord(value);
  if (!project) throw new Error("This design project is not a valid object.");

  const rawVersion = project.version;
  const version = typeof rawVersion === "number" && Number.isInteger(rawVersion)
    ? rawVersion
    : 1;
  if (version < 1) throw new Error("This design project has an invalid version.");
  if (version > DESIGN_PROJECT_VERSION) {
    throw new Error(`This design was created by a newer studio version (${version}). Update the application before opening it.`);
  }
  if (!Array.isArray(project.layers)) throw new Error("This design project has no layers.");

  return {
    ...project,
    version: DESIGN_PROJECT_VERSION,
    copies: project.copies ?? 1,
    showGrid: project.showGrid ?? true,
    snap: project.snap ?? true,
    weedBox: project.weedBox ?? true,
    registrationMarks: project.registrationMarks ?? false,
    contourOffset: project.contourOffset ?? 0,
    machineProfile: project.machineProfile ?? "Generic SVG cutter",
    machineProfileId: project.machineProfileId ?? null,
    machineSettings: objectRecord(project.machineSettings),
  };
}

export function isMeaningfulDesignProject(project: DesignProject) {
  const layers = Array.isArray(project.layers) ? project.layers : [];
  const jobName = typeof project.jobName === "string" ? project.jobName.trim() : "";
  const customer = typeof project.customer === "string" ? project.customer.trim() : "";
  return layers.length > 0 || (jobName !== "" && jobName !== "New design job") || customer !== "";
}

export function serializeDesignRecoveryDraft(input: {
  project: DesignProject;
  designJobId: string | null;
  now?: Date;
  maxBytes?: number;
}): SerializeResult {
  try {
    const project = migrateDesignProject(input.project);
    const draft: DesignRecoveryDraft = {
      version: DESIGN_RECOVERY_VERSION,
      savedAt: (input.now ?? new Date()).toISOString(),
      designJobId: input.designJobId?.slice(0, 100) ?? null,
      project,
    };
    const value = JSON.stringify(draft);
    const bytes = byteLength(value);
    if (bytes > (input.maxBytes ?? DESIGN_RECOVERY_MAX_BYTES)) {
      return { ok: false, reason: "too-large", bytes };
    }
    return { ok: true, value, draft, bytes };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function parseDesignRecoveryDraft(input: {
  raw: string | null;
  now?: Date;
  maxAgeMs?: number;
  maxBytes?: number;
}): DesignRecoveryDraft | null {
  if (!input.raw) return null;
  if (byteLength(input.raw) > (input.maxBytes ?? DESIGN_RECOVERY_MAX_BYTES)) return null;

  try {
    const value = objectRecord(JSON.parse(input.raw));
    if (!value || value.version !== DESIGN_RECOVERY_VERSION) return null;
    if (typeof value.savedAt !== "string") return null;
    const savedAt = new Date(value.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;

    const now = (input.now ?? new Date()).getTime();
    const age = now - savedAt.getTime();
    if (age < -5 * 60 * 1000 || age > (input.maxAgeMs ?? DESIGN_RECOVERY_MAX_AGE_MS)) return null;

    return {
      version: DESIGN_RECOVERY_VERSION,
      savedAt: savedAt.toISOString(),
      designJobId: typeof value.designJobId === "string" ? value.designJobId.slice(0, 100) : null,
      project: migrateDesignProject(value.project),
    };
  } catch {
    return null;
  }
}

export function isRecoveryNewerThanSaved(input: {
  draft: DesignRecoveryDraft;
  savedDesignUpdatedAt?: string | null;
}) {
  if (!input.savedDesignUpdatedAt) return true;
  const saved = new Date(input.savedDesignUpdatedAt).getTime();
  const recovered = new Date(input.draft.savedAt).getTime();
  if (!Number.isFinite(saved) || !Number.isFinite(recovered)) return true;
  return recovered > saved;
}
