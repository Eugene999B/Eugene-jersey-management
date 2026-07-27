import { describe, expect, it } from "vitest";
import {
  designVersionSourceLabel,
  nextDesignVersionNumber,
  safeDesignVersionNumber,
} from "@/lib/design-history";

describe("design history", () => {
  it("advances immutable version numbers", () => {
    expect(nextDesignVersionNumber(null)).toBe(1);
    expect(nextDesignVersionNumber(1)).toBe(2);
    expect(nextDesignVersionNumber(12)).toBe(13);
  });

  it("rejects invalid requested versions", () => {
    expect(safeDesignVersionNumber("7")).toBe(7);
    expect(safeDesignVersionNumber("0")).toBeNull();
    expect(safeDesignVersionNumber("1.5")).toBeNull();
    expect(safeDesignVersionNumber("abc")).toBeNull();
  });

  it("provides operator-facing source labels", () => {
    expect(designVersionSourceLabel("BASELINE")).toBe("Imported baseline");
    expect(designVersionSourceLabel("CREATE")).toBe("Project created");
    expect(designVersionSourceLabel("SAVE")).toBe("Project saved");
  });
});
