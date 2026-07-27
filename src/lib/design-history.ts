export const DESIGN_VERSION_HISTORY_LIMIT = 20;

export type DesignVersionSource = "BASELINE" | "CREATE" | "SAVE";

export function nextDesignVersionNumber(currentMaximum: number | null | undefined) {
  const value = typeof currentMaximum === "number" && Number.isInteger(currentMaximum) && currentMaximum > 0
    ? currentMaximum
    : 0;
  return value + 1;
}

export function designVersionSourceLabel(source: string) {
  if (source === "BASELINE") return "Imported baseline";
  if (source === "CREATE") return "Project created";
  return "Project saved";
}

export function safeDesignVersionNumber(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const version = Number(value);
  return Number.isSafeInteger(version) && version > 0 ? version : null;
}
