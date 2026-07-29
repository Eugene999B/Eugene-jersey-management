import type { CutPath, CutPathLayer, CutPathResult } from "@/lib/design-cut-path";

type PixelPoint = { x: number; y: number };
type TextCutLayer = CutPathLayer & {
  content?: string;
  fontFamily?: string;
  fontWeight?: number;
};

type Edge = {
  start: PixelPoint;
  end: PixelPoint;
  direction: number;
  used: boolean;
};

const DEFAULT_PIXELS_PER_MM = 8;
const MIN_PIXELS_PER_MM = 4;
const MAX_CANVAS_DIMENSION = 4096;
const MAX_CANVAS_PIXELS = 12_000_000;
const ALPHA_THRESHOLD = 96;
const MIN_CONTOUR_AREA_PIXELS = 3;

function key(point: PixelPoint) {
  return `${point.x},${point.y}`;
}

function samePoint(left: PixelPoint, right: PixelPoint) {
  return left.x === right.x && left.y === right.y;
}

function edgeDirection(start: PixelPoint, end: PixelPoint) {
  if (end.x > start.x) return 0;
  if (end.y > start.y) return 1;
  if (end.x < start.x) return 2;
  return 3;
}

function polygonArea(points: PixelPoint[]) {
  let area = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    area += points[index].x * points[index + 1].y - points[index + 1].x * points[index].y;
  }
  return area / 2;
}

