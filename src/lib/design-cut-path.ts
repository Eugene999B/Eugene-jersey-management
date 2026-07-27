import type { ProductionLayer } from "@/lib/design-production";
import type { MachineOrigin } from "@/lib/design-machine-profile";

export type CutPoint = { x: number; y: number };
export type CutPath = {
  source: string;
  points: CutPoint[];
  closed: boolean;
};

export type CutPathLayer = ProductionLayer & {
  url?: string;
};

export type CutPathResult = {
  paths: CutPath[];
  errors: string[];
  warnings: string[];
};

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const DRAWABLE_TAGS = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const SKIPPED_CONTAINER_TAGS = new Set(["defs", "clippath", "mask", "pattern", "symbol", "metadata", "title", "desc"]);
const UNSUPPORTED_DRAWABLE_TAGS = new Set(["text", "image", "use", "foreignobject"]);

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function applyMatrix(matrix: Matrix, point: CutPoint): CutPoint {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}

function translate(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y];
}

function scale(x: number, y: number): Matrix {
  return [x, 0, 0, y, 0, 0];
}

function rotate(degrees: number): Matrix {
  const radians = degrees * Math.PI / 180;
  return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
}

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function parseAttributes(source: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

function numbers(value: string | undefined) {
  if (!value) return [];
  return (value.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
}

function parseTransform(value: string | undefined): Matrix {
  if (!value) return IDENTITY;
  let matrix = IDENTITY;
  const pattern = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  for (const match of value.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    const args = numbers(match[2]);
    let next = IDENTITY;
    if (name === "matrix" && args.length >= 6) {
      next = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (name === "translate") {
      next = translate(args[0] ?? 0, args[1] ?? 0);
    } else if (name === "scale") {
      next = scale(args[0] ?? 1, args[1] ?? args[0] ?? 1);
    } else if (name === "rotate") {
      const rotation = rotate(args[0] ?? 0);
      next = args.length >= 3
        ? multiply(translate(args[1], args[2]), multiply(rotation, translate(-args[1], -args[2])))
        : rotation;
    } else if (name === "skewx") {
      next = [1, 0, Math.tan((args[0] ?? 0) * Math.PI / 180), 1, 0, 0];
    } else if (name === "skewy") {
      next = [1, Math.tan((args[0] ?? 0) * Math.PI / 180), 0, 1, 0, 0];
    }
    matrix = multiply(matrix, next);
  }
  return matrix;
}

function layerMatrix(layer: Pick<ProductionLayer, "x" | "y" | "rotation">): Matrix {
  return multiply(translate(layer.x, layer.y), rotate(layer.rotation));
}

function pushUnique(points: CutPoint[], point: CutPoint) {
  const previous = points.at(-1);
  if (!previous || Math.abs(previous.x - point.x) > 0.0001 || Math.abs(previous.y - point.y) > 0.0001) {
    points.push({ x: finite(point.x), y: finite(point.y) });
  }
}

function cubicPoint(start: CutPoint, control1: CutPoint, control2: CutPoint, end: CutPoint, t: number): CutPoint {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y,
  };
}

function quadraticPoint(start: CutPoint, control: CutPoint, end: CutPoint, t: number): CutPoint {
  const inverse = 1 - t;
  return {
    x: inverse ** 2 * start.x + 2 * inverse * t * control.x + t ** 2 * end.x,
    y: inverse ** 2 * start.y + 2 * inverse * t * control.y + t ** 2 * end.y,
  };
}

function vectorAngle(u: CutPoint, v: CutPoint) {
  const dot = u.x * v.x + u.y * v.y;
  const length = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  if (!length) return 0;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot / length)));
  return (u.x * v.y - u.y * v.x < 0 ? -1 : 1) * angle;
}

