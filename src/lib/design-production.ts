export type ProductionMachineProfile = "Generic SVG" | "HPGL / PLT cutter" | "SignMaster" | "VinylMaster" | "Print/RIP";

export type ProductionLayer = {
  id: string;
  kind: "image" | "text" | "rectangle" | "circle";
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
};

export type ProductionCheck = {
  errors: string[];
  warnings: string[];
};

type SheetSize = { width: number; height: number };

function rotatedHalfExtents(layer: Pick<ProductionLayer, "width" | "height" | "rotation">) {
  const angle = layer.rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  return {
    x: (layer.width * cosine + layer.height * sine) / 2,
    y: (layer.width * sine + layer.height * cosine) / 2,
  };
}

export function clampLayerToSheet<T extends ProductionLayer>(layer: T, sheet: SheetSize): T {
  const width = Math.max(1, Math.min(sheet.width, Number.isFinite(layer.width) ? layer.width : 1));
  const height = Math.max(1, Math.min(sheet.height, Number.isFinite(layer.height) ? layer.height : 1));
  const normalized = { ...layer, width, height };
  const half = rotatedHalfExtents(normalized);
  const x = sheet.width <= half.x * 2
    ? sheet.width / 2
    : Math.max(half.x, Math.min(sheet.width - half.x, Number.isFinite(layer.x) ? layer.x : sheet.width / 2));
  const y = sheet.height <= half.y * 2
    ? sheet.height / 2
    : Math.max(half.y, Math.min(sheet.height - half.y, Number.isFinite(layer.y) ? layer.y : sheet.height / 2));
  return { ...normalized, x, y };
}

export function layerFitsSheet(layer: ProductionLayer, sheet: SheetSize) {
  const half = rotatedHalfExtents(layer);
  return layer.x - half.x >= -0.01
    && layer.y - half.y >= -0.01
    && layer.x + half.x <= sheet.width + 0.01
    && layer.y + half.y <= sheet.height + 0.01;
}

export function checkProductionDesign(input: {
  layers: ProductionLayer[];
  sheet: SheetSize;
  machineProfile: ProductionMachineProfile;
  material: string;
  mirror: boolean;
  registrationMarks: boolean;
  copies: number;
}): ProductionCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const visible = input.layers.filter((layer) => layer.visible);

  if (!visible.length) errors.push("Add at least one visible design layer before producing this job.");
  if (!Number.isFinite(input.sheet.width) || !Number.isFinite(input.sheet.height) || input.sheet.width < 20 || input.sheet.height < 20 || input.sheet.width > 2_000 || input.sheet.height > 5_000) {
    errors.push("The production area must be between 20 mm and 2,000 × 5,000 mm.");
  }
  if (!Number.isInteger(input.copies) || input.copies < 1 || input.copies > 100) errors.push("Copies must be a whole number from 1 to 100.");

  const outside = visible.filter((layer) => !layerFitsSheet(layer, input.sheet));
  if (outside.length) errors.push(`${outside.length} visible layer${outside.length === 1 ? " is" : "s are"} outside the production area.`);

  const cutMaterial = input.material === "htv" || input.material === "flock";
  if ((cutMaterial || input.material === "sublimation") && !input.mirror) warnings.push("This material normally requires mirrored output. Confirm the manufacturer instructions before production.");
  if ((input.material === "printable-htv" || input.material === "dtf") && !input.registrationMarks) warnings.push("Enable registration marks when the print-and-cut workflow or RIP requires optical alignment.");

  const hasText = visible.some((layer) => layer.kind === "text");
  const hasRaster = visible.some((layer) => layer.kind === "image");
  if (hasText && input.machineProfile !== "Print/RIP") warnings.push("Editable text will be converted automatically into closed cutter outlines during SVG, HPGL or DXF production.");
  if (hasRaster && ["Generic SVG", "SignMaster", "VinylMaster"].includes(input.machineProfile)) warnings.push("Image layers are raster artwork. Trace or vectorise them in the cutter software before sending a cut job.");

  if (input.machineProfile === "HPGL / PLT cutter") {
    const unsupported = visible.filter((layer) => layer.kind !== "rectangle" && layer.kind !== "circle");
    if (unsupported.length) errors.push("Direct HPGL sending supports rectangle and circle vector layers only. Export SVG for text or image artwork.");
    if (input.copies !== 1) errors.push("Arrange multiple copies on the sheet before direct HPGL sending; retracing the same path would damage the material.");
  }

  return { errors, warnings };
}

