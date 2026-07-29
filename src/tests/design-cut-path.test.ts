import { describe, expect, it } from "vitest";
import {
  buildCutDxf,
  buildCutHpgl,
  buildCutSvg,
  buildDesignCutPaths,
  decodeEmbeddedSvgDataUrl,
} from "@/lib/design-cut-path";

const sheet = { width: 200, height: 100 };

function svgData(svg: string) {
  return `data:image/svg+xml;base64,${globalThis.btoa(svg)}`;
}

describe("design cut-path conversion", () => {
  it("converts native shapes and builds machine-unit HPGL", () => {
    const result = buildDesignCutPaths({
      sheet,
      weedBox: false,
      layers: [
        {
          id: "rect-1",
          kind: "rectangle",
          name: "Chest panel",
          visible: true,
          locked: false,
          x: 50,
          y: 30,
          width: 20,
          height: 10,
          rotation: 0,
          color: "#000000",
        },
      ],
    });

    expect(result.errors).toEqual([]);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].closed).toBe(true);

    const hpgl = buildCutHpgl({
      paths: result.paths,
      sheet,
      mirror: false,
      origin: "BOTTOM_LEFT",
      unitsPerMm: 40,
    });
    expect(hpgl).toContain("PU1600,3000");
    expect(hpgl).toContain("PD2400,3000");
  });

  it("flattens embedded SVG groups, curves and arcs into cutter polylines", () => {
    const svg = '<svg viewBox="0 0 100 50"><g transform="translate(5 0)"><path d="M 0 25 C 20 0 40 50 60 25 A 10 10 0 0 1 80 25 L 90 25"/></g></svg>';
    const result = buildDesignCutPaths({
      sheet,
      weedBox: false,
      layers: [
        {
          id: "svg-1",
          kind: "image",
          name: "Vector crest",
          visible: true,
          locked: false,
          x: 100,
          y: 50,
          width: 100,
          height: 50,
          rotation: 0,
          color: "#000000",
          url: svgData(svg),
        },
      ],
    });

    expect(result.errors).toEqual([]);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].points.length).toBeGreaterThan(25);
    expect(result.warnings).toContain("Vector crest: open vector paths will be cut without automatic closure.");

    const dxf = buildCutDxf({ paths: result.paths, sheet, mirror: false, origin: "BOTTOM_LEFT" });
    expect(dxf).toContain("LWPOLYLINE");
    expect(dxf).toContain("$INSUNITS");
  });

  it("queues editable text for automatic outlining while still failing closed for raster and unsupported embedded SVG elements", () => {
    const result = buildDesignCutPaths({
      sheet,
      weedBox: false,
      layers: [
        {
          id: "text-1",
          kind: "text",
          name: "Player name",
          visible: true,
          locked: false,
          x: 50,
          y: 30,
          width: 30,
          height: 10,
          rotation: 0,
          color: "#000000",
        },
        {
          id: "raster-1",
          kind: "image",
          name: "Photograph",
          visible: true,
          locked: false,
          x: 100,
          y: 50,
          width: 30,
          height: 30,
          rotation: 0,
          color: "#000000",
          url: "data:image/png;base64,AA==",
        },
        {
          id: "svg-text",
          kind: "image",
          name: "Unoutlined badge",
          visible: true,
          locked: false,
          x: 150,
          y: 50,
          width: 30,
          height: 30,
          rotation: 0,
          color: "#000000",
          url: svgData('<svg viewBox="0 0 10 10"><text x="1" y="5">EJM</text></svg>'),
        },
      ],
    });

    expect(result.errors.join(" ")).not.toContain("live text must be converted to outlines");
    expect(result.warnings.join(" ")).toContain("automatically outlined");
    expect(result.errors.join(" ")).toContain("raster or externally linked artwork must be traced");
    expect(result.errors.join(" ")).toContain("text elements must be converted to vector paths");
  });

  it("produces a path-only SVG and decodes URL-encoded embedded SVGs", () => {
    const raw = '<svg viewBox="0 0 10 10"><polygon points="0,0 10,0 10,10 0,10"/></svg>';
    const encoded = `data:image/svg+xml,${encodeURIComponent(raw)}`;
    expect(decodeEmbeddedSvgDataUrl(encoded)).toBe(raw);

    const paths = buildDesignCutPaths({
      sheet: { width: 10, height: 10 },
      weedBox: false,
      layers: [
        {
          id: "shape",
          kind: "image",
          name: "Square",
          visible: true,
          locked: false,
          x: 5,
          y: 5,
          width: 10,
          height: 10,
          rotation: 0,
          color: "#000000",
          url: encoded,
        },
      ],
    }).paths;
    const output = buildCutSvg({ paths, sheet: { width: 10, height: 10 }, mirror: true });
    expect(output).toContain("<polyline");
    expect(output).not.toContain("<image");
    expect(output).not.toContain("<text");
  });
});
