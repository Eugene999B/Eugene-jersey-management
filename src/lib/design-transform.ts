import { clampLayerToSheet, type ProductionLayer } from "@/lib/design-production";

export type TransformHandle = "north-west" | "north-east" | "south-east" | "south-west";
export type TransformPoint = { x: number; y: number };
export type TransformSheet = { width: number; height: number };

const handleSigns: Record<TransformHandle, { x: -1 | 1; y: -1 | 1 }> = {
  "north-west": { x: -1, y: -1 },
  "north-east": { x: 1, y: -1 },
  "south-east": { x: 1, y: 1 },
  "south-west": { x: -1, y: 1 },
};

function radians(degrees: number) {
  return degrees * Math.PI / 180;
}

function rotate(point: TransformPoint, degrees: number): TransformPoint {
  const angle = radians(degrees);
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  };
}

function normalizeDegrees(value: number) {
  let normalized = value % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return Math.round(normalized * 10) / 10;
}

export function layerLocalToWorld(
  layer: Pick<ProductionLayer, "x" | "y" | "rotation">,
  point: TransformPoint,
): TransformPoint {
  const rotated = rotate(point, layer.rotation);
  return { x: layer.x + rotated.x, y: layer.y + rotated.y };
}

export function layerWorldToLocal(
  layer: Pick<ProductionLayer, "x" | "y" | "rotation">,
  point: TransformPoint,
): TransformPoint {
  return rotate({ x: point.x - layer.x, y: point.y - layer.y }, -layer.rotation);
}

export function layerHandlePoint(
  layer: Pick<ProductionLayer, "x" | "y" | "width" | "height" | "rotation">,
  handle: TransformHandle,
): TransformPoint {
  const sign = handleSigns[handle];
  return layerLocalToWorld(layer, {
    x: sign.x * layer.width / 2,
    y: sign.y * layer.height / 2,
  });
}

export function layerRotationHandlePoint(
  layer: Pick<ProductionLayer, "x" | "y" | "height" | "rotation">,
  offset = 14,
): TransformPoint {
  return layerLocalToWorld(layer, { x: 0, y: -layer.height / 2 - Math.max(4, offset) });
}

export function resizeLayerFromHandle<T extends ProductionLayer>(input: {
  layer: T;
  handle: TransformHandle;
  point: TransformPoint;
  sheet: TransformSheet;
  preserveAspect?: boolean;
  minimumSize?: number;
}): T {
  const minimumSize = Math.max(1, input.minimumSize ?? 2);
  const sign = handleSigns[input.handle];
  const opposite = {
    x: -sign.x * input.layer.width / 2,
    y: -sign.y * input.layer.height / 2,
  };
  const localPointer = layerWorldToLocal(input.layer, input.point);
  let drag = {
    x: sign.x < 0
      ? Math.min(opposite.x - minimumSize, localPointer.x)
      : Math.max(opposite.x + minimumSize, localPointer.x),
    y: sign.y < 0
      ? Math.min(opposite.y - minimumSize, localPointer.y)
      : Math.max(opposite.y + minimumSize, localPointer.y),
  };

  if (input.preserveAspect) {
    const originalDiagonal = {
      x: sign.x * input.layer.width,
      y: sign.y * input.layer.height,
    };
    const desiredDiagonal = { x: drag.x - opposite.x, y: drag.y - opposite.y };
    const denominator = originalDiagonal.x ** 2 + originalDiagonal.y ** 2;
    const minimumScale = Math.max(minimumSize / input.layer.width, minimumSize / input.layer.height);
    const projectedScale = denominator > 0
      ? (desiredDiagonal.x * originalDiagonal.x + desiredDiagonal.y * originalDiagonal.y) / denominator
      : 1;
    const scale = Math.max(minimumScale, projectedScale);
    drag = {
      x: opposite.x + originalDiagonal.x * scale,
      y: opposite.y + originalDiagonal.y * scale,
    };
  }

  const localCentre = {
    x: (opposite.x + drag.x) / 2,
    y: (opposite.y + drag.y) / 2,
  };
  const worldCentre = layerLocalToWorld(input.layer, localCentre);
  const resized = {
    ...input.layer,
    x: worldCentre.x,
    y: worldCentre.y,
    width: Math.max(minimumSize, Math.abs(drag.x - opposite.x)),
    height: Math.max(minimumSize, Math.abs(drag.y - opposite.y)),
  };
  return clampLayerToSheet(resized, input.sheet);
}

export function rotateLayerToPoint<T extends ProductionLayer>(input: {
  layer: T;
  point: TransformPoint;
  sheet?: TransformSheet;
  snapDegrees?: number;
}): T {
  const raw = Math.atan2(input.point.y - input.layer.y, input.point.x - input.layer.x) * 180 / Math.PI + 90;
  const snap = input.snapDegrees && input.snapDegrees > 0 ? input.snapDegrees : 0;
  const rotation = snap ? Math.round(raw / snap) * snap : raw;
  const rotated = { ...input.layer, rotation: normalizeDegrees(rotation) };
  return input.sheet ? clampLayerToSheet(rotated, input.sheet) : rotated;
}
