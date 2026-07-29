import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { traceBinaryMask } from "@/lib/design-text-outline";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("automatic cutter text outlines", () => {
  it("traces both outside and inside contours from a letter-like binary mask", () => {
    const width = 7;
    const height = 7;
    const mask = new Uint8Array(width * height);
    for (let y = 1; y <= 5; y += 1) {
      for (let x = 1; x <= 5; x += 1) {
        if (x === 1 || x === 5 || y === 1 || y === 5) mask[y * width + x] = 1;
      }
    }

    const contours = traceBinaryMask(mask, width, height);
    expect(contours).toHaveLength(2);
    expect(contours.every((contour) => contour.length >= 5)).toBe(true);
    expect(contours.every((contour) => contour[0].x === contour.at(-1)?.x && contour[0].y === contour.at(-1)?.y)).toBe(true);
  });

  it("keeps editable project text while outlining only the production copy", () => {
    const studio = source("components/design/production-studio-advanced.tsx");
    const outline = source("lib/design-text-outline.ts");
    expect(studio).toContain("outlineDesignTextLayers(layers)");
    expect(studio).toContain("editable text stays editable");
    expect(studio).toContain("Preparing cutter paths");
    expect(outline).toContain("document.createElement(\"canvas\")");
    expect(outline).toContain("traceBinaryMask");
    expect(outline).toContain("automatic text outline");
  });
});
