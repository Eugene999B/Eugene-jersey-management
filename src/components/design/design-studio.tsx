"use client";

import { clsx } from "clsx";
import {
  AlertTriangle,
  BadgeCheck,
  BoxSelect,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Flame,
  Gauge,
  ImageIcon,
  Layers,
  Lock,
  MousePointer2,
  Palette,
  Printer,
  RotateCcw,
  Ruler,
  Save,
  ScanLine,
  Scissors,
  Settings2,
  Shirt,
  Square,
  Type,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type GarmentStyle = "classic" | "raglan" | "pro-panel" | "training";
type ViewMode = "front" | "back" | "production";
type DesignMode = "plain" | "team" | "custom";
type TextEffect = "flat" | "outline" | "shadow" | "arch" | "split";
type ProductionAid = "balanced" | "speed" | "precision" | "waste-saver";
type MaterialPreset = "pu-vinyl" | "flock" | "sublimation" | "twill";
type CutterProfile = "generic-hpgl" | "graphtec-ce" | "roland-gs" | "silhouette-cameo";
type StudioTab = "brand" | "assets" | "text" | "layout" | "layers" | "production" | "quality" | "export";
type ActiveTool = "select" | "text" | "image" | "shape" | "measure" | "cut" | "press" | "inspect";
type PatternStyle = "none" | "pinstripe" | "diagonal" | "chevron" | "halftone" | "speed-lines" | "panel-grid";
type ImageMask = "rectangle" | "circle" | "shield" | "diamond";
type ShapeKind = "shield" | "circle" | "sash" | "star" | "lightning";
type LayerKey =
  | "texture"
  | "pattern"
  | "shape"
  | "crest"
  | "image"
  | "sponsor"
  | "name"
  | "number"
  | "sideStripes"
  | "contour"
  | "weedBox"
  | "registration";

type UploadedImage = {
  url: string;
  name: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
};

const materialPresets: Record<
  MaterialPreset,
  { label: string; heatTemp: number; heatSeconds: number; pressure: string; bladeForce: number; speed: number; note: string }
> = {
  "pu-vinyl": { label: "PU HTV", heatTemp: 155, heatSeconds: 15, pressure: "Medium", bladeForce: 90, speed: 22, note: "Layered names, numbers, crests, and sponsor marks." },
  flock: { label: "Flock", heatTemp: 165, heatSeconds: 18, pressure: "Firm", bladeForce: 135, speed: 16, note: "Textured vinyl with slower cuts and stronger pressure." },
  sublimation: { label: "Sublimation", heatTemp: 200, heatSeconds: 45, pressure: "Medium", bladeForce: 0, speed: 0, note: "Full transfer layout with no mirror cut requirement." },
  twill: { label: "Twill", heatTemp: 170, heatSeconds: 25, pressure: "Firm", bladeForce: 160, speed: 12, note: "Patch, applique, and stitched crest preparation." },
};

const cutterProfiles: Record<CutterProfile, { label: string; offset: number; overcut: number; width: number; height: number }> = {
  "generic-hpgl": { label: "Generic HPGL", offset: 0.25, overcut: 0.35, width: 600, height: 500 },
  "graphtec-ce": { label: "Graphtec CE", offset: 0.25, overcut: 0.45, width: 610, height: 500 },
  "roland-gs": { label: "Roland GS", offset: 0.25, overcut: 0.3, width: 584, height: 500 },
  "silhouette-cameo": { label: "Silhouette Cameo", offset: 0.2, overcut: 0.25, width: 305, height: 305 },
};

const layerLabels: Record<LayerKey, string> = {
  texture: "Fabric texture",
  pattern: "Pattern system",
  shape: "Vector shape",
  crest: "Crest text",
  image: "Imported image",
  sponsor: "Sponsor",
  name: "Player name",
  number: "Player number",
  sideStripes: "Panels",
  contour: "Cut contour",
  weedBox: "Weed box",
  registration: "Registration marks",
};

const tabItems: Array<{ key: StudioTab; label: string; icon: LucideIcon }> = [
  { key: "brand", label: "Brand", icon: Palette },
  { key: "assets", label: "Assets", icon: ImageIcon },
  { key: "text", label: "Text", icon: Type },
  { key: "layout", label: "Layout", icon: BoxSelect },
  { key: "layers", label: "Layers", icon: Layers },
  { key: "production", label: "Production", icon: Scissors },
  { key: "quality", label: "Quality", icon: BadgeCheck },
  { key: "export", label: "Export", icon: Download },
];

const toolItems: Array<{ key: ActiveTool; label: string; icon: LucideIcon }> = [
  { key: "select", label: "Select", icon: MousePointer2 },
  { key: "text", label: "Text", icon: Type },
  { key: "image", label: "Image", icon: ImageIcon },
  { key: "shape", label: "Shape", icon: Square },
  { key: "measure", label: "Measure", icon: Ruler },
  { key: "cut", label: "Cut", icon: Scissors },
  { key: "press", label: "Press", icon: Flame },
  { key: "inspect", label: "Inspect", icon: BadgeCheck },
];

const palettePresets = [
  { name: "Accra Pro", base: "#0f766e", accent: "#f97316", trim: "#111827", vinyl: "#ffffff" },
  { name: "Black Gold", base: "#111827", accent: "#eab308", trim: "#020617", vinyl: "#ffffff" },
  { name: "Royal White", base: "#1d4ed8", accent: "#ffffff", trim: "#111827", vinyl: "#f8fafc" },
  { name: "Crimson Club", base: "#be123c", accent: "#0f172a", trim: "#f8fafc", vinyl: "#ffffff" },
  { name: "Green Volt", base: "#166534", accent: "#a3e635", trim: "#052e16", vinyl: "#f8fafc" },
];

function svgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function downloadFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function fitNameSize(value: string) {
  if (value.length > 14) return 24;
  if (value.length > 11) return 28;
  if (value.length > 8) return 32;
  return 36;
}

function fitSponsorSize(value: string) {
  if (value.length > 20) return 16;
  if (value.length > 14) return 19;
  if (value.length > 10) return 22;
  return 25;
}

function jerseyPath(style: GarmentStyle) {
  if (style === "raglan") {
    return "M108 82 L156 42 L200 70 L244 42 L292 82 L354 142 L314 196 L284 170 L276 466 L124 466 L116 170 L86 196 L46 142 Z";
  }
  if (style === "pro-panel") {
    return "M112 76 L162 40 L200 69 L238 40 L288 76 L348 128 L312 190 L282 166 L288 466 L112 466 L118 166 L88 190 L52 128 Z";
  }
  if (style === "training") {
    return "M118 80 L164 48 L200 70 L236 48 L282 80 L334 134 L304 186 L280 166 L268 462 L132 462 L120 166 L96 186 L66 134 Z";
  }
  return "M112 78 L160 42 L200 70 L240 42 L288 78 L350 132 L309 188 L282 164 L282 460 L118 460 L118 164 L91 188 L50 132 Z";
}

function hpglJob(copies: number, mirrorCut: boolean, contourOffset: number, smoothness: number) {
  const mirror = mirrorCut ? "1" : "0";
  return [
    "IN;",
    "SP1;",
    `VS${Math.max(1, copies)};`,
    `PU0,0;PA0,0;PD3900,0;PD3900,4700;PD0,4700;PD0,0;PU;`,
    `PU1400,1700;CI${Math.round((contourOffset + 1) * 95)};PU;`,
    `PU1150,2500;LBNAME/NUMBER M${mirror} S${smoothness};`,
    "SP0;",
  ].join("\n");
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function optimizeImageFile(file: File): Promise<UploadedImage> {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return { url: sourceUrl, name: file.name, width: image.width, height: image.height, originalSize: file.size, optimizedSize: file.size };
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    const webp = await canvasToBlob(canvas, "image/webp", 0.86);
    const fallback = webp ?? (await canvasToBlob(canvas, "image/png"));
    if (!fallback) {
      return { url: sourceUrl, name: file.name, width: image.width, height: image.height, originalSize: file.size, optimizedSize: file.size };
    }

    URL.revokeObjectURL(sourceUrl);
    return {
      url: URL.createObjectURL(fallback),
      name: file.name,
      width,
      height,
      originalSize: file.size,
      optimizedSize: fallback.size,
    };
  } catch {
    return { url: sourceUrl, name: file.name, width: 0, height: 0, originalSize: file.size, optimizedSize: file.size };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function PanelHeading({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={17} className="text-[var(--shop-primary)]" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {detail ? <span className="rounded-[8px] bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{detail}</span> : null}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-[8px] border border-[#ded8cd] bg-white p-3">
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
        <span>{label}</span>
        <span className="text-xs text-slate-500">{value}{suffix}</span>
      </span>
      <input className="w-full accent-[var(--shop-primary)]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function DesignStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>("brand");
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [garmentStyle, setGarmentStyle] = useState<GarmentStyle>("pro-panel");
  const [designMode, setDesignMode] = useState<DesignMode>("custom");
  const [textEffect, setTextEffect] = useState<TextEffect>("outline");
  const [productionAid, setProductionAid] = useState<ProductionAid>("balanced");
  const [baseColor, setBaseColor] = useState("#0f766e");
  const [accentColor, setAccentColor] = useState("#f97316");
  const [trimColor, setTrimColor] = useState("#111827");
  const [vinylColor, setVinylColor] = useState("#ffffff");
  const [playerName, setPlayerName] = useState("MENSAH");
  const [playerNumber, setPlayerNumber] = useState("10");
  const [sponsor, setSponsor] = useState("ACCRA PRO");
  const [crest, setCrest] = useState("APS");
  const [view, setView] = useState<ViewMode>("back");
  const [patternStyle, setPatternStyle] = useState<PatternStyle>("pinstripe");
  const [textureStrength, setTextureStrength] = useState(18);
  const [textTracking, setTextTracking] = useState(1);
  const [outlineWidth, setOutlineWidth] = useState(3);
  const [nameY, setNameY] = useState(212);
  const [numberY, setNumberY] = useState(318);
  const [sponsorY, setSponsorY] = useState(262);
  const [numberScale, setNumberScale] = useState(100);
  const [nameArch, setNameArch] = useState(48);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [imageStatus, setImageStatus] = useState<"idle" | "optimizing" | "ready" | "failed">("idle");
  const [imageX, setImageX] = useState(200);
  const [imageY, setImageY] = useState(128);
  const [imageSize, setImageSize] = useState(62);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageOpacity, setImageOpacity] = useState(100);
  const [imageMask, setImageMask] = useState<ImageMask>("shield");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("sash");
  const [shapeX, setShapeX] = useState(200);
  const [shapeY, setShapeY] = useState(378);
  const [shapeScale, setShapeScale] = useState(100);
  const [shapeRotation, setShapeRotation] = useState(0);
  const [shapeOpacity, setShapeOpacity] = useState(85);
  const [material, setMaterial] = useState<MaterialPreset>("pu-vinyl");
  const [cutter, setCutter] = useState<CutterProfile>("generic-hpgl");
  const [bladeOffset, setBladeOffset] = useState(cutterProfiles["generic-hpgl"].offset);
  const [overcut, setOvercut] = useState(cutterProfiles["generic-hpgl"].overcut);
  const [cutForce, setCutForce] = useState(materialPresets["pu-vinyl"].bladeForce);
  const [cutSpeed, setCutSpeed] = useState(materialPresets["pu-vinyl"].speed);
  const [contourOffset, setContourOffset] = useState(2);
  const [cornerSmoothing, setCornerSmoothing] = useState(65);
  const [bleedMargin, setBleedMargin] = useState(3);
  const [nestingGap, setNestingGap] = useState(6);
  const [pressPasses, setPressPasses] = useState(1);
  const [copies, setCopies] = useState(1);
  const [mirrorCut, setMirrorCut] = useState(true);
  const [preserveCutOrder, setPreserveCutOrder] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [autoWeedLines, setAutoWeedLines] = useState(true);
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    texture: true,
    pattern: true,
    shape: true,
    crest: true,
    image: false,
    sponsor: true,
    name: true,
    number: true,
    sideStripes: true,
    contour: true,
    weedBox: true,
    registration: true,
  });

  useEffect(() => {
    return () => {
      if (uploadedImage?.url) URL.revokeObjectURL(uploadedImage.url);
    };
  }, [uploadedImage?.url]);

  const materialConfig = materialPresets[material];
  const cutterConfig = cutterProfiles[cutter];
  const totalLayers = Object.keys(layerLabels).length;
  const activeLayers = Object.values(layers).filter(Boolean).length;

  const qualityChecks = useMemo(() => {
    const textFits = playerName.length <= 16 && sponsor.length <= 24 && playerNumber.length <= 3;
    const contrastReady = baseColor.toLowerCase() !== vinylColor.toLowerCase() && trimColor.toLowerCase() !== vinylColor.toLowerCase();
    const imageReady = !layers.image || Boolean(uploadedImage);
    const cutterReady = material === "sublimation" || (cutForce > 0 && cutSpeed > 0 && layers.contour);

    return [
      { label: "Safe print area", ok: showSafeArea },
      { label: "Registration marks", ok: layers.registration },
      { label: "Weed box", ok: layers.weedBox || material === "sublimation" },
      { label: "Text fit", ok: textFits },
      { label: "Color contrast", ok: contrastReady },
      { label: "Image optimized", ok: imageReady },
      { label: "Cutter setup", ok: cutterReady },
      { label: "HTV mirror", ok: material !== "pu-vinyl" || mirrorCut },
    ];
  }, [baseColor, cutForce, cutSpeed, layers.contour, layers.image, layers.registration, layers.weedBox, material, mirrorCut, playerName.length, playerNumber.length, showSafeArea, sponsor.length, trimColor, uploadedImage, vinylColor]);

  const passedChecks = qualityChecks.filter((check) => check.ok).length;
  const productionScore = Math.round((passedChecks / qualityChecks.length) * 72 + (activeLayers / totalLayers) * 18 + (preserveCutOrder ? 5 : 0) + (snapToGuides ? 5 : 0));
  const vinylUsage = Math.round((activeLayers * 0.11 + copies * 0.18 + imageSize / 900 + numberScale / 1100) * 100) / 100;
  const pressMinutes = Math.max(1, Math.round((materialConfig.heatSeconds * pressPasses * copies) / 60 + activeLayers * 0.35));
  const cutComplexity = Math.min(100, Math.round(activeLayers * 7 + contourOffset * 4 + cornerSmoothing * 0.25 + (patternStyle === "halftone" ? 18 : 0)));

  const svg = useMemo(() => {
    const safeSponsor = svgText(sponsor);
    const safePlayerName = svgText(playerName);
    const safePlayerNumber = svgText(playerNumber);
    const safeCrest = svgText(crest);
    const path = jerseyPath(garmentStyle);
    const nameSize = fitNameSize(playerName);
    const sponsorSize = fitSponsorSize(sponsor);
    const productionMode = view === "production";
    const frontVisible = view === "front";
    const backVisible = view === "back" || productionMode;
    const cutDash = productionMode ? "10 8" : "0";
    const safeArea = showSafeArea
      ? `<path d="M136 186 L264 186 L258 426 L142 426 Z" fill="none" stroke="#22c55e" stroke-width="2" stroke-dasharray="7 6" opacity="0.9"/>`
      : "";
    const rulers = showRulers
      ? `
        <g fill="#334155" font-size="10" font-weight="700" opacity="0.75">
          <path d="M28 32V492M372 32V492M36 500H364" stroke="#334155" stroke-width="1"/>
          <text x="22" y="262" transform="rotate(-90 22 262)">520 mm height guide</text>
          <text x="162" y="514">400 mm width guide</text>
        </g>`
      : "";
    const weedLines = autoWeedLines && productionMode
      ? `
        <g stroke="#ef4444" stroke-width="1.5" stroke-dasharray="8 7" opacity="0.75">
          <path d="M72 228H328"/><path d="M72 332H328"/><path d="M200 86V454"/>
        </g>`
      : "";
    const registration = layers.registration
      ? `
        <g fill="none" stroke="#111827" stroke-width="2">
          <circle cx="58" cy="58" r="14"/><path d="M44 58H72M58 44V72"/>
          <circle cx="342" cy="58" r="14"/><path d="M328 58H356M342 44V72"/>
          <circle cx="58" cy="462" r="14"/><path d="M44 462H72M58 448V476"/>
          <circle cx="342" cy="462" r="14"/><path d="M328 462H356M342 448V476"/>
        </g>`
      : "";
    const weedBox = layers.weedBox
      ? `<rect x="36" y="30" width="328" height="462" rx="8" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="9 8"/>`
      : "";
    const fabricTexture = layers.texture
      ? `<g clip-path="url(#jerseyClip)" opacity="${textureStrength / 100}"><rect x="42" y="38" width="316" height="430" fill="url(#fabricTexture)"/></g>`
      : "";
    const patternOverlay = (() => {
      if (!layers.pattern || patternStyle === "none") return "";
      if (patternStyle === "pinstripe") {
        return `<g clip-path="url(#jerseyClip)" opacity="0.22" stroke="${vinylColor}" stroke-width="2">${Array.from({ length: 11 }, (_, index) => `<path d="M${90 + index * 22} 82 L${76 + index * 22} 464"/>`).join("")}</g>`;
      }
      if (patternStyle === "diagonal") {
        return `<g clip-path="url(#jerseyClip)" opacity="0.24" stroke="${accentColor}" stroke-width="16">${Array.from({ length: 9 }, (_, index) => `<path d="M${-80 + index * 64} 476 L${120 + index * 64} 70"/>`).join("")}</g>`;
      }
      if (patternStyle === "chevron") {
        return `<g clip-path="url(#jerseyClip)" opacity="0.28" fill="none" stroke="${accentColor}" stroke-width="10">${Array.from({ length: 5 }, (_, index) => `<path d="M82 ${178 + index * 54} L200 ${226 + index * 54} L318 ${178 + index * 54}"/>`).join("")}</g>`;
      }
      if (patternStyle === "halftone") {
        return `<g clip-path="url(#jerseyClip)" opacity="0.28"><rect x="58" y="80" width="284" height="382" fill="url(#halftonePattern)"/></g>`;
      }
      if (patternStyle === "speed-lines") {
        return `<g clip-path="url(#jerseyClip)" opacity="0.32" stroke="${accentColor}" stroke-width="7" stroke-linecap="round"><path d="M92 176 H292"/><path d="M76 246 H324"/><path d="M94 316 H306"/><path d="M126 386 H274"/></g>`;
      }
      return `<g clip-path="url(#jerseyClip)" opacity="0.22" stroke="${vinylColor}" stroke-width="1.5"><path d="M120 80V462M160 64V462M200 70V462M240 64V462M280 80V462"/><path d="M96 164H304M110 244H290M114 324H286M118 404H282"/></g>`;
    })();
    const sideStripes = layers.sideStripes
      ? `
        <path d="M118 162 C146 185 254 185 282 162" fill="none" stroke="${accentColor}" stroke-width="11"/>
        <path d="M120 404 L280 404" stroke="${accentColor}" stroke-width="15"/>
        <path d="M116 178 C130 270 130 374 118 456" fill="none" stroke="${accentColor}" stroke-width="5" opacity="0.85"/>
        <path d="M284 178 C270 270 270 374 282 456" fill="none" stroke="${accentColor}" stroke-width="5" opacity="0.85"/>`
      : "";
    const shape = (() => {
      if (!layers.shape) return "";
      const transform = `translate(${shapeX} ${shapeY}) rotate(${shapeRotation}) scale(${shapeScale / 100})`;
      if (shapeKind === "circle") {
        return `<g transform="${transform}" opacity="${shapeOpacity / 100}"><circle cx="0" cy="0" r="46" fill="${accentColor}" stroke="${trimColor}" stroke-width="4"/><circle cx="0" cy="0" r="30" fill="none" stroke="${vinylColor}" stroke-width="3" opacity="0.75"/></g>`;
      }
      if (shapeKind === "shield") {
        return `<g transform="${transform}" opacity="${shapeOpacity / 100}"><path d="M-48 -50 L48 -50 L38 22 L0 58 L-38 22 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="4"/><path d="M-28 -28 H28 L20 12 L0 34 L-20 12 Z" fill="none" stroke="${vinylColor}" stroke-width="3" opacity="0.85"/></g>`;
      }
      if (shapeKind === "star") {
        return `<g transform="${transform}" opacity="${shapeOpacity / 100}"><path d="M0 -62 L14 -18 L60 -18 L23 8 L37 54 L0 26 L-37 54 L-23 8 L-60 -18 L-14 -18 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="4"/></g>`;
      }
      if (shapeKind === "lightning") {
        return `<g transform="${transform}" opacity="${shapeOpacity / 100}"><path d="M-10 -64 L46 -10 L12 -8 L30 64 L-46 0 L-12 0 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="4"/></g>`;
      }
      return `<g transform="${transform}" opacity="${shapeOpacity / 100}"><path d="M-156 -18 L156 -54 L138 -18 L156 18 L-156 54 L-138 18 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="3"/><path d="M-122 8 L122 -22" stroke="${vinylColor}" stroke-width="4" opacity="0.7"/></g>`;
    })();
    const imageClip = (() => {
      const half = imageSize / 2;
      if (imageMask === "circle") return `<clipPath id="imageClip"><circle cx="0" cy="0" r="${half}"/></clipPath>`;
      if (imageMask === "shield") return `<clipPath id="imageClip"><path d="M${-half} ${-half} L${half} ${-half} L${half * 0.72} ${half * 0.34} L0 ${half} L${-half * 0.72} ${half * 0.34} Z"/></clipPath>`;
      if (imageMask === "diamond") return `<clipPath id="imageClip"><path d="M0 ${-half} L${half} 0 L0 ${half} L${-half} 0 Z"/></clipPath>`;
      return `<clipPath id="imageClip"><rect x="${-half}" y="${-half}" width="${imageSize}" height="${imageSize}" rx="8"/></clipPath>`;
    })();
    const placedImage = layers.image && uploadedImage
      ? `
        <g transform="translate(${imageX} ${imageY}) rotate(${imageRotation})" opacity="${imageOpacity / 100}">
          <g clip-path="url(#imageClip)">
            <image href="${svgText(uploadedImage.url)}" x="${-imageSize / 2}" y="${-imageSize / 2}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid slice"/>
          </g>
          <rect x="${-imageSize / 2}" y="${-imageSize / 2}" width="${imageSize}" height="${imageSize}" rx="8" fill="none" stroke="${trimColor}" stroke-width="2" opacity="0.65"/>
        </g>`
      : "";
    const crestShape = layers.crest
      ? `
        <g>
          <path d="M177 118 L200 102 L223 118 L216 148 L184 148 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="3"/>
          <text x="200" y="139" text-anchor="middle" font-size="15" font-weight="800" fill="#ffffff">${safeCrest}</text>
        </g>`
      : "";
    const sponsorText = layers.sponsor && frontVisible
      ? `<text x="200" y="${sponsorY}" text-anchor="middle" font-size="${sponsorSize}" letter-spacing="${textTracking}" font-weight="900" fill="${vinylColor}" stroke="${textEffect === "outline" ? trimColor : "none"}" stroke-width="${textEffect === "outline" ? outlineWidth : 0}" paint-order="stroke fill">${safeSponsor}</text>`
      : "";
    const nameText = (() => {
      if (!layers.name || !backVisible) return "";
      if (textEffect === "arch") {
        return `
          <path id="nameArc" d="M116 ${nameY} C150 ${nameY - nameArch} 250 ${nameY - nameArch} 284 ${nameY}" fill="none"/>
          <text font-size="${nameSize}" font-weight="900" letter-spacing="${textTracking}" fill="${vinylColor}" stroke="${trimColor}" stroke-width="${outlineWidth}" paint-order="stroke fill">
            <textPath href="#nameArc" startOffset="50%" text-anchor="middle">${safePlayerName}</textPath>
          </text>`;
      }
      if (textEffect === "shadow") {
        return `
          <text x="204" y="${nameY + 4}" text-anchor="middle" font-size="${nameSize}" letter-spacing="${textTracking}" font-weight="900" fill="${trimColor}" opacity="0.45">${safePlayerName}</text>
          <text x="200" y="${nameY}" text-anchor="middle" font-size="${nameSize}" letter-spacing="${textTracking}" font-weight="900" fill="${vinylColor}">${safePlayerName}</text>`;
      }
      if (textEffect === "split") {
        return `
          <text x="200" y="${nameY}" text-anchor="middle" font-size="${nameSize}" letter-spacing="${textTracking}" font-weight="900" fill="${vinylColor}" stroke="${trimColor}" stroke-width="${outlineWidth}" paint-order="stroke fill">${safePlayerName}</text>
          <path d="M112 ${nameY - nameSize / 2.4} H288" stroke="${accentColor}" stroke-width="4" opacity="0.8"/>`;
      }
      return `<text x="200" y="${nameY}" text-anchor="middle" font-size="${nameSize}" letter-spacing="${textTracking}" font-weight="900" fill="${vinylColor}" ${textEffect === "outline" ? `stroke="${trimColor}" stroke-width="${outlineWidth}" paint-order="stroke fill"` : ""}>${safePlayerName}</text>`;
    })();
    const numberSize = Math.round(104 * (numberScale / 100));
    const numberText = (() => {
      if (!layers.number || !backVisible) return "";
      if (textEffect === "shadow") {
        return `
          <text x="207" y="${numberY + 6}" text-anchor="middle" font-size="${numberSize}" font-weight="900" fill="${trimColor}" opacity="0.45">${safePlayerNumber}</text>
          <text x="200" y="${numberY}" text-anchor="middle" font-size="${numberSize}" font-weight="900" fill="${vinylColor}">${safePlayerNumber}</text>`;
      }
      return `<text x="200" y="${numberY}" text-anchor="middle" font-size="${numberSize}" font-weight="900" fill="${vinylColor}" ${textEffect !== "flat" ? `stroke="${trimColor}" stroke-width="${outlineWidth + 2}" paint-order="stroke fill"` : ""}>${safePlayerNumber}</text>`;
    })();
    const backText = backVisible
      ? `
        ${nameText}
        ${numberText}
        ${layers.number && productionMode ? `<text x="200" y="374" text-anchor="middle" font-size="13" font-weight="700" fill="#64748b">CUT ${copies} / ${materialConfig.label}</text>` : ""}`
      : "";
    const contour = layers.contour
      ? `<path d="${path}" fill="none" stroke="#0f172a" stroke-width="${productionMode ? 2 : 3}" stroke-dasharray="${cutDash}" opacity="${productionMode ? "0.85" : "1"}"/>`
      : "";
    const transferGroup = productionMode && mirrorCut ? `transform="translate(400 0) scale(-1 1)"` : "";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 400 520" role="img" aria-label="Sportswear production artwork">
      <defs>
        <clipPath id="jerseyClip"><path d="${path}"/></clipPath>
        ${imageClip}
        <pattern id="fabricTexture" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6H12M6 0V12" stroke="#ffffff" stroke-width="0.8" opacity="0.45"/>
          <path d="M0 0L12 12M12 0L0 12" stroke="#0f172a" stroke-width="0.35" opacity="0.22"/>
        </pattern>
        <pattern id="halftonePattern" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="2.8" fill="${accentColor}"/>
          <circle cx="14" cy="14" r="1.8" fill="${vinylColor}"/>
        </pattern>
      </defs>
      <rect width="400" height="520" fill="#f8fafc"/>
      <g ${transferGroup}>
        ${weedBox}
        <path d="${path}" fill="${baseColor}" stroke="${trimColor}" stroke-width="4"/>
        ${fabricTexture}
        ${patternOverlay}
        <path d="M160 42 C175 86 225 86 240 42 L218 96 L182 96 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="2"/>
        ${sideStripes}
        ${shape}
        ${safeArea}
        ${weedLines}
        ${crestShape}
        ${placedImage}
        ${sponsorText}
        ${backText}
        ${contour}
      </g>
      ${registration}
      ${rulers}
    </svg>`;
  }, [
    accentColor,
    autoWeedLines,
    baseColor,
    copies,
    crest,
    garmentStyle,
    imageMask,
    imageOpacity,
    imageRotation,
    imageSize,
    imageX,
    imageY,
    layers,
    materialConfig.label,
    mirrorCut,
    nameArch,
    nameY,
    numberScale,
    numberY,
    outlineWidth,
    patternStyle,
    playerName,
    playerNumber,
    shapeKind,
    shapeOpacity,
    shapeRotation,
    shapeScale,
    shapeX,
    shapeY,
    showRulers,
    showSafeArea,
    sponsor,
    sponsorY,
    textEffect,
    textTracking,
    textureStrength,
    trimColor,
    uploadedImage,
    view,
    vinylColor,
  ]);

  const productionManifest = useMemo(() => ({
    jobName: `${playerName || "PLAYER"}-${playerNumber || "00"}`,
    designMode,
    activeTool,
    activeTab,
    textEffect,
    productionAid,
    view,
    garmentStyle,
    patternStyle,
    material: materialConfig.label,
    heatPress: {
      temperatureC: materialConfig.heatTemp,
      seconds: materialConfig.heatSeconds,
      pressure: materialConfig.pressure,
      passes: pressPasses,
    },
    cutter: {
      profile: cutterConfig.label,
      mediaWidthMm: cutterConfig.width,
      mediaHeightMm: cutterConfig.height,
      bladeOffsetMm: bladeOffset,
      overcutMm: overcut,
      forceG: cutForce,
      speedCmS: cutSpeed,
      contourOffsetMm: contourOffset,
      bleedMarginMm: bleedMargin,
      nestingGapMm: nestingGap,
      cornerSmoothing,
      mirrorCut,
      preserveCutOrder,
      autoWeedLines,
      copies,
    },
    image: uploadedImage
      ? {
          name: uploadedImage.name,
          optimizedSize: uploadedImage.optimizedSize,
          originalSize: uploadedImage.originalSize,
          width: uploadedImage.width,
          height: uploadedImage.height,
          x: imageX,
          y: imageY,
          size: imageSize,
          rotation: imageRotation,
          opacity: imageOpacity,
          mask: imageMask,
        }
      : null,
    shape: { kind: shapeKind, x: shapeX, y: shapeY, scale: shapeScale, rotation: shapeRotation, opacity: shapeOpacity },
    text: { playerName, playerNumber, sponsor, crest, textTracking, outlineWidth, nameY, numberY, sponsorY, numberScale, nameArch },
    layers,
    colors: { baseColor, accentColor, trimColor, vinylColor },
    score: { productionScore, cutComplexity, vinylUsage, pressMinutes, passedChecks, totalChecks: qualityChecks.length },
  }), [
    accentColor,
    activeTab,
    activeTool,
    autoWeedLines,
    baseColor,
    bladeOffset,
    bleedMargin,
    contourOffset,
    copies,
    cornerSmoothing,
    crest,
    cutComplexity,
    cutForce,
    cutSpeed,
    cutterConfig.height,
    cutterConfig.label,
    cutterConfig.width,
    designMode,
    garmentStyle,
    imageMask,
    imageOpacity,
    imageRotation,
    imageSize,
    imageX,
    imageY,
    layers,
    materialConfig.heatSeconds,
    materialConfig.heatTemp,
    materialConfig.label,
    materialConfig.pressure,
    mirrorCut,
    nameArch,
    nameY,
    nestingGap,
    numberScale,
    numberY,
    outlineWidth,
    overcut,
    passedChecks,
    patternStyle,
    playerName,
    playerNumber,
    pressMinutes,
    pressPasses,
    preserveCutOrder,
    productionAid,
    productionScore,
    qualityChecks.length,
    shapeKind,
    shapeOpacity,
    shapeRotation,
    shapeScale,
    shapeX,
    shapeY,
    sponsor,
    sponsorY,
    textEffect,
    textTracking,
    trimColor,
    uploadedImage,
    view,
    vinylColor,
    vinylUsage,
  ]);

  function applyMaterial(nextMaterial: MaterialPreset) {
    const preset = materialPresets[nextMaterial];
    setMaterial(nextMaterial);
    setCutForce(preset.bladeForce);
    setCutSpeed(preset.speed);
    if (nextMaterial === "sublimation") setMirrorCut(false);
    if (nextMaterial !== "sublimation") setMirrorCut(true);
  }

  function applyCutter(nextCutter: CutterProfile) {
    const profile = cutterProfiles[nextCutter];
    setCutter(nextCutter);
    setBladeOffset(profile.offset);
    setOvercut(profile.overcut);
  }

  function toggleLayer(layer: LayerKey) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  function chooseTool(nextTool: ActiveTool) {
    setActiveTool(nextTool);

    const toolTab: Partial<Record<ActiveTool, StudioTab>> = {
      select: "layers",
      text: "text",
      image: "assets",
      shape: "layout",
      measure: "quality",
      cut: "production",
      press: "production",
      inspect: "quality",
    };

    setActiveTab(toolTab[nextTool] ?? activeTab);
  }

  function applyPalette(palette: (typeof palettePresets)[number]) {
    setBaseColor(palette.base);
    setAccentColor(palette.accent);
    setTrimColor(palette.trim);
    setVinylColor(palette.vinyl);
  }

  function applyDesignMode(nextMode: DesignMode) {
    setDesignMode(nextMode);

    if (nextMode === "plain") {
      setView("production");
      setPatternStyle("none");
      setLayers({
        texture: true,
        pattern: false,
        shape: false,
        crest: false,
        image: false,
        sponsor: false,
        name: false,
        number: false,
        sideStripes: false,
        contour: true,
        weedBox: true,
        registration: true,
      });
      return;
    }

    if (nextMode === "team") {
      setView("front");
      setPatternStyle("pinstripe");
      setLayers({
        texture: true,
        pattern: true,
        shape: true,
        crest: true,
        image: Boolean(uploadedImage),
        sponsor: true,
        name: false,
        number: false,
        sideStripes: true,
        contour: true,
        weedBox: true,
        registration: true,
      });
      return;
    }

    setView("back");
    setPatternStyle("pinstripe");
    setLayers({
      texture: true,
      pattern: true,
      shape: true,
      crest: true,
      image: Boolean(uploadedImage),
      sponsor: true,
      name: true,
      number: true,
      sideStripes: true,
      contour: true,
      weedBox: true,
      registration: true,
    });
  }

  function resetDesign() {
    setActiveTab("brand");
    setActiveTool("select");
    setCanvasZoom(100);
    setGarmentStyle("pro-panel");
    setDesignMode("custom");
    setTextEffect("outline");
    setProductionAid("balanced");
    setBaseColor("#0f766e");
    setAccentColor("#f97316");
    setTrimColor("#111827");
    setVinylColor("#ffffff");
    setPlayerName("MENSAH");
    setPlayerNumber("10");
    setSponsor("ACCRA PRO");
    setCrest("APS");
    setView("back");
    setPatternStyle("pinstripe");
    setTextureStrength(18);
    setTextTracking(1);
    setOutlineWidth(3);
    setNameY(212);
    setNumberY(318);
    setSponsorY(262);
    setNumberScale(100);
    setNameArch(48);
    setUploadedImage(null);
    setImageStatus("idle");
    setImageX(200);
    setImageY(128);
    setImageSize(62);
    setImageRotation(0);
    setImageOpacity(100);
    setImageMask("shield");
    setShapeKind("sash");
    setShapeX(200);
    setShapeY(378);
    setShapeScale(100);
    setShapeRotation(0);
    setShapeOpacity(85);
    applyMaterial("pu-vinyl");
    applyCutter("generic-hpgl");
    setContourOffset(2);
    setCornerSmoothing(65);
    setBleedMargin(3);
    setNestingGap(6);
    setPressPasses(1);
    setCopies(1);
    setMirrorCut(true);
    setPreserveCutOrder(true);
    setShowSafeArea(true);
    setShowRulers(true);
    setAutoWeedLines(true);
    setSnapToGuides(true);
    setLayers({
      texture: true,
      pattern: true,
      shape: true,
      crest: true,
      image: false,
      sponsor: true,
      name: true,
      number: true,
      sideStripes: true,
      contour: true,
      weedBox: true,
      registration: true,
    });
  }

  function downloadSvg() {
    downloadFile(`jersey-${view}-${playerName || "design"}.svg`, svg, "image/svg+xml");
  }

  function downloadJob() {
    downloadFile(`production-job-${playerName || "design"}.json`, JSON.stringify(productionManifest, null, 2), "application/json");
  }

  function downloadHpgl() {
    downloadFile(`cut-path-${playerName || "design"}.plt`, hpglJob(copies, mirrorCut, contourOffset, cornerSmoothing), "application/octet-stream");
  }

  function downloadTechPack() {
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${svgText(playerName || "Design")} Production Tech Pack</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
    .page { max-width: 980px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #111827; padding-bottom: 18px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 28px; }
    h2 { margin-top: 26px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 14px; break-inside: avoid; }
    .art { width: 360px; max-width: 100%; }
    table { width: 100%; border-collapse: collapse; }
    td { border-bottom: 1px solid #e5e7eb; padding: 8px 0; font-size: 13px; }
    .label { color: #64748b; }
    @media print { body { margin: 18mm; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <h1>${svgText(playerName || "Design")} #${svgText(playerNumber || "00")}</h1>
        <p>${svgText(sponsor || "No sponsor")} / ${materialConfig.label} / ${cutterConfig.label}</p>
      </div>
      <div><strong>${productionScore}% production ready</strong><br />${passedChecks}/${qualityChecks.length} checks passed</div>
    </div>
    <div class="grid">
      <div class="box art">${svg}</div>
      <div class="box">
        <h2>Machine Recipe</h2>
        <table>
          <tr><td class="label">Heat</td><td>${materialConfig.heatTemp}C, ${materialConfig.heatSeconds}s, ${materialConfig.pressure}</td></tr>
          <tr><td class="label">Passes</td><td>${pressPasses}</td></tr>
          <tr><td class="label">Cutter</td><td>${cutterConfig.label}</td></tr>
          <tr><td class="label">Force / Speed</td><td>${cutForce}g / ${cutSpeed} cm/s</td></tr>
          <tr><td class="label">Offset / Overcut</td><td>${bladeOffset} mm / ${overcut} mm</td></tr>
          <tr><td class="label">Mirror</td><td>${mirrorCut ? "Yes" : "No"}</td></tr>
          <tr><td class="label">Copies</td><td>${copies}</td></tr>
        </table>
      </div>
    </div>
    <div class="grid">
      <div class="box">
        <h2>Quality Checks</h2>
        <table>
          ${qualityChecks.map((check) => `<tr><td>${svgText(check.label)}</td><td>${check.ok ? "Pass" : "Needs review"}</td></tr>`).join("")}
        </table>
      </div>
      <div class="box">
        <h2>Artwork Notes</h2>
        <table>
          <tr><td class="label">Pattern</td><td>${patternStyle}</td></tr>
          <tr><td class="label">Text effect</td><td>${textEffect}</td></tr>
          <tr><td class="label">Active layers</td><td>${activeLayers}/${totalLayers}</td></tr>
          <tr><td class="label">Vinyl estimate</td><td>${vinylUsage} m</td></tr>
          <tr><td class="label">Press estimate</td><td>${pressMinutes} min</td></tr>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
    downloadFile(`tech-pack-${playerName || "design"}.html`, html, "text/html");
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    setImageStatus("optimizing");
    try {
      const optimized = await optimizeImageFile(file);
      setUploadedImage(optimized);
      setImageStatus("ready");
      setActiveTab("assets");
      setActiveTool("image");
      setLayers((current) => ({ ...current, image: true, crest: false }));
    } catch {
      setImageStatus("failed");
    }
  }

  function clearUploadedImage() {
    setUploadedImage(null);
    setImageStatus("idle");
    setLayers((current) => ({ ...current, image: false, crest: true }));
  }

  function renderBrandPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={Palette} title="Brand System" detail={`${designMode} mode`} />

        <div className="grid grid-cols-3 gap-2">
          {(["plain", "team", "custom"] as const).map((item) => (
            <button
              key={item}
              onClick={() => applyDesignMode(item)}
              className={clsx("min-h-10 rounded-[8px] px-2 text-sm font-semibold capitalize transition", designMode === item ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-[#f6f4ef]")}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          {palettePresets.map((palette) => (
            <button
              key={palette.name}
              onClick={() => applyPalette(palette)}
              className="flex min-h-12 items-center justify-between gap-3 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm font-semibold transition hover:bg-[#f6f4ef]"
            >
              <span>{palette.name}</span>
              <span className="flex gap-1">
                {[palette.base, palette.accent, palette.trim, palette.vinyl].map((color) => (
                  <span key={color} className="h-6 w-6 rounded-full border border-slate-200" style={{ background: color }} />
                ))}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ["Base", baseColor, setBaseColor],
            ["Accent", accentColor, setAccentColor],
            ["Trim", trimColor, setTrimColor],
            ["Vinyl", vinylColor, setVinylColor],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="block">
              <span className="mb-1 block text-sm font-semibold">{label as string}</span>
              <input className="field h-12" type="color" value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} />
            </label>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Garment style</span>
          <select className="field" value={garmentStyle} onChange={(event) => setGarmentStyle(event.target.value as GarmentStyle)}>
            <option value="classic">Classic jersey</option>
            <option value="raglan">Raglan sleeve</option>
            <option value="pro-panel">Pro panel</option>
            <option value="training">Training fit</option>
          </select>
        </label>
      </div>
    );
  }

  function renderAssetsPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={ImageIcon} title="Image And Assets" detail={imageStatus === "optimizing" ? "Optimizing" : uploadedImage ? "Ready" : "Empty"} />

        <label className="block rounded-[8px] border border-dashed border-[#c9c0b2] bg-white p-4 text-sm">
          <span className="mb-2 block font-semibold">Insert photo or logo</span>
          <input type="file" accept="image/*" onChange={(event) => void handleImageUpload(event.target.files?.[0])} />
        </label>

        {uploadedImage ? (
          <div className="rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{uploadedImage.name}</p>
                <p className="mt-1 text-xs text-slate-500">{uploadedImage.width} x {uploadedImage.height}px / {formatBytes(uploadedImage.optimizedSize)}</p>
              </div>
              <button className="rounded-[8px] border border-[#ded8cd] px-2 py-1 text-xs font-semibold" onClick={clearUploadedImage}>
                Remove
              </button>
            </div>
            <div className="mt-3 h-24 overflow-hidden rounded-[8px] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedImage.url} alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Mask</span>
            <select className="field" value={imageMask} onChange={(event) => setImageMask(event.target.value as ImageMask)}>
              <option value="rectangle">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="shield">Shield</option>
              <option value="diamond">Diamond</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Crest code</span>
            <input className="field" value={crest} onChange={(event) => setCrest(event.target.value.toUpperCase().slice(0, 4))} />
          </label>
        </div>

        <RangeControl label="Horizontal" value={imageX} min={90} max={310} onChange={setImageX} />
        <RangeControl label="Vertical" value={imageY} min={86} max={422} onChange={setImageY} />
        <RangeControl label="Size" value={imageSize} min={26} max={190} suffix="px" onChange={setImageSize} />
        <RangeControl label="Rotation" value={imageRotation} min={-45} max={45} suffix="deg" onChange={setImageRotation} />
        <RangeControl label="Opacity" value={imageOpacity} min={15} max={100} suffix="%" onChange={setImageOpacity} />
      </div>
    );
  }

  function renderTextPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={Type} title="Names, Numbers, Sponsor" detail={textEffect} />

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Text engine</span>
          <select className="field" value={textEffect} onChange={(event) => setTextEffect(event.target.value as TextEffect)}>
            <option value="flat">Flat vinyl</option>
            <option value="outline">Pro outline</option>
            <option value="shadow">Shadow stack</option>
            <option value="arch">Arched name</option>
            <option value="split">Split stripe</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Player name</span>
          <input className="field" value={playerName} onChange={(event) => setPlayerName(event.target.value.toUpperCase().slice(0, 16))} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Number</span>
            <input className="field" value={playerNumber} onChange={(event) => setPlayerNumber(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Sponsor</span>
            <input className="field" value={sponsor} onChange={(event) => setSponsor(event.target.value.toUpperCase().slice(0, 24))} />
          </label>
        </div>

        <RangeControl label="Letter spacing" value={textTracking} min={0} max={7} onChange={setTextTracking} />
        <RangeControl label="Outline width" value={outlineWidth} min={0} max={8} onChange={setOutlineWidth} />
        <RangeControl label="Name height" value={nameY} min={176} max={260} onChange={setNameY} />
        <RangeControl label="Number height" value={numberY} min={260} max={376} onChange={setNumberY} />
        <RangeControl label="Sponsor height" value={sponsorY} min={210} max={320} onChange={setSponsorY} />
        <RangeControl label="Number scale" value={numberScale} min={68} max={132} suffix="%" onChange={setNumberScale} />
        <RangeControl label="Arch strength" value={nameArch} min={12} max={82} onChange={setNameArch} />
      </div>
    );
  }

  function renderLayoutPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={BoxSelect} title="Patterns And Shapes" detail={patternStyle} />

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Pattern system</span>
          <select className="field" value={patternStyle} onChange={(event) => setPatternStyle(event.target.value as PatternStyle)}>
            <option value="none">None</option>
            <option value="pinstripe">Pinstripe</option>
            <option value="diagonal">Diagonal attack</option>
            <option value="chevron">Chevron</option>
            <option value="halftone">Halftone</option>
            <option value="speed-lines">Speed lines</option>
            <option value="panel-grid">Panel grid</option>
          </select>
        </label>

        <RangeControl label="Fabric texture" value={textureStrength} min={0} max={45} suffix="%" onChange={setTextureStrength} />

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Vector shape</span>
          <select className="field" value={shapeKind} onChange={(event) => setShapeKind(event.target.value as ShapeKind)}>
            <option value="sash">Sash banner</option>
            <option value="shield">Shield</option>
            <option value="circle">Circle badge</option>
            <option value="star">Star</option>
            <option value="lightning">Lightning</option>
          </select>
        </label>

        <RangeControl label="Shape horizontal" value={shapeX} min={70} max={330} onChange={setShapeX} />
        <RangeControl label="Shape vertical" value={shapeY} min={120} max={438} onChange={setShapeY} />
        <RangeControl label="Shape scale" value={shapeScale} min={35} max={165} suffix="%" onChange={setShapeScale} />
        <RangeControl label="Shape rotation" value={shapeRotation} min={-55} max={55} suffix="deg" onChange={setShapeRotation} />
        <RangeControl label="Shape opacity" value={shapeOpacity} min={10} max={100} suffix="%" onChange={setShapeOpacity} />
      </div>
    );
  }

  function renderLayersPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={Layers} title="Layer Stack" detail={`${activeLayers}/${totalLayers}`} />
        <div className="grid gap-2">
          {(Object.keys(layerLabels) as LayerKey[]).map((layer) => (
            <label key={layer} className="flex min-h-11 items-center justify-between gap-3 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                {layers[layer] ? <Eye size={15} className="text-emerald-600" /> : <EyeOff size={15} className="text-slate-400" />}
                {layerLabels[layer]}
              </span>
              <input type="checkbox" checked={layers[layer]} onChange={() => toggleLayer(layer)} />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setLayers((current) => Object.fromEntries(Object.keys(current).map((key) => [key, true])) as Record<LayerKey, boolean>)}>
            <Eye size={16} /> Show all
          </Button>
          <Button variant="outline" onClick={() => setLayers((current) => ({ ...current, texture: false, pattern: false, shape: false, image: false }))}>
            <Lock size={16} /> Clean cut
          </Button>
        </div>
      </div>
    );
  }

  function renderProductionPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={Scissors} title="Cutter And Heat Press" detail={`${productionScore}%`} />

        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><Flame size={15} /> Material</span>
          <select className="field" value={material} onChange={(event) => applyMaterial(event.target.value as MaterialPreset)}>
            {Object.entries(materialPresets).map(([key, preset]) => (
              <option key={key} value={key}>{preset.label}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2 rounded-[8px] bg-white p-3 text-center text-sm">
          <div>
            <p className="text-xs text-slate-500">Temp</p>
            <p className="font-semibold">{materialConfig.heatTemp}C</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Time</p>
            <p className="font-semibold">{materialConfig.heatSeconds}s</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Press</p>
            <p className="font-semibold">{materialConfig.pressure}</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><Printer size={15} /> Cutter profile</span>
          <select className="field" value={cutter} onChange={(event) => applyCutter(event.target.value as CutterProfile)}>
            {Object.entries(cutterProfiles).map(([key, profile]) => (
              <option key={key} value={key}>{profile.label}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><Ruler size={15} /> Offset</span>
            <input className="field" type="number" step="0.05" min="0" max="2" value={bladeOffset} onChange={(event) => setBladeOffset(Number(event.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Overcut</span>
            <input className="field" type="number" step="0.05" min="0" max="3" value={overcut} onChange={(event) => setOvercut(Number(event.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><Gauge size={15} /> Force</span>
            <input className="field" type="number" min="0" max="500" value={cutForce} onChange={(event) => setCutForce(Number(event.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Speed</span>
            <input className="field" type="number" min="0" max="80" value={cutSpeed} onChange={(event) => setCutSpeed(Number(event.target.value))} />
          </label>
        </div>

        <RangeControl label="Contour offset" value={contourOffset} min={0} max={12} step={0.5} suffix="mm" onChange={setContourOffset} />
        <RangeControl label="Corner smoothing" value={cornerSmoothing} min={0} max={100} suffix="%" onChange={setCornerSmoothing} />
        <RangeControl label="Bleed margin" value={bleedMargin} min={0} max={10} suffix="mm" onChange={setBleedMargin} />
        <RangeControl label="Nesting gap" value={nestingGap} min={0} max={24} suffix="mm" onChange={setNestingGap} />

        <div className="grid gap-2 rounded-[8px] bg-white p-3 text-sm">
          {[
            ["Mirror for HTV", mirrorCut, setMirrorCut],
            ["Preserve cut order", preserveCutOrder, setPreserveCutOrder],
            ["Safe print area", showSafeArea, setShowSafeArea],
            ["Rulers", showRulers, setShowRulers],
            ["Auto weed lines", autoWeedLines, setAutoWeedLines],
            ["Snap to guides", snapToGuides, setSnapToGuides],
          ].map(([label, checked, setter]) => (
            <label key={label as string} className="flex items-center justify-between gap-2">
              <span>{label as string}</span>
              <input type="checkbox" checked={checked as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} />
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderQualityPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={BadgeCheck} title="Production Intelligence" detail={`${passedChecks}/${qualityChecks.length}`} />

        <div className="grid grid-cols-3 gap-2 rounded-[8px] bg-white p-3 text-center text-sm">
          <div>
            <p className="text-xs text-slate-500">Score</p>
            <p className="font-semibold">{productionScore}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Cut</p>
            <p className="font-semibold">{cutComplexity}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Press</p>
            <p className="font-semibold">{pressMinutes}m</p>
          </div>
        </div>

        <div className="grid gap-2">
          {qualityChecks.map((check) => (
            <div key={check.label} className="flex min-h-11 items-center justify-between gap-3 rounded-[8px] border border-[#ded8cd] bg-white px-3 text-sm">
              <span className="font-semibold">{check.label}</span>
              {check.ok ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-orange-600" />}
            </div>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Auto optimizer</span>
          <select className="field" value={productionAid} onChange={(event) => setProductionAid(event.target.value as ProductionAid)}>
            <option value="balanced">Balanced</option>
            <option value="speed">Speed cut</option>
            <option value="precision">Precision press</option>
            <option value="waste-saver">Waste saver</option>
          </select>
        </label>
      </div>
    );
  }

  function renderExportPanel() {
    return (
      <div className="space-y-4">
        <PanelHeading icon={Download} title="Export Center" detail="SVG PLT JSON" />

        <div className="grid gap-2">
          <Button onClick={downloadSvg} className="justify-start">
            <Download size={16} /> Export SVG artwork
          </Button>
          <Button variant="secondary" onClick={downloadHpgl} className="justify-start">
            <Scissors size={16} /> Export cutter PLT
          </Button>
          <Button variant="outline" onClick={downloadJob} className="justify-start">
            <FileJson size={16} /> Export production JSON
          </Button>
          <Button variant="outline" onClick={downloadTechPack} className="justify-start">
            <Printer size={16} /> Export print tech pack
          </Button>
        </div>

        <div className="rounded-[8px] border border-[#ded8cd] bg-white p-3 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Save size={16} /> Package Summary</div>
          <div className="space-y-1 text-slate-600">
            <p>Artwork: {view === "production" ? "mirrored production" : `${view} mockup`}</p>
            <p>Layers: {activeLayers}/{totalLayers}</p>
            <p>Material: {materialConfig.label}</p>
            <p>Image: {uploadedImage ? "optimized asset included" : "no imported image"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Copies</span>
            <input className="field" type="number" min="1" max="100" value={copies} onChange={(event) => setCopies(clamp(Number(event.target.value), 1, 100))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Press passes</span>
            <input className="field" type="number" min="1" max="5" value={pressPasses} onChange={(event) => setPressPasses(clamp(Number(event.target.value), 1, 5))} />
          </label>
        </div>
      </div>
    );
  }

  function renderActivePanel() {
    if (activeTab === "brand") return renderBrandPanel();
    if (activeTab === "assets") return renderAssetsPanel();
    if (activeTab === "text") return renderTextPanel();
    if (activeTab === "layout") return renderLayoutPanel();
    if (activeTab === "layers") return renderLayersPanel();
    if (activeTab === "production") return renderProductionPanel();
    if (activeTab === "quality") return renderQualityPanel();
    return renderExportPanel();
  }

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#d7dce2] bg-[#eef2f6] shadow-[0_18px_45px_rgb(15_23_42/0.09)]">
      <div className="border-b border-slate-800 bg-slate-950 px-3 py-3 text-white sm:px-4">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-slate-950">
              <WandSparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold sm:text-lg">Design Command Studio</h2>
              <p className="text-xs text-white/60">Score {productionScore}% / {materialConfig.label} / {cutterConfig.label}</p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 2xl:pb-0">
            {toolItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  title={item.label}
                  onClick={() => chooseTool(item.key)}
                  className={clsx("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold transition", activeTool === item.key ? "bg-white text-slate-950" : "bg-white/10 text-white hover:bg-white/20")}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 2xl:pb-0">
            <Button variant="outline" className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={resetDesign}>
              <RotateCcw size={16} /> Reset
            </Button>
            <Button className="shrink-0 bg-white text-slate-950 hover:bg-white/90" onClick={downloadSvg}>
              <Download size={16} /> SVG
            </Button>
            <Button variant="outline" className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={downloadHpgl}>
              <Scissors size={16} /> PLT
            </Button>
            <Button variant="outline" className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={downloadJob}>
              <FileJson size={16} /> JSON
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-[#d7dce2] bg-white px-3 py-2 sm:px-4">
        <div className="flex gap-2 overflow-x-auto">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={clsx("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold transition", activeTab === item.key ? "bg-[var(--shop-primary)] text-white" : "text-slate-600 hover:bg-[#f6f4ef]")}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-[760px] xl:grid-cols-[330px_minmax(0,1fr)_340px]">
        <aside className="border-b border-[#d7dce2] bg-[#fbfcfd] p-4 xl:border-b-0 xl:border-r">
          {renderActivePanel()}
        </aside>

        <main className="min-w-0 bg-[#e7edf3] p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2 overflow-x-auto">
              {(["front", "back", "production"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setView(item)}
                  className={clsx("min-h-10 shrink-0 rounded-[8px] px-4 text-sm font-semibold capitalize transition", view === item ? "bg-slate-950 text-white" : "bg-white text-slate-700 hover:bg-[#f6f4ef]")}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-slate-700" title="Zoom out" onClick={() => setCanvasZoom((current) => clamp(current - 10, 70, 150))}>
                <ZoomOut size={17} />
              </button>
              <span className="inline-flex h-10 min-w-14 items-center justify-center rounded-[8px] bg-white px-2 text-xs font-semibold text-slate-600">{canvasZoom}%</span>
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-white text-slate-700" title="Zoom in" onClick={() => setCanvasZoom((current) => clamp(current + 10, 70, 150))}>
                <ZoomIn size={17} />
              </button>
            </div>
          </div>

          <div className="flex min-h-[610px] items-center justify-center rounded-[8px] border border-[#d7dce2] bg-[#f8fafc] p-3 sm:p-6">
            <div className="aspect-[400/520] w-full rounded-[8px] bg-white shadow-[0_24px_60px_rgb(15_23_42/0.14)]" style={{ maxWidth: `${Math.round(560 * (canvasZoom / 100))}px` }} dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </main>

        <aside className="border-t border-[#d7dce2] bg-[#fbfcfd] p-4 xl:border-l xl:border-t-0">
          <div className="space-y-4">
            <PanelHeading icon={Settings2} title="Live Inspector" detail={activeTool} />

            <div className="rounded-[8px] border border-[#ded8cd] bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Production health</span>
                <span className={clsx("rounded-[8px] px-2 py-1 text-xs font-semibold", productionScore >= 86 ? "bg-emerald-100 text-emerald-700" : productionScore >= 70 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700")}>{productionScore}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[var(--shop-primary)]" style={{ width: `${clamp(productionScore, 0, 100)}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-[8px] bg-[#f6f4ef] p-2">
                  <p className="text-slate-500">Vinyl</p>
                  <p className="font-semibold">{vinylUsage}m</p>
                </div>
                <div className="rounded-[8px] bg-[#f6f4ef] p-2">
                  <p className="text-slate-500">Cut</p>
                  <p className="font-semibold">{cutComplexity}%</p>
                </div>
                <div className="rounded-[8px] bg-[#f6f4ef] p-2">
                  <p className="text-slate-500">Press</p>
                  <p className="font-semibold">{pressMinutes}m</p>
                </div>
              </div>
            </div>

            <div className="rounded-[8px] border border-[#ded8cd] bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ScanLine size={16} /> Fast Status</div>
              <div className="space-y-2 text-sm text-slate-600">
                <p>Mode: <span className="font-semibold text-slate-900">{designMode}</span></p>
                <p>View: <span className="font-semibold text-slate-900">{view}</span></p>
                <p>Pattern: <span className="font-semibold text-slate-900">{patternStyle}</span></p>
                <p>Layers: <span className="font-semibold text-slate-900">{activeLayers}/{totalLayers}</span></p>
                <p>Image: <span className="font-semibold text-slate-900">{uploadedImage ? "optimized" : "none"}</span></p>
              </div>
            </div>

            <div className="rounded-[8px] border border-[#ded8cd] bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BadgeCheck size={16} /> Checklist</div>
              <div className="grid gap-2">
                {qualityChecks.slice(0, 5).map((check) => (
                  <div key={check.label} className="flex items-center justify-between gap-3 text-sm">
                    <span>{check.label}</span>
                    {check.ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-orange-600" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[8px] bg-slate-950 p-3 text-sm text-white">
              <div className="mb-2 flex items-center gap-2 font-semibold"><Shirt size={16} /> Press recipe</div>
              <p className="text-white/80">{materialConfig.note}</p>
              <p className="mt-2 text-white/60">Media {cutterConfig.width} x {cutterConfig.height} mm, blade {bladeOffset} mm, overcut {overcut} mm.</p>
            </div>

            <Button variant="secondary" className="w-full" onClick={downloadTechPack}>
              <Printer size={16} /> Print tech pack
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}
