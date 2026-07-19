"use client";

import {
  BadgeCheck,
  Download,
  Flame,
  Gauge,
  Layers,
  MoveHorizontal,
  Printer,
  RotateCcw,
  Ruler,
  ScanLine,
  Scissors,
  Shirt,
  Sparkles,
  Type,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type GarmentStyle = "classic" | "raglan" | "pro-panel" | "training";
type ViewMode = "front" | "back" | "production";
type MaterialPreset = "pu-vinyl" | "flock" | "sublimation" | "twill";
type CutterProfile = "generic-hpgl" | "graphtec-ce" | "roland-gs" | "silhouette-cameo";
type LayerKey = "crest" | "sponsor" | "name" | "number" | "sideStripes" | "contour" | "weedBox" | "registration";

const materialPresets: Record<MaterialPreset, { label: string; heatTemp: number; heatSeconds: number; pressure: string; bladeForce: number; speed: number; note: string }> = {
  "pu-vinyl": { label: "PU HTV", heatTemp: 155, heatSeconds: 15, pressure: "Medium", bladeForce: 90, speed: 22, note: "Layered name and number" },
  flock: { label: "Flock", heatTemp: 165, heatSeconds: 18, pressure: "Firm", bladeForce: 135, speed: 16, note: "Thicker textured vinyl" },
  sublimation: { label: "Sublimation", heatTemp: 200, heatSeconds: 45, pressure: "Medium", bladeForce: 0, speed: 0, note: "Print transfer layout" },
  twill: { label: "Twill", heatTemp: 170, heatSeconds: 25, pressure: "Firm", bladeForce: 160, speed: 12, note: "Patch and applique prep" },
};

const cutterProfiles: Record<CutterProfile, { label: string; offset: number; overcut: number; width: number; height: number }> = {
  "generic-hpgl": { label: "Generic HPGL", offset: 0.25, overcut: 0.35, width: 600, height: 500 },
  "graphtec-ce": { label: "Graphtec CE", offset: 0.25, overcut: 0.45, width: 610, height: 500 },
  "roland-gs": { label: "Roland GS", offset: 0.25, overcut: 0.3, width: 584, height: 500 },
  "silhouette-cameo": { label: "Silhouette Cameo", offset: 0.2, overcut: 0.25, width: 305, height: 305 },
};

const layerLabels: Record<LayerKey, string> = {
  crest: "Crest",
  sponsor: "Sponsor",
  name: "Name",
  number: "Number",
  sideStripes: "Panels",
  contour: "Contour",
  weedBox: "Weed box",
  registration: "Marks",
};

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
  URL.revokeObjectURL(url);
}

function fitNameSize(value: string) {
  if (value.length > 12) return 25;
  if (value.length > 9) return 30;
  return 35;
}

