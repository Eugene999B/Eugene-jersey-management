import type { ProductionLayer } from "@/lib/design-production";

export type GroupableProductionLayer = ProductionLayer & { groupId?: string };

type SheetSize = { width: number; height: number };

function uniqueIds(values: string[]) {
  return Array.from(new Set(values));
}

function rotatedHalfExtents(layer: Pick<ProductionLayer, "width" | "height" | "rotation">) {
  const angle = layer.rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  return {
    x: (layer.width * cosine + layer.height * sine) / 2,
    y: (layer.width * sine + layer.height * cosine) / 2,
  };
}

export function selectionMembersForLayer<T extends GroupableProductionLayer>(layers: T[], layerId: string) {
  const layer = layers.find((item) => item.id === layerId);
  if (!layer) return [];
  if (!layer.groupId) return [layer.id];
  return layers.filter((item) => item.groupId === layer.groupId).map((item) => item.id);
}

export function selectLayerUnit<T extends GroupableProductionLayer>(input: {
  layers: T[];
  selectedIds: string[];
  layerId: string;
  additive: boolean;
}) {
  const unit = selectionMembersForLayer(input.layers, input.layerId);
  if (!unit.length) return input.selectedIds;
  if (!input.additive) return unit;

  const current = new Set(input.selectedIds);
  const fullySelected = unit.every((id) => current.has(id));
  for (const id of unit) {
    if (fullySelected) current.delete(id);
    else current.add(id);
  }
  return uniqueIds(Array.from(current));
}

export function groupSelectedLayers<T extends GroupableProductionLayer>(layers: T[], selectedIds: string[], groupId: string) {
  const selection = new Set(selectedIds);
  if (selection.size < 2 || !groupId.trim()) return layers;
  return layers.map((layer) => selection.has(layer.id) ? { ...layer, groupId } : layer) as T[];
}

export function ungroupSelectedLayers<T extends GroupableProductionLayer>(layers: T[], selectedIds: string[]) {
  const selection = new Set(selectedIds);
  const groupIds = new Set(layers.filter((layer) => selection.has(layer.id) && layer.groupId).map((layer) => layer.groupId as string));
  if (!groupIds.size) return layers;
  return layers.map((layer) => layer.groupId && groupIds.has(layer.groupId)
    ? { ...layer, groupId: undefined }
    : layer) as T[];
}

export function moveSelectedLayers<T extends GroupableProductionLayer>(input: {
  layers: T[];
  selectedIds: string[];
  dx: number;
  dy: number;
  sheet: SheetSize;
}) {
  const selected = new Set(input.selectedIds);
  const movable = input.layers.filter((layer) => selected.has(layer.id) && !layer.locked);
  if (!movable.length) return input.layers;

  const horizontal = movable.map((layer) => {
    const half = rotatedHalfExtents(layer);
    return { min: half.x - layer.x, max: input.sheet.width - half.x - layer.x };
  });
  const vertical = movable.map((layer) => {
    const half = rotatedHalfExtents(layer);
    return { min: half.y - layer.y, max: input.sheet.height - half.y - layer.y };
  });

  const minDx = Math.max(...horizontal.map((range) => range.min));
  const maxDx = Math.min(...horizontal.map((range) => range.max));
  const minDy = Math.max(...vertical.map((range) => range.min));
  const maxDy = Math.min(...vertical.map((range) => range.max));
  const safeDx = Math.max(minDx, Math.min(maxDx, Number.isFinite(input.dx) ? input.dx : 0));
  const safeDy = Math.max(minDy, Math.min(maxDy, Number.isFinite(input.dy) ? input.dy : 0));

  return input.layers.map((layer) => selected.has(layer.id) && !layer.locked
    ? { ...layer, x: layer.x + safeDx, y: layer.y + safeDy }
    : layer) as T[];
}