function arcPoints(start: CutPoint, end: CutPoint, rxInput: number, ryInput: number, rotationDegrees: number, largeArc: boolean, sweep: boolean) {
  let rx = Math.abs(rxInput);
  let ry = Math.abs(ryInput);
  if (!rx || !ry || (Math.abs(start.x - end.x) < 0.0001 && Math.abs(start.y - end.y) < 0.0001)) return [end];

  const phi = rotationDegrees * Math.PI / 180;
  const cosine = Math.cos(phi);
  const sine = Math.sin(phi);
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const xPrime = cosine * dx + sine * dy;
  const yPrime = -sine * dx + cosine * dy;
  const radiusScale = xPrime ** 2 / rx ** 2 + yPrime ** 2 / ry ** 2;
  if (radiusScale > 1) {
    const factor = Math.sqrt(radiusScale);
    rx *= factor;
    ry *= factor;
  }

  const numerator = Math.max(0, rx ** 2 * ry ** 2 - rx ** 2 * yPrime ** 2 - ry ** 2 * xPrime ** 2);
  const denominator = rx ** 2 * yPrime ** 2 + ry ** 2 * xPrime ** 2;
  const sign = largeArc === sweep ? -1 : 1;
  const coefficient = denominator ? sign * Math.sqrt(numerator / denominator) : 0;
  const cxPrime = coefficient * (rx * yPrime / ry);
  const cyPrime = coefficient * (-ry * xPrime / rx);
  const centre = {
    x: cosine * cxPrime - sine * cyPrime + (start.x + end.x) / 2,
    y: sine * cxPrime + cosine * cyPrime + (start.y + end.y) / 2,
  };

  const startVector = { x: (xPrime - cxPrime) / rx, y: (yPrime - cyPrime) / ry };
  const endVector = { x: (-xPrime - cxPrime) / rx, y: (-yPrime - cyPrime) / ry };
  const startAngle = vectorAngle({ x: 1, y: 0 }, startVector);
  let sweepAngle = vectorAngle(startVector, endVector);
  if (!sweep && sweepAngle > 0) sweepAngle -= Math.PI * 2;
  if (sweep && sweepAngle < 0) sweepAngle += Math.PI * 2;
  const segments = Math.max(8, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 12)));

  return Array.from({ length: segments }, (_, index) => {
    const angle = startAngle + sweepAngle * ((index + 1) / segments);
    const x = rx * Math.cos(angle);
    const y = ry * Math.sin(angle);
    return {
      x: centre.x + cosine * x - sine * y,
      y: centre.y + sine * x + cosine * y,
    };
  });
}