function fitSponsorSize(value: string) {
  if (value.length > 18) return 17;
  if (value.length > 12) return 20;
  return 24;
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

function hpglJob(copies: number, mirrorCut: boolean, contourOffset: number) {
  const mirror = mirrorCut ? "1" : "0";
  return [
    "IN;",
    "SP1;",
    `VS${Math.max(1, copies)};`,
    `PU0,0;PA0,0;PD3900,0;PD3900,4700;PD0,4700;PD0,0;PU;`,
    `PU1400,1700;CI${Math.round((contourOffset + 1) * 95)};PU;`,
    `PU1150,2500;LBNAME/NUMBER M${mirror};`,
    "SP0;",
  ].join("\n");
}

export function DesignStudio() {
  const [garmentStyle, setGarmentStyle] = useState<GarmentStyle>("pro-panel");
  const [baseColor, setBaseColor] = useState("#0f766e");
  const [accentColor, setAccentColor] = useState("#f97316");
  const [trimColor, setTrimColor] = useState("#111827");
  const [vinylColor, setVinylColor] = useState("#ffffff");
  const [playerName, setPlayerName] = useState("MENSAH");
  const [playerNumber, setPlayerNumber] = useState("10");
  const [sponsor, setSponsor] = useState("ACCRA PRO");
  const [crest, setCrest] = useState("APS");
  const [view, setView] = useState<ViewMode>("back");
  const [material, setMaterial] = useState<MaterialPreset>("pu-vinyl");
  const [cutter, setCutter] = useState<CutterProfile>("generic-hpgl");
  const [bladeOffset, setBladeOffset] = useState(cutterProfiles["generic-hpgl"].offset);
  const [overcut, setOvercut] = useState(cutterProfiles["generic-hpgl"].overcut);
  const [cutForce, setCutForce] = useState(materialPresets["pu-vinyl"].bladeForce);
  const [cutSpeed, setCutSpeed] = useState(materialPresets["pu-vinyl"].speed);
  const [contourOffset, setContourOffset] = useState(2);
  const [copies, setCopies] = useState(1);
  const [mirrorCut, setMirrorCut] = useState(true);
  const [preserveCutOrder, setPreserveCutOrder] = useState(true);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    crest: true,
    sponsor: true,
    name: true,
    number: true,
    sideStripes: true,
    contour: true,
    weedBox: true,
    registration: true,
  });

  const materialConfig = materialPresets[material];
  const cutterConfig = cutterProfiles[cutter];

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
    const sideStripes = layers.sideStripes
      ? `
        <path d="M118 162 C146 185 254 185 282 162" fill="none" stroke="${accentColor}" stroke-width="11"/>
        <path d="M120 404 L280 404" stroke="${accentColor}" stroke-width="15"/>
        <path d="M116 178 C130 270 130 374 118 456" fill="none" stroke="${accentColor}" stroke-width="5" opacity="0.85"/>
        <path d="M284 178 C270 270 270 374 282 456" fill="none" stroke="${accentColor}" stroke-width="5" opacity="0.85"/>`
      : "";
    const crestShape = layers.crest
      ? `
        <g>
          <path d="M177 118 L200 102 L223 118 L216 148 L184 148 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="3"/>
          <text x="200" y="139" text-anchor="middle" font-size="15" font-weight="800" fill="#ffffff">${safeCrest}</text>
        </g>`
      : "";
    const sponsorText = layers.sponsor && frontVisible
      ? `<text x="200" y="262" text-anchor="middle" font-size="${sponsorSize}" font-weight="800" fill="${vinylColor}">${safeSponsor}</text>`
      : "";
    const backText = backVisible
      ? `
        ${layers.name ? `<text x="200" y="212" text-anchor="middle" font-size="${nameSize}" font-weight="800" fill="${vinylColor}">${safePlayerName}</text>` : ""}
        ${layers.number ? `<text x="200" y="318" text-anchor="middle" font-size="104" font-weight="900" fill="${vinylColor}">${safePlayerNumber}</text>` : ""}
        ${layers.number && productionMode ? `<text x="200" y="372" text-anchor="middle" font-size="13" font-weight="700" fill="#64748b">CUT ${copies} / ${materialConfig.label}</text>` : ""}`
      : "";
    const contour = layers.contour
      ? `<path d="${path}" fill="none" stroke="#0f172a" stroke-width="${productionMode ? 2 : 3}" stroke-dasharray="${cutDash}" opacity="${productionMode ? "0.85" : "1"}"/>`
      : "";
    const transferGroup = productionMode && mirrorCut ? `transform="translate(400 0) scale(-1 1)"` : "";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520" role="img" aria-label="Jersey production artwork">
      <rect width="400" height="520" fill="#f8fafc"/>
      <g ${transferGroup}>
        ${weedBox}
        <path d="${path}" fill="${baseColor}" stroke="${trimColor}" stroke-width="4"/>
        <path d="M160 42 C175 86 225 86 240 42 L218 96 L182 96 Z" fill="${accentColor}" stroke="${trimColor}" stroke-width="2"/>
        ${sideStripes}
        ${crestShape}
        ${sponsorText}
        ${backText}
        ${contour}
      </g>
      ${registration}
    </svg>`;
  }, [
    accentColor,
    baseColor,
    copies,
    crest,
    garmentStyle,
    layers,
    materialConfig.label,
    mirrorCut,
    playerName,
    playerNumber,
    sponsor,
    trimColor,
    view,
    vinylColor,
  ]);

  const productionManifest = useMemo(() => ({
    jobName: `${playerName || "PLAYER"}-${playerNumber || "00"}`,
    view,
    garmentStyle,
    material: materialConfig.label,
    heatPress: {
      temperatureC: materialConfig.heatTemp,
      seconds: materialConfig.heatSeconds,
      pressure: materialConfig.pressure,
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
      mirrorCut,
      preserveCutOrder,
      copies,
    },
    layers,
    colors: { baseColor, accentColor, trimColor, vinylColor },
  }), [
    accentColor,
    baseColor,
    bladeOffset,
    contourOffset,
    copies,
    cutForce,
    cutSpeed,
    cutterConfig.height,
    cutterConfig.label,
    cutterConfig.width,
    garmentStyle,
    layers,
    materialConfig.heatSeconds,
    materialConfig.heatTemp,
    materialConfig.label,
    materialConfig.pressure,
    mirrorCut,
    overcut,
    playerName,
    playerNumber,
    preserveCutOrder,
    trimColor,
    view,
    vinylColor,
  ]);

  function applyMaterial(nextMaterial: MaterialPreset) {
    const preset = materialPresets[nextMaterial];
    setMaterial(nextMaterial);
    setCutForce(preset.bladeForce);
    setCutSpeed(preset.speed);
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

  function resetDesign() {
    setGarmentStyle("pro-panel");
    setBaseColor("#0f766e");
    setAccentColor("#f97316");
    setTrimColor("#111827");
    setVinylColor("#ffffff");
    setPlayerName("MENSAH");
    setPlayerNumber("10");
    setSponsor("ACCRA PRO");
    setCrest("APS");
    setView("back");
    applyMaterial("pu-vinyl");
    applyCutter("generic-hpgl");
    setContourOffset(2);
    setCopies(1);
    setMirrorCut(true);
    setPreserveCutOrder(true);
    setLayers({
      crest: true,
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
    downloadFile(`plotter-job-${playerName || "design"}.json`, JSON.stringify(productionManifest, null, 2), "application/json");
  }

  function downloadHpgl() {
    downloadFile(`cut-path-${playerName || "design"}.plt`, hpglJob(copies, mirrorCut, contourOffset), "application/octet-stream");
  }

  const activeLayers = Object.values(layers).filter(Boolean).length;
  const productionScore = Math.round(((layers.contour ? 25 : 0) + (layers.registration ? 20 : 0) + (layers.weedBox ? 15 : 0) + (mirrorCut ? 15 : 0) + (preserveCutOrder ? 10 : 0) + Math.min(activeLayers * 2, 15)));

  return (
    <div className="grid gap-5 2xl:grid-cols-[420px_1fr_360px]">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shirt size={18} className="text-[var(--shop-primary)]" />
          <h2 className="text-lg font-semibold">Jersey studio</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["front", "back", "production"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`min-h-10 rounded-[8px] px-3 text-sm font-semibold capitalize transition ${view === item ? "bg-[var(--shop-primary)] text-white" : "bg-white text-slate-700 hover:bg-[#f6f4ef]"}`}
              >
                {item}
              </button>
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Base</span>
              <input className="field h-12" type="color" value={baseColor} onChange={(event) => setBaseColor(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Accent</span>
              <input className="field h-12" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Trim</span>
              <input className="field h-12" type="color" value={trimColor} onChange={(event) => setTrimColor(event.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Vinyl</span>
              <input className="field h-12" type="color" value={vinylColor} onChange={(event) => setVinylColor(event.target.value)} />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><Type size={15} /> Player name</span>
            <input className="field" value={playerName} onChange={(event) => setPlayerName(event.target.value.toUpperCase().slice(0, 16))} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Number</span>
              <input className="field" value={playerNumber} onChange={(event) => setPlayerNumber(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Crest</span>
              <input className="field" value={crest} onChange={(event) => setCrest(event.target.value.toUpperCase().slice(0, 4))} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Sponsor</span>
            <input className="field" value={sponsor} onChange={(event) => setSponsor(event.target.value.toUpperCase().slice(0, 24))} />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={resetDesign}>
              <RotateCcw size={16} /> Reset
            </Button>
            <Button onClick={downloadSvg}>
              <Download size={16} /> SVG
            </Button>
            <Button variant="secondary" onClick={downloadJob}>
              <Printer size={16} /> Job
            </Button>
          </div>
        </div>
      </section>

      <section className="panel min-h-[700px] overflow-hidden bg-white">
        <div className="grid gap-4 border-b border-[#ded8cd] p-4 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--shop-primary)]" />
              <h2 className="font-semibold">Production canvas</h2>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[#f6f4ef] px-3 py-1 font-semibold">{materialConfig.label}</span>
              <span className="rounded-full bg-[#f6f4ef] px-3 py-1 font-semibold">{cutterConfig.label}</span>
              <span className="rounded-full bg-[#f6f4ef] px-3 py-1 font-semibold">{productionScore}% ready</span>
            </div>
          </div>
          <Button variant="outline" onClick={downloadHpgl}>
            <Scissors size={16} /> PLT
          </Button>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_230px]">
          <div className="flex min-h-[560px] items-center justify-center rounded-[8px] bg-[#eef2f6] p-4">
            <div className="w-full max-w-[560px] drop-shadow-sm" dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div className="grid content-start gap-3 text-sm">
            <div className="rounded-[8px] border border-[#ded8cd] p-3">
              <div className="mb-2 flex items-center gap-2 font-semibold"><Layers size={16} /> Layers</div>
              <div className="grid gap-2">
                {(Object.keys(layerLabels) as LayerKey[]).map((layer) => (
                  <label key={layer} className="flex items-center justify-between gap-2 rounded-[8px] bg-[#f8fafc] px-3 py-2">
                    <span>{layerLabels[layer]}</span>
                    <input type="checkbox" checked={layers[layer]} onChange={() => toggleLayer(layer)} />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-[8px] border border-[#ded8cd] p-3">
              <div className="mb-2 flex items-center gap-2 font-semibold"><BadgeCheck size={16} /> Output</div>
              <div className="space-y-2 text-slate-600">
                <p>Artwork: {view === "production" ? "mirrored transfer" : `${view} mockup`}</p>
                <p>Layers active: {activeLayers}/8</p>
                <p>Copies: {copies}</p>
                <p>Cut order: {preserveCutOrder ? "preserved" : "optimized"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Scissors size={18} className="text-[var(--shop-primary)]" />
          <h2 className="text-lg font-semibold">Machine setup</h2>
        </div>

        <div className="space-y-4">
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

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><MoveHorizontal size={15} /> Contour offset</span>
            <input className="field" type="number" step="0.5" min="0" max="12" value={contourOffset} onChange={(event) => setContourOffset(Number(event.target.value))} />
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold"><ScanLine size={15} /> Copies</span>
            <input className="field" type="number" min="1" max="100" value={copies} onChange={(event) => setCopies(Number(event.target.value))} />
          </label>

          <div className="grid gap-2 rounded-[8px] bg-white p-3 text-sm">
            <label className="flex items-center justify-between gap-2">
              <span>Mirror for HTV</span>
              <input type="checkbox" checked={mirrorCut} onChange={(event) => setMirrorCut(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span>Preserve cut order</span>
              <input type="checkbox" checked={preserveCutOrder} onChange={(event) => setPreserveCutOrder(event.target.checked)} />
            </label>
          </div>

          <div className="rounded-[8px] bg-slate-950 p-3 text-sm text-white">
            <p className="font-semibold">{materialConfig.note}</p>
            <p className="mt-2 text-white/70">Media {cutterConfig.width} x {cutterConfig.height} mm, blade {bladeOffset} mm, overcut {overcut} mm.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
