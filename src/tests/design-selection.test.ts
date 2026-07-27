import { describe, expect, it } from "vitest";
import {
  groupSelectedLayers,
  moveSelectedLayers,
  selectLayerUnit,
  ungroupSelectedLayers,
  type GroupableProductionLayer,
} from "@/lib/design-selection";

function layer(id: string, overrides: Partial<GroupableProductionLayer> = {}): GroupableProductionLayer {
  return {
    id,
    kind: "rectangle",
    name: id,
    visible: true,
    locked: false,
    x: 20,
    y: 20,
    width: 10,
    height: 10,
    rotation: 0,
    color: "#111827",
    ...overrides,
  };
}

describe("design selection", () => {
  it("selects grouped layers as one unit and supports additive toggling", () => {
    const layers = [layer("a", { groupId: "g1" }), layer("b", { groupId: "g1" }), layer("c")];

    expect(selectLayerUnit({ layers, selectedIds: [], layerId: "a", additive: false })).toEqual(["a", "b"]);
    expect(selectLayerUnit({ layers, selectedIds: ["c"], layerId: "a", additive: true }).sort()).toEqual(["a", "b", "c"]);
    expect(selectLayerUnit({ layers, selectedIds: ["a", "b", "c"], layerId: "a", additive: true })).toEqual(["c"]);
  });

  it("groups selected layers and ungroups the complete selected group", () => {
    const grouped = groupSelectedLayers([layer("a"), layer("b"), layer("c")], ["a", "b"], "group-1");
    expect(grouped.find((item) => item.id === "a")?.groupId).toBe("group-1");
    expect(grouped.find((item) => item.id === "b")?.groupId).toBe("group-1");
    expect(grouped.find((item) => item.id === "c")?.groupId).toBeUndefined();

    const ungrouped = ungroupSelectedLayers(grouped, ["a"]);
    expect(ungrouped.find((item) => item.id === "a")?.groupId).toBeUndefined();
    expect(ungrouped.find((item) => item.id === "b")?.groupId).toBeUndefined();
  });

  it("moves a multi-selection together while clamping the whole selection to the sheet", () => {
    const layers = [layer("a", { x: 10 }), layer("b", { x: 30 })];
    const moved = moveSelectedLayers({ layers, selectedIds: ["a", "b"], dx: -20, dy: 5, sheet: { width: 100, height: 100 } });

    expect(moved.find((item) => item.id === "a")?.x).toBe(5);
    expect(moved.find((item) => item.id === "b")?.x).toBe(25);
    expect(moved.find((item) => item.id === "a")?.y).toBe(25);
    expect(moved.find((item) => item.id === "b")?.y).toBe(25);
  });

  it("leaves locked selected layers in place", () => {
    const layers = [layer("a", { locked: true }), layer("b")];
    const moved = moveSelectedLayers({ layers, selectedIds: ["a", "b"], dx: 10, dy: 0, sheet: { width: 100, height: 100 } });

    expect(moved.find((item) => item.id === "a")?.x).toBe(20);
    expect(moved.find((item) => item.id === "b")?.x).toBe(30);
  });
});