function rotatePoint(x: number, y: number, rotation: number) {
  const angle = rotation * Math.PI / 180;
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
}

function plotterPoint(xMm: number, yMm: number, sheet: SheetSize, mirror: boolean, unitsPerMm: number) {
  const x = mirror ? sheet.width - xMm : xMm;
  const y = sheet.height - yMm;
  return `${Math.round(x * unitsPerMm)},${Math.round(y * unitsPerMm)}`;
}

function layerPolyline(layer: ProductionLayer) {
  if (layer.kind === "rectangle") {
    const points = [
      [-layer.width / 2, -layer.height / 2],
      [layer.width / 2, -layer.height / 2],
      [layer.width / 2, layer.height / 2],
      [-layer.width / 2, layer.height / 2],
      [-layer.width / 2, -layer.height / 2],
    ];
    return points.map(([x, y]) => {
      const rotated = rotatePoint(x, y, layer.rotation);
      return { x: layer.x + rotated.x, y: layer.y + rotated.y };
    });
  }

  const steps = 96;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = index / steps * Math.PI * 2;
    const rotated = rotatePoint(Math.cos(angle) * layer.width / 2, Math.sin(angle) * layer.height / 2, layer.rotation);
    return { x: layer.x + rotated.x, y: layer.y + rotated.y };
  });
}

export function buildHpgl(input: {
  layers: ProductionLayer[];
  sheet: SheetSize;
  mirror: boolean;
  weedBox: boolean;
  unitsPerMm?: number;
}) {
  const unitsPerMm = input.unitsPerMm ?? 40;
  const commands = ["IN", "PA", "SP1"];
  const paths = input.layers.filter((layer) => layer.visible && (layer.kind === "rectangle" || layer.kind === "circle"));

  if (input.weedBox) {
    paths.unshift({
      id: "weed-box",
      kind: "rectangle",
      name: "Weed box",
      visible: true,
      locked: true,
      x: input.sheet.width / 2,
      y: input.sheet.height / 2,
      width: Math.max(1, input.sheet.width - 6),
      height: Math.max(1, input.sheet.height - 6),
      rotation: 0,
      color: "#000000",
    });
  }

  for (const layer of paths) {
    const points = layerPolyline(layer);
    const [first, ...rest] = points;
    commands.push(`PU${plotterPoint(first.x, first.y, input.sheet, input.mirror, unitsPerMm)}`);
    if (rest.length) commands.push(`PD${rest.map((point) => plotterPoint(point.x, point.y, input.sheet, input.mirror, unitsPerMm)).join(",")}`);
    commands.push("PU");
  }

  commands.push("SP0", "IN");
  return `${commands.join(";")} ;\n`;
}

export function buildPrintDocument(input: {
  title: string;
  svg: string;
  widthMm: number;
  heightMm: number;
  copies: number;
}) {
  const safeCopies = Math.max(1, Math.min(100, Math.trunc(input.copies)));
  const pages = Array.from({ length: safeCopies }, (_, index) => `<section class="page" data-copy="${index + 1}">${input.svg}</section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${input.title}</title><style>@page{size:${input.widthMm}mm ${input.heightMm}mm;margin:0}html,body{margin:0;background:white}.page{width:${input.widthMm}mm;height:${input.heightMm}mm;break-after:page;page-break-after:always;overflow:hidden}.page:last-child{break-after:auto;page-break-after:auto}.page svg{display:block;width:100%;height:100%}</style></head><body>${pages}<script>Promise.all(Array.from(document.images).map(function(image){return image.decode?image.decode().catch(function(){}):Promise.resolve()})).then(function(){window.focus();window.print()});<\/script></body></html>`;
}