function parsePathData(value: string): Array<{ points: CutPoint[]; closed: boolean }> {
  const tokens = value.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const output: Array<{ points: CutPoint[]; closed: boolean }> = [];
  let index = 0;
  let command = "";
  let current = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let points: CutPoint[] = [];
  let lastCubic: CutPoint | null = null;
  let lastQuadratic: CutPoint | null = null;

  const isCommand = (token: string | undefined) => Boolean(token && /^[a-zA-Z]$/.test(token));
  const read = () => Number(tokens[index++]);
  const hasNumbers = () => index < tokens.length && !isCommand(tokens[index]);
  const flush = (closed = false) => {
    if (points.length > 1) output.push({ points, closed });
    points = [];
  };
  const lineTo = (point: CutPoint) => {
    pushUnique(points, point);
    current = point;
  };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command) throw new Error("SVG path data starts without a command.");
    const upper = command.toUpperCase();
    const relative = command !== upper;
    const coordinate = (x: number, y: number) => relative ? { x: current.x + x, y: current.y + y } : { x, y };

    if (upper === "Z") {
      if (points.length) {
        pushUnique(points, start);
        current = start;
        flush(true);
      }
      lastCubic = null;
      lastQuadratic = null;
      command = "";
      continue;
    }

    if (!hasNumbers()) throw new Error(`SVG path command ${command} has no coordinates.`);

    if (upper === "M") {
      let first = true;
      while (hasNumbers()) {
        const point = coordinate(read(), read());
        if (first) {
          flush(false);
          current = point;
          start = point;
          points = [point];
          first = false;
        } else {
          lineTo(point);
        }
      }
      command = relative ? "l" : "L";
    } else if (upper === "L") {
      while (hasNumbers()) lineTo(coordinate(read(), read()));
    } else if (upper === "H") {
      while (hasNumbers()) {
        const x = read();
        lineTo({ x: relative ? current.x + x : x, y: current.y });
      }
    } else if (upper === "V") {
      while (hasNumbers()) {
        const y = read();
        lineTo({ x: current.x, y: relative ? current.y + y : y });
      }
    } else if (upper === "C") {
      while (hasNumbers()) {
        const c1 = coordinate(read(), read());
        const c2 = coordinate(read(), read());
        const end = coordinate(read(), read());
        const segmentStart = current;
        for (let step = 1; step <= 18; step += 1) lineTo(cubicPoint(segmentStart, c1, c2, end, step / 18));
        lastCubic = c2;
        lastQuadratic = null;
      }
    } else if (upper === "S") {
      while (hasNumbers()) {
        const c1 = lastCubic ? { x: current.x * 2 - lastCubic.x, y: current.y * 2 - lastCubic.y } : current;
        const c2 = coordinate(read(), read());
        const end = coordinate(read(), read());
        const segmentStart = current;
        for (let step = 1; step <= 18; step += 1) lineTo(cubicPoint(segmentStart, c1, c2, end, step / 18));
        lastCubic = c2;
        lastQuadratic = null;
      }
    } else if (upper === "Q") {
      while (hasNumbers()) {
        const control = coordinate(read(), read());
        const end = coordinate(read(), read());
        const segmentStart = current;
        for (let step = 1; step <= 16; step += 1) lineTo(quadraticPoint(segmentStart, control, end, step / 16));
        lastQuadratic = control;
        lastCubic = null;
      }
    } else if (upper === "T") {
      while (hasNumbers()) {
        const control: CutPoint = lastQuadratic ? { x: current.x * 2 - lastQuadratic.x, y: current.y * 2 - lastQuadratic.y } : current;
        const end = coordinate(read(), read());
        const segmentStart = current;
        for (let step = 1; step <= 16; step += 1) lineTo(quadraticPoint(segmentStart, control, end, step / 16));
        lastQuadratic = control;
        lastCubic = null;
      }
    } else if (upper === "A") {
      while (hasNumbers()) {
        const rx = read();
        const ry = read();
        const rotationDegrees = read();
        const largeArc = read() !== 0;
        const sweep = read() !== 0;
        const end = coordinate(read(), read());
        for (const point of arcPoints(current, end, rx, ry, rotationDegrees, largeArc, sweep)) lineTo(point);
        lastCubic = null;
        lastQuadratic = null;
      }
    } else {
      throw new Error(`SVG path command ${command} is not supported for cutting.`);
    }
  }

  flush(false);
  return output;
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, segments = 72) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function rootViewBoxMatrix(attributes: Record<string, string>, layer: Pick<ProductionLayer, "width" | "height">) {
  const viewBox = numbers(attributes.viewbox);
  const sourceWidth = viewBox.length >= 4 ? viewBox[2] : Number.parseFloat(attributes.width ?? "");
  const sourceHeight = viewBox.length >= 4 ? viewBox[3] : Number.parseFloat(attributes.height ?? "");
  const minX = viewBox.length >= 4 ? viewBox[0] : 0;
  const minY = viewBox.length >= 4 ? viewBox[1] : 0;
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error("Embedded SVG artwork needs a positive viewBox or width and height.");
  const fit = Math.min(layer.width / sourceWidth, layer.height / sourceHeight);
  const offsetX = (layer.width - sourceWidth * fit) / 2;
  const offsetY = (layer.height - sourceHeight * fit) / 2;
  return multiply(
    translate(-layer.width / 2 + offsetX - minX * fit, -layer.height / 2 + offsetY - minY * fit),
    scale(fit, fit),
  );
}

