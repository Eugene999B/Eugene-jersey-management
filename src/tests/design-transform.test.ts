import { describe, expect, it } from "vitest";
import {
  layerHandlePoint,
  layerRotationHandlePoint,
  resizeLayerFromHandle,
  rotateLayerToPoint,
} from "@/lib/design-transform";

function layer(overrides: Record<string, unknown> = {}) {
  return {
    id: "layer-1",
    kind: "rectangle" as const,
    name: "Rectangle",
    visible: true,
    locked: false,
    x: 50,
    y: 50,
    width: 20,
    height: 10,
    rotation: 0,
    color: "#111827",
    ...overrides,
  };
}

describe("design transform geometry", () => {
  it("places corner and rotation handles in world coordinates", () => {
    expect(layerHandlePoint(layer(), "north-west")).toEqual({ x: 40, y: 45 });
    expect(layerHandlePoint(layer({ rotation: 90 }), "north-west")).toEqual({ x: 55, y: 40 });
    expect(layerRotationHandlePoint(layer(), 10)).toEqual({ x: 50, y: 35 });
  });

  it("resizes from a corner while keeping the opposite corner fixed", () => {
    const resized = resizeLayerFromHandle({
      layer: layer(),
      handle: "south-east",
      point: { x: 70, y: 65 },
      sheet: { width: 200, height: 200 },
    });

    expect(resized.width).toBe(30);
    expect(resized.height).toBe(20);
    expect(resized.x).toBe(55);
    expect(resized.y).toBe(55);
    expect(layerHandlePoint(resized, "north-west")).toEqual({ x: 40, y: 45 });
  });

  it("preserves aspect ratio for image-style transforms", () => {
    const resized = resizeLayerFromHandle({
      layer: layer({ width: 20, height: 10 }),
      handle: "south-east",
      point: { x: 80, y: 65 },
      sheet: { width: 200, height: 200 },
      preserveAspect: true,
    });

    expect(resized.width / resized.height).toBeCloseTo(2, 6);
    expect(resized.width).toBeGreaterThan(20);
  });

  it("keeps resized artwork inside the production sheet", () => {
    const resized = resizeLayerFromHandle({
      layer: layer({ x: 15, y: 15 }),
      handle: "north-west",
      point: { x: -100, y: -100 },
      sheet: { width: 100, height: 100 },
    });

    expect(resized.x - resized.width / 2).toBeGreaterThanOrEqual(0);
    expect(resized.y - resized.height / 2).toBeGreaterThanOrEqual(0);
    expect(resized.width).toBeLessThanOrEqual(100);
    expect(resized.height).toBeLessThanOrEqual(100);
  });

  it("rotates from the top handle and supports angle snapping", () => {
    expect(rotateLayerToPoint({ layer: layer(), point: { x: 50, y: 20 } }).rotation).toBe(0);
    expect(rotateLayerToPoint({ layer: layer(), point: { x: 80, y: 50 } }).rotation).toBe(90);
    expect(rotateLayerToPoint({ layer: layer(), point: { x: 80, y: 42 }, snapDegrees: 15 }).rotation % 15).toBe(0);
  });
});