function distanceToSegment(point: PixelPoint, start: PixelPoint, end: PixelPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

function simplifyOpen(points: PixelPoint[], tolerance: number): PixelPoint[] {
  if (points.length <= 2) return points;
  let furthestDistance = 0;
  let furthestIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(points[index], points[0], points.at(-1) as PixelPoint);
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }
  if (furthestDistance <= tolerance) return [points[0], points.at(-1) as PixelPoint];
  const left = simplifyOpen(points.slice(0, furthestIndex + 1), tolerance);
  const right = simplifyOpen(points.slice(furthestIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function simplifyClosed(points: PixelPoint[], tolerance: number) {
  const open = samePoint(points[0], points.at(-1) as PixelPoint) ? points.slice(0, -1) : [...points];
  if (open.length <= 4) return [...open, open[0]];
  let anchorIndex = 0;
  for (let index = 1; index < open.length; index += 1) {
    if (open[index].x < open[anchorIndex].x || (open[index].x === open[anchorIndex].x && open[index].y < open[anchorIndex].y)) {
      anchorIndex = index;
    }
  }
  const rotated = [...open.slice(anchorIndex), ...open.slice(0, anchorIndex)];
  let splitIndex = 1;
  let splitDistance = 0;
  for (let index = 1; index < rotated.length; index += 1) {
    const distance = Math.hypot(rotated[index].x - rotated[0].x, rotated[index].y - rotated[0].y);
    if (distance > splitDistance) {
      splitDistance = distance;
      splitIndex = index;
    }
  }
  const first = simplifyOpen(rotated.slice(0, splitIndex + 1), tolerance);
  const second = simplifyOpen([...rotated.slice(splitIndex), rotated[0]], tolerance);
  const simplified = [...first.slice(0, -1), ...second];
  return samePoint(simplified[0], simplified.at(-1) as PixelPoint) ? simplified : [...simplified, simplified[0]];
}

function chooseNextEdge(edges: Edge[], candidates: number[], incomingDirection: number) {
  const preference = [1, 0, 3, 2];
  return candidates.sort((left, right) => {
    const leftTurn = (edges[left].direction - incomingDirection + 4) % 4;
    const rightTurn = (edges[right].direction - incomingDirection + 4) % 4;
    return preference.indexOf(leftTurn) - preference.indexOf(rightTurn);
  })[0];
}

export function traceBinaryMask(mask: Uint8Array, width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || mask.length !== width * height) return [];
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  const edges: Edge[] = [];
  const outgoing = new Map<string, number[]>();
  const addEdge = (start: PixelPoint, end: PixelPoint) => {
    const index = edges.length;
    edges.push({ start, end, direction: edgeDirection(start, end), used: false });
    const startKey = key(start);
    outgoing.set(startKey, [...(outgoing.get(startKey) ?? []), index]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!filled(x, y)) continue;
      if (!filled(x, y - 1)) addEdge({ x, y }, { x: x + 1, y });
      if (!filled(x + 1, y)) addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
      if (!filled(x, y + 1)) addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
      if (!filled(x - 1, y)) addEdge({ x, y: y + 1 }, { x, y });
    }
  }

  const contours: PixelPoint[][] = [];
  for (let startIndex = 0; startIndex < edges.length; startIndex += 1) {
    if (edges[startIndex].used) continue;
    const contour: PixelPoint[] = [edges[startIndex].start];
    let edgeIndex = startIndex;
    let guard = 0;
    while (guard <= edges.length) {
      guard += 1;
      const edge = edges[edgeIndex];
      if (edge.used) break;
      edge.used = true;
      contour.push(edge.end);
      if (samePoint(edge.end, contour[0])) break;
      const candidates = (outgoing.get(key(edge.end)) ?? []).filter((candidate) => !edges[candidate].used);
      if (!candidates.length) break;
      edgeIndex = chooseNextEdge(edges, candidates, edge.direction);
    }
    if (!samePoint(contour[0], contour.at(-1) as PixelPoint) || contour.length < 5) continue;
    if (Math.abs(polygonArea(contour)) < MIN_CONTOUR_AREA_PIXELS) continue;
    contours.push(simplifyClosed(contour, 1.1));
  }
  return contours;
}

function rotateAndTranslate(point: PixelPoint, layer: Pick<TextCutLayer, "x" | "y" | "rotation">) {
  const radians = layer.rotation * Math.PI / 180;
  return {
    x: layer.x + point.x * Math.cos(radians) - point.y * Math.sin(radians),
    y: layer.y + point.x * Math.sin(radians) + point.y * Math.cos(radians),
  };
}

async function waitForFont(font: string, weight: number, sample: string) {
  if (!("fonts" in document)) return false;
  const descriptor = `${weight} 32px ${JSON.stringify(font)}`;
  try {
    await document.fonts.load(descriptor, sample.slice(0, 100));
    await document.fonts.ready;
    return document.fonts.check(descriptor, sample.slice(0, 100));
  } catch {
    return false;
  }
}

function canvasPlan(layer: TextCutLayer, text: string, fontFamily: string, fontWeight: number) {
  let pixelsPerMm = DEFAULT_PIXELS_PER_MM;
  while (pixelsPerMm >= MIN_PIXELS_PER_MM) {
    const probe = document.createElement("canvas").getContext("2d");
    if (!probe) return null;
    const fontSize = Math.max(1, layer.height * pixelsPerMm);
    probe.font = `${fontWeight} ${fontSize}px ${JSON.stringify(fontFamily)}`;
    const metrics = probe.measureText(text);
    const padding = Math.max(8, Math.ceil(fontSize * 0.2));
    const measuredHeight = Math.max(fontSize * 1.35, (metrics.actualBoundingBoxAscent || fontSize) + (metrics.actualBoundingBoxDescent || fontSize * 0.3));
    const width = Math.max(8, Math.ceil(Math.max(layer.width * pixelsPerMm, metrics.width) + padding * 2));
    const height = Math.max(8, Math.ceil(Math.max(layer.height * pixelsPerMm, measuredHeight) + padding * 2));
    if (width <= MAX_CANVAS_DIMENSION && height <= MAX_CANVAS_DIMENSION && width * height <= MAX_CANVAS_PIXELS) {
      return { pixelsPerMm, width, height, padding, fontSize };
    }
    pixelsPerMm -= 1;
  }
  return null;
}

async function outlineTextLayer(layer: TextCutLayer): Promise<CutPathResult & { converted: number }> {
  const text = (layer.content ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { paths: [], errors: [`${layer.name}: empty text cannot be outlined.`], warnings: [], converted: 0 };
  if (typeof document === "undefined") return { paths: [], errors: [`${layer.name}: automatic text outlining requires a browser canvas.`], warnings: [], converted: 0 };

  const fontFamily = layer.fontFamily?.trim() || "Arial";
  const fontWeight = Math.max(100, Math.min(900, Math.round(layer.fontWeight ?? 700)));
  const exactFont = await waitForFont(fontFamily, fontWeight, text);
  const plan = canvasPlan(layer, text, fontFamily, fontWeight);
  if (!plan) return { paths: [], errors: [`${layer.name}: text is too large to outline safely. Reduce its size or split it into shorter text layers.`], warnings: [], converted: 0 };

  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { paths: [], errors: [`${layer.name}: this browser could not create the text outline canvas.`], warnings: [], converted: 0 };

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  context.font = `${fontWeight} ${plan.fontSize}px ${JSON.stringify(fontFamily)}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const mask = new Uint8Array(canvas.width * canvas.height);
  for (let index = 0; index < mask.length; index += 1) {
    mask[index] = pixels[index * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
  }

  const contours = traceBinaryMask(mask, canvas.width, canvas.height);
  const paths = contours.map((contour): CutPath => ({
    source: `${layer.name} · automatic text outline`,
    closed: true,
    points: contour.map((point) => rotateAndTranslate({
      x: (point.x - canvas.width / 2) / plan.pixelsPerMm,
      y: (point.y - canvas.height / 2) / plan.pixelsPerMm,
    }, layer)),
  })).filter((path) => path.points.length >= 4);

  if (!paths.length) return { paths: [], errors: [`${layer.name}: no usable letter outlines could be generated.`], warnings: [], converted: 0 };
  const warnings = exactFont
    ? [`${layer.name}: editable text will be automatically outlined during cutter export.`]
    : [`${layer.name}: the selected font was unavailable, so the browser fallback font was automatically outlined. Review the downloaded cut preview before production.`];
  return { paths, errors: [], warnings, converted: 1 };
}

export async function outlineDesignTextLayers(layers: TextCutLayer[]) {
  const result: CutPathResult & { converted: number } = { paths: [], errors: [], warnings: [], converted: 0 };
  for (const layer of layers.filter((candidate) => candidate.visible && candidate.kind === "text")) {
    const outlined = await outlineTextLayer(layer);
    result.paths.push(...outlined.paths);
    result.errors.push(...outlined.errors);
    result.warnings.push(...outlined.warnings);
    result.converted += outlined.converted;
  }
  return result;
}