function transformPath(path: { points: CutPoint[]; closed: boolean }, matrix: Matrix, source: string): CutPath {
  return {
    source,
    closed: path.closed,
    points: path.points.map((point) => applyMatrix(matrix, point)),
  };
}

function parseEmbeddedSvg(svg: string, layer: CutPathLayer): CutPathResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const paths: CutPath[] = [];
  const tagPattern = /<\/?([A-Za-z][\w:-]*)([^>]*)>/g;
  const stack: Array<{ name: string; matrix: Matrix; skipped: boolean }> = [];
  let rootSeen = false;
  for (const match of svg.matchAll(tagPattern)) {
    const raw = match[0];
    if (raw.startsWith("<!--") || raw.startsWith("<!") || raw.startsWith("<?")) continue;
    const closing = raw.startsWith("</");
    const selfClosing = /\/\s*>$/.test(raw);
    const name = match[1].toLowerCase();

    if (closing) {
      if (name === "svg" || name === "g" || SKIPPED_CONTAINER_TAGS.has(name)) {
        while (stack.length) {
          const popped = stack.pop();
          if (popped?.name === name) break;
        }
      }
      continue;
    }

    const attributes = parseAttributes(match[2]);
    const parent = stack.at(-1);
    const inheritedMatrix = parent?.matrix ?? IDENTITY;
    const inheritedSkip = parent?.skipped ?? false;
    let currentMatrix = inheritedMatrix;
    let skipped = inheritedSkip || SKIPPED_CONTAINER_TAGS.has(name);

    if (name === "svg") {
      if (!rootSeen) {
        rootSeen = true;
        try {
          currentMatrix = multiply(layerMatrix(layer), multiply(rootViewBoxMatrix(attributes, layer), parseTransform(attributes.transform)));
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "Embedded SVG dimensions are invalid.");
          skipped = true;
        }
      } else {
        errors.push(`${layer.name}: nested SVG viewports must be flattened before cutting.`);
        skipped = true;
      }
    } else {
      currentMatrix = multiply(inheritedMatrix, parseTransform(attributes.transform));
    }

    if (!skipped && UNSUPPORTED_DRAWABLE_TAGS.has(name)) {
      errors.push(`${layer.name}: embedded SVG ${name} elements must be converted to vector paths before cutting.`);
    }

    if (!skipped && DRAWABLE_TAGS.has(name)) {
      try {
        const source = `${layer.name} ${name}`;
        if (name === "path") {
          const data = attributes.d;
          if (!data) throw new Error("A path element has no d attribute.");
          for (const path of parsePathData(data)) paths.push(transformPath(path, currentMatrix, source));
        } else if (name === "rect") {
          const x = Number.parseFloat(attributes.x ?? "0") || 0;
          const y = Number.parseFloat(attributes.y ?? "0") || 0;
          const width = Number.parseFloat(attributes.width ?? "0");
          const height = Number.parseFloat(attributes.height ?? "0");
          if (!(width > 0) || !(height > 0)) throw new Error("A rectangle has no positive width and height.");
          if ((Number.parseFloat(attributes.rx ?? "0") || Number.parseFloat(attributes.ry ?? "0")) > 0) warnings.push(`${layer.name}: rounded rectangle corners were exported as square cutter corners.`);
          paths.push(transformPath({ closed: true, points: [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }] }, currentMatrix, source));
        } else if (name === "circle" || name === "ellipse") {
          const cx = Number.parseFloat(attributes.cx ?? "0") || 0;
          const cy = Number.parseFloat(attributes.cy ?? "0") || 0;
          const rx = Number.parseFloat(attributes.rx ?? attributes.r ?? "0");
          const ry = Number.parseFloat(attributes.ry ?? attributes.r ?? "0");
          if (!(rx > 0) || !(ry > 0)) throw new Error("A circle or ellipse has no positive radius.");
          paths.push(transformPath({ closed: true, points: ellipsePoints(cx, cy, rx, ry) }, currentMatrix, source));
        } else if (name === "line") {
          paths.push(transformPath({ closed: false, points: [
            { x: Number.parseFloat(attributes.x1 ?? "0") || 0, y: Number.parseFloat(attributes.y1 ?? "0") || 0 },
            { x: Number.parseFloat(attributes.x2 ?? "0") || 0, y: Number.parseFloat(attributes.y2 ?? "0") || 0 },
          ] }, currentMatrix, source));
        } else {
          const values = numbers(attributes.points);
          if (values.length < 4 || values.length % 2 !== 0) throw new Error(`${name} points are incomplete.`);
          const points = Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
          const closed = name === "polygon";
          if (closed) pushUnique(points, points[0]);
          paths.push(transformPath({ closed, points }, currentMatrix, source));
        }
      } catch (error) {
        errors.push(`${layer.name}: ${error instanceof Error ? error.message : "vector geometry could not be converted."}`);
      }
    }

    if (!selfClosing && (name === "svg" || name === "g" || SKIPPED_CONTAINER_TAGS.has(name))) {
      stack.push({ name, matrix: currentMatrix, skipped });
    }
  }

  if (!rootSeen) errors.push(`${layer.name}: the embedded file is not an SVG document.`);
  if (!paths.length && !errors.length) errors.push(`${layer.name}: no cutter paths were found in the embedded SVG.`);
  if (paths.some((path) => !path.closed)) warnings.push(`${layer.name}: open vector paths will be cut without automatic closure.`);
  return { paths, errors, warnings };
}

export function decodeEmbeddedSvgDataUrl(url: string | undefined) {
  if (!url?.toLowerCase().startsWith("data:image/svg+xml")) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const metadata = url.slice(0, comma).toLowerCase();
  const payload = url.slice(comma + 1);
  try {
    return metadata.includes(";base64") ? globalThis.atob(payload) : decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function nativeLayerPath(layer: CutPathLayer): CutPath | null {
  const matrix = layerMatrix(layer);
  if (layer.kind === "rectangle") {
    return transformPath({ closed: true, points: [
      { x: -layer.width / 2, y: -layer.height / 2 },
      { x: layer.width / 2, y: -layer.height / 2 },
      { x: layer.width / 2, y: layer.height / 2 },
      { x: -layer.width / 2, y: layer.height / 2 },
      { x: -layer.width / 2, y: -layer.height / 2 },
    ] }, matrix, layer.name);
  }
  if (layer.kind === "circle") {
    return transformPath({ closed: true, points: ellipsePoints(0, 0, layer.width / 2, layer.height / 2) }, matrix, layer.name);
  }
  return null;
}

function validPath(path: CutPath) {
  return path.points.length >= 2 && path.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function buildDesignCutPaths(input: {
  layers: CutPathLayer[];
  sheet: { width: number; height: number };
  weedBox?: boolean;
  registrationMarks?: boolean;
}): CutPathResult {
  const result: CutPathResult = { paths: [], errors: [], warnings: [] };
  for (const layer of input.layers.filter((candidate) => candidate.visible)) {
    const native = nativeLayerPath(layer);
    if (native) {
      result.paths.push(native);
      continue;
    }
    if (layer.kind === "text") {
      result.errors.push(`${layer.name}: live text must be converted to outlines before cutter export.`);
      continue;
    }
    if (layer.kind === "image") {
      const svg = decodeEmbeddedSvgDataUrl(layer.url);
      if (!svg) {
        result.errors.push(`${layer.name}: raster or externally linked artwork must be traced into an embedded SVG before cutter export.`);
        continue;
      }
      const embedded = parseEmbeddedSvg(svg, layer);
      result.paths.push(...embedded.paths);
      result.errors.push(...embedded.errors);
      result.warnings.push(...embedded.warnings);
    }
  }

  if (input.weedBox) {
    result.paths.unshift({
      source: "Weed box",
      closed: true,
      points: [
        { x: 3, y: 3 },
        { x: Math.max(3, input.sheet.width - 3), y: 3 },
        { x: Math.max(3, input.sheet.width - 3), y: Math.max(3, input.sheet.height - 3) },
        { x: 3, y: Math.max(3, input.sheet.height - 3) },
        { x: 3, y: 3 },
      ],
    });
  }
  if (input.registrationMarks) {
    result.warnings.push("Registration marks remain print-alignment marks and are not included in cutter paths.");
  }

  result.paths = result.paths.filter(validPath);
  if (!result.paths.length && !result.errors.length) result.errors.push("Add at least one native shape or embedded vector SVG before cutter export.");
  const outside = result.paths.filter((path) => path.points.some((point) => point.x < -0.01 || point.y < -0.01 || point.x > input.sheet.width + 0.01 || point.y > input.sheet.height + 0.01));
  if (outside.length) result.errors.push(`${outside.length} cutter path${outside.length === 1 ? " is" : "s are"} outside the production sheet.`);
  return result;
}

function outputPoint(point: CutPoint, sheet: { width: number; height: number }, mirror: boolean, origin: MachineOrigin): CutPoint {
  const x = mirror ? sheet.width - point.x : point.x;
  const y = origin === "BOTTOM_LEFT" ? sheet.height - point.y : point.y;
  return { x, y };
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildCutSvg(input: {
  paths: CutPath[];
  sheet: { width: number; height: number };
  mirror: boolean;
}) {
  const polylines = input.paths.map((path) => {
    const points = path.points.map((point) => {
      const output = outputPoint(point, input.sheet, input.mirror, "TOP_LEFT");
      return `${output.x.toFixed(3)},${output.y.toFixed(3)}`;
    }).join(" ");
    return `<polyline data-source="${xml(path.source)}" points="${points}" fill="none" stroke="#000" stroke-width="0.2" vector-effect="non-scaling-stroke"/>`;
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.sheet.width}mm" height="${input.sheet.height}mm" viewBox="0 0 ${input.sheet.width} ${input.sheet.height}"><g id="cut-paths">${polylines}</g></svg>`;
}

export function buildCutHpgl(input: {
  paths: CutPath[];
  sheet: { width: number; height: number };
  mirror: boolean;
  origin: MachineOrigin;
  unitsPerMm: number;
}) {
  const units = Math.max(1, Math.min(1_000, Math.round(input.unitsPerMm)));
  const commands = ["IN", "PA", "SP1"];
  for (const path of input.paths) {
    const [first, ...rest] = path.points;
    const start = outputPoint(first, input.sheet, input.mirror, input.origin);
    commands.push(`PU${Math.round(start.x * units)},${Math.round(start.y * units)}`);
    if (rest.length) {
      commands.push(`PD${rest.map((point) => {
        const output = outputPoint(point, input.sheet, input.mirror, input.origin);
        return `${Math.round(output.x * units)},${Math.round(output.y * units)}`;
      }).join(",")}`);
    }
    commands.push("PU");
  }
  commands.push("SP0", "IN");
  return `${commands.join(";")};\n`;
}

export function buildCutDxf(input: {
  paths: CutPath[];
  sheet: { width: number; height: number };
  mirror: boolean;
  origin: MachineOrigin;
}) {
  const entities = input.paths.map((path) => {
    const points = path.closed && path.points.length > 2
      ? path.points.slice(0, -1)
      : path.points;
    const vertices = points.map((point) => {
      const output = outputPoint(point, input.sheet, input.mirror, input.origin);
      return `10\n${output.x.toFixed(4)}\n20\n${output.y.toFixed(4)}`;
    }).join("\n");
    return `0\nLWPOLYLINE\n8\nCUT\n90\n${points.length}\n70\n${path.closed ? 1 : 0}\n${vertices}`;
  }).join("\n");
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}\n0\nENDSEC\n0\nEOF\n`;
}
