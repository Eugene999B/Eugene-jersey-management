"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  ImagePlus,
  Layers3,
  Lock,
  MonitorCog,
  Printer,
  Redo2,
  Save,
  Scissors,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  Usb,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";

type Material = "htv" | "printable-htv" | "sublimation" | "dtf" | "flock";
type Sheet = "a4" | "a3" | "12x20" | "15x20" | "custom";
type DeviceState = "not-configured" | "unsupported" | "selecting" | "connected" | "error";
type LayerKind = "image" | "text" | "rectangle" | "circle";
type MachineProfile = "Generic SVG" | "SignMaster" | "VinylMaster" | "Print/RIP";
type SavedDesign = { id: string; title: string; canvas: Record<string, unknown> };
type DesignLayer = {
  id: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  content?: string;
  url?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  fontFamily?: string;
  fontWeight?: number;
};

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};
type NavigatorWithSerial = Navigator & { serial?: { requestPort(): Promise<SerialPortLike> } };

const sheets: Record<Exclude<Sheet, "custom">, { label: string; width: number; height: number }> = {
  a4: { label: "A4", width: 210, height: 297 },
  a3: { label: "A3", width: 297, height: 420 },
  "12x20": { label: "12 × 20 in", width: 305, height: 508 },
  "15x20": { label: "15 × 20 in", width: 381, height: 508 },
};
const materialDetails: Record<Material, { label: string; instruction: string; defaultMirror: boolean }> = {
  htv: { label: "Heat-transfer vinyl (HTV)", instruction: "Mirror before cutting. Weed, cover, then press to the vinyl maker's specification.", defaultMirror: true },
  "printable-htv": { label: "Printable HTV", instruction: "Print on the printable face, contour-cut, mask if required, then heat apply.", defaultMirror: false },
  sublimation: { label: "Sublimation paper", instruction: "Mirror before printing. Use the correct polyester material and ink/paper profile.", defaultMirror: true },
  dtf: { label: "DTF transfer film", instruction: "Print through the RIP workflow, powder and cure, then heat apply.", defaultMirror: false },
  flock: { label: "Flock vinyl", instruction: "Mirror before cutting. Weed carefully and follow the material temperature and peel instructions.", defaultMirror: true },
};

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "design-job";
}
function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function finiteNumber(value: unknown, fallback: number, min = -100_000, max = 100_000) {
  const number = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function normalizedLayers(value: unknown[]): DesignLayer[] {
  const kinds: LayerKind[] = ["image", "text", "rectangle", "circle"];
  const fonts = ["Arial", "Impact", "Georgia", "Courier New", "Times New Roman"];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const layer = entry as Record<string, unknown>;
    if (!kinds.includes(layer.kind as LayerKind)) return [];
    const kind = layer.kind as LayerKind;
    const rawUrl = typeof layer.url === "string" ? layer.url.slice(0, 1_500_000) : undefined;
    const url = rawUrl && (/^data:image\/(?:png|jpeg|webp|avif|svg\+xml);base64,/i.test(rawUrl) || rawUrl.startsWith("/api/media/local/") || /^https:\/\//i.test(rawUrl)) ? rawUrl : undefined;
    return [{
      id: typeof layer.id === "string" ? layer.id.slice(0, 100) : id(),
      kind,
      name: typeof layer.name === "string" ? layer.name.slice(0, 120) : "Layer",
      visible: layer.visible !== false,
      locked: layer.locked === true,
      x: finiteNumber(layer.x, 0),
      y: finiteNumber(layer.y, 0),
      width: finiteNumber(layer.width, 20, 0.1),
      height: finiteNumber(layer.height, 20, 0.1),
      rotation: finiteNumber(layer.rotation, 0, -3600, 3600),
      color: typeof layer.color === "string" && /^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : "#111827",
      content: typeof layer.content === "string" ? layer.content.slice(0, 500) : undefined,
      url,
      sourceWidth: finiteNumber(layer.sourceWidth, 1, 1),
      sourceHeight: finiteNumber(layer.sourceHeight, 1, 1),
      fontFamily: typeof layer.fontFamily === "string" && fonts.includes(layer.fontFamily) ? layer.fontFamily : "Arial",
      fontWeight: finiteNumber(layer.fontWeight, 700, 100, 900),
    }];
  });
}
function download(name: string, content: string, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export function DesignStudio({ savedDesigns = [] }: { savedDesigns?: SavedDesign[] }) {
  const router = useRouter();
  const [designJobId, setDesignJobId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("Not saved yet");
  const [uploadMessage, setUploadMessage] = useState("");
  const [jobName, setJobName] = useState("New design job");
  const [customer, setCustomer] = useState("");
  const [material, setMaterial] = useState<Material>("htv");
  const [sheet, setSheet] = useState<Sheet>("a3");
  const [customWidth, setCustomWidth] = useState(300);
  const [customHeight, setCustomHeight] = useState(500);
  const [copies, setCopies] = useState(1);
  const [mirror, setMirror] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [weedBox, setWeedBox] = useState(true);
  const [registrationMarks, setRegistrationMarks] = useState(false);
  const [contourOffset, setContourOffset] = useState(0);
  const [machineProfile, setMachineProfile] = useState<MachineProfile>("Generic SVG");
  const [newText, setNewText] = useState("");
  const [layers, setLayers] = useState<DesignLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<DesignLayer[][]>([]);
  const [future, setFuture] = useState<DesignLayer[][]>([]);
  const [device, setDevice] = useState<DeviceState>("not-configured");
  const [deviceName, setDeviceName] = useState("No output device selected");
  const [deviceMessage, setDeviceMessage] = useState("SVG export and system printing are ready. The optional USB/serial check only confirms that the browser can see a port.");
  const [baudRate, setBaudRate] = useState(9600);
  const portRef = useRef<SerialPortLike | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ id: string; clientX: number; clientY: number; x: number; y: number } | null>(null);

  const size = sheet === "custom" ? { label: "Custom", width: customWidth, height: customHeight } : sheets[sheet];
  const preview = useMemo(() => {
    const ratio = size.height / Math.max(size.width, 1);
    const width = ratio > 1.45 ? 390 : 520;
    return { width, height: Math.min(660, Math.max(390, width * ratio)) };
  }, [size.height, size.width]);
  const selected = layers.find((layer) => layer.id === selectedId) ?? null;

  function checkpoint(next: DesignLayer[]) {
    setPast((items) => [...items.slice(-39), layers]);
    setFuture([]);
    setLayers(next);
  }
  function updateLayer(layerId: string, changes: Partial<DesignLayer>, remember = true) {
    const next = layers.map((layer) => layer.id === layerId ? { ...layer, ...changes } : layer);
    if (remember) checkpoint(next); else setLayers(next);
  }
  function addLayer(layer: DesignLayer) {
    checkpoint([...layers, layer]);
    setSelectedId(layer.id);
  }
  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((items) => [layers, ...items].slice(0, 40));
    setLayers(previous);
    setPast((items) => items.slice(0, -1));
  }
  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items, layers].slice(-40));
    setLayers(next);
    setFuture((items) => items.slice(1));
  }
  function snapValue(value: number) {
    return snap ? Math.round(value / 5) * 5 : Math.round(value * 10) / 10;
  }

  async function uploadArtwork(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const additions: DesignLayer[] = [];
    setUploadMessage(files.length ? "Uploading artwork…" : "");
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) continue;
        let url: string;
        let dimensions: { width: number; height: number };
        if (file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml") {
          if (file.size > 1_000_000) throw new Error("SVG artwork must be smaller than 1MB.");
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error ?? new Error("Could not read SVG artwork."));
            reader.readAsDataURL(file);
          });
          dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
            const image = new window.Image();
            image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
            image.onerror = () => resolve({ width: 1, height: 1 });
            image.src = url;
          });
        } else {
          const body = new FormData();
          body.set("file", file);
          body.set("kind", "DESIGN_ASSET");
          const response = await fetch("/api/uploads", { method: "POST", body });
          const result = await response.json() as { asset?: { url: string; width?: number | null; height?: number | null }; error?: string };
          if (!response.ok || !result.asset) throw new Error(result.error ?? `Could not upload ${file.name}.`);
          url = result.asset.url;
          dimensions = { width: result.asset.width || 1, height: result.asset.height || 1 };
        }
        const width = Math.min(120, size.width * 0.55);
        additions.push({ id: id(), kind: "image", name: file.name, visible: true, locked: false, x: size.width / 2, y: size.height / 2, width, height: width * dimensions.height / Math.max(1, dimensions.width), rotation: 0, color: "#111827", url, sourceWidth: dimensions.width, sourceHeight: dimensions.height });
      }
      if (additions.length) {
        checkpoint([...layers, ...additions]);
        setSelectedId(additions.at(-1)?.id ?? null);
        setUploadMessage(`${additions.length} artwork file${additions.length === 1 ? "" : "s"} added`);
      }
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Artwork upload failed.");
    }
    event.target.value = "";
  }
  function addText() {
    const content = newText.trim() || "New text";
    addLayer({ id: id(), kind: "text", name: content.slice(0, 24), content, visible: true, locked: false, x: size.width / 2, y: size.height / 2, width: Math.min(120, size.width * 0.6), height: 20, rotation: 0, color: "#111827", fontFamily: "Arial", fontWeight: 700 });
    setNewText("");
  }
  function addShape(kind: "rectangle" | "circle") {
    addLayer({ id: id(), kind, name: kind === "circle" ? "Circle" : "Rectangle", visible: true, locked: false, x: size.width / 2, y: size.height / 2, width: 60, height: kind === "circle" ? 60 : 35, rotation: 0, color: "#111827" });
  }
  function duplicateLayer(layer: DesignLayer) {
    addLayer({ ...layer, id: id(), name: `${layer.name} copy`, x: layer.x + 5, y: layer.y + 5 });
  }
  function moveLayer(layerId: string, direction: -1 | 1) {
    const index = layers.findIndex((layer) => layer.id === layerId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[index], next[target]] = [next[target], next[index]];
    checkpoint(next);
  }
  function startDrag(event: ReactPointerEvent, layer: DesignLayer) {
    event.stopPropagation();
    setSelectedId(layer.id);
    if (layer.locked) return;
    setPast((items) => [...items.slice(-39), layers]);
    setFuture([]);
    dragRef.current = { id: layer.id, clientX: event.clientX, clientY: event.clientY, x: layer.x, y: layer.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function drag(event: ReactPointerEvent) {
    const active = dragRef.current;
    if (!active) return;
    const x = Math.max(0, Math.min(size.width, active.x + (event.clientX - active.clientX) * size.width / preview.width));
    const y = Math.max(0, Math.min(size.height, active.y + (event.clientY - active.clientY) * size.height / preview.height));
    setLayers((items) => items.map((layer) => layer.id === active.id ? { ...layer, x: snapValue(x), y: snapValue(y) } : layer));
  }

  function svgDocument() {
    const elements = layers.filter((layer) => layer.visible).map((layer) => {
      const transform = `translate(${layer.x} ${layer.y}) rotate(${layer.rotation})`;
      const style = contourOffset > 0 ? `stroke="${layer.color}" stroke-width="${Math.max(0.3, contourOffset / 2)}" paint-order="stroke"` : "";
      if (layer.kind === "image") return `<image href="${escapeXml(layer.url ?? "")}" x="${-layer.width / 2}" y="${-layer.height / 2}" width="${layer.width}" height="${layer.height}" transform="${transform}" preserveAspectRatio="xMidYMid meet"/>`;
      if (layer.kind === "text") return `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(layer.fontFamily ?? "Arial")}" font-size="${layer.height}" font-weight="${layer.fontWeight ?? 700}" fill="${layer.color}" ${style} transform="${transform}">${escapeXml(layer.content ?? "")}</text>`;
      if (layer.kind === "circle") return `<ellipse cx="0" cy="0" rx="${layer.width / 2}" ry="${layer.height / 2}" fill="${layer.color}" ${style} transform="${transform}"/>`;
      return `<rect x="${-layer.width / 2}" y="${-layer.height / 2}" width="${layer.width}" height="${layer.height}" fill="${layer.color}" ${style} transform="${transform}"/>`;
    }).join("\n");
    const marks = registrationMarks ? `<g fill="#000"><circle cx="8" cy="8" r="2"/><circle cx="${size.width - 8}" cy="8" r="2"/><circle cx="8" cy="${size.height - 8}" r="2"/><circle cx="${size.width - 8}" cy="${size.height - 8}" r="2"/></g>` : "";
    const box = weedBox ? `<rect x="3" y="3" width="${size.width - 6}" height="${size.height - 6}" fill="none" stroke="#111" stroke-width="0.3"/>` : "";
    const artwork = mirror ? `<g transform="translate(${size.width} 0) scale(-1 1)">${elements}${box}${marks}</g>` : `${elements}${box}${marks}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}mm" height="${size.height}mm" viewBox="0 0 ${size.width} ${size.height}"><title>${escapeXml(jobName)}</title>${artwork}</svg>`;
  }
  function projectCanvas() {
    return { version: 2, jobName, customer, material, sheet, customWidth, customHeight, copies, mirror, showGrid, snap, weedBox, registrationMarks, contourOffset, machineProfile, layers };
  }
  async function saveProject() {
    setSaveStatus("saving");
    setSaveMessage("Saving to this shop…");
    try {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: designJobId ?? undefined, title: jobName, customer: customer || undefined, machineProfile, canvas: projectCanvas() }),
      });
      const result = await response.json() as { design?: { id: string }; error?: string };
      if (!response.ok || !result.design) throw new Error(result.error ?? "Could not save this project.");
      setDesignJobId(result.design.id);
      setSaveStatus("saved");
      setSaveMessage("Saved to this shop");
      router.refresh();
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(error instanceof Error ? error.message : "Could not save this project.");
    }
  }
  function downloadBackup() {
    download(`${safeName(jobName)}.design.json`, JSON.stringify(projectCanvas(), null, 2), "application/json");
  }
  function applyProject(project: Record<string, unknown>, projectId: string | null = null) {
    if (!Array.isArray(project.layers)) throw new Error("This file has no design layers.");
    checkpoint(normalizedLayers(project.layers));
    if (typeof project.jobName === "string") setJobName(project.jobName);
    if (typeof project.customer === "string") setCustomer(project.customer);
    if (typeof project.material === "string" && project.material in materialDetails) setMaterial(project.material as Material);
    if (typeof project.sheet === "string" && (project.sheet === "custom" || project.sheet in sheets)) setSheet(project.sheet as Sheet);
    if (typeof project.customWidth === "number") setCustomWidth(project.customWidth);
    if (typeof project.customHeight === "number") setCustomHeight(project.customHeight);
    if (typeof project.copies === "number") setCopies(project.copies);
    if (typeof project.mirror === "boolean") setMirror(project.mirror);
    if (typeof project.showGrid === "boolean") setShowGrid(project.showGrid);
    if (typeof project.snap === "boolean") setSnap(project.snap);
    if (typeof project.weedBox === "boolean") setWeedBox(project.weedBox);
    if (typeof project.registrationMarks === "boolean") setRegistrationMarks(project.registrationMarks);
    if (typeof project.contourOffset === "number") setContourOffset(project.contourOffset);
    if (typeof project.machineProfile === "string" && ["Generic SVG", "SignMaster", "VinylMaster", "Print/RIP"].includes(project.machineProfile)) setMachineProfile(project.machineProfile as MachineProfile);
    setDesignJobId(projectId);
    setSelectedId(null);
    setSaveStatus(projectId ? "saved" : "idle");
    setSaveMessage(projectId ? "Saved project opened" : "Backup opened; save it to this shop");
  }
  async function loadProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const project = JSON.parse(await file.text()) as Record<string, unknown>;
      applyProject(project);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not open this design project.");
    }
    event.target.value = "";
  }
  function exportManifest() {
    download(`${safeName(jobName)}-production.json`, JSON.stringify({ jobName, customer: customer || null, createdAt: new Date().toISOString(), material, sheet: { preset: sheet, widthMm: size.width, heightMm: size.height }, output: { copies, mirror, weedBox, registrationMarks, contourOffsetMm: contourOffset }, layers: layers.map(({ url, ...layer }) => ({ ...layer, embeddedArtwork: Boolean(url) })), heatPressNote: materialDetails[material].instruction, machineProfile, device: { state: device, name: deviceName, baudRate } }, null, 2), "application/json");
  }
  function printDesign() {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      window.alert("Allow pop-ups for this site so the production print window can open.");
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>${escapeXml(jobName)}</title><style>@page{size:${size.width}mm ${size.height}mm;margin:0}html,body{margin:0;width:${size.width}mm;height:${size.height}mm}svg{display:block;width:100%;height:100%}</style></head><body>${svgDocument()}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 250);
  }
  async function connectDevice() {
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) {
      setDevice("unsupported");
      setDeviceName("Browser serial access unavailable");
      setDeviceMessage("Use current Chrome or Edge over HTTPS. System printing and production-file export still work.");
      return;
    }
    setDevice("selecting");
    setDeviceMessage("Choose the cutter or printer adapter. This checks that the browser can see the port; production commands remain in your machine software.");
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      const info = port.getInfo?.();
      const parts = [info?.usbVendorId ? `VID ${info.usbVendorId.toString(16).toUpperCase()}` : "Serial device", info?.usbProductId ? `PID ${info.usbProductId.toString(16).toUpperCase()}` : ""].filter(Boolean);
      setDevice("connected");
      setDeviceName(parts.join(" · "));
      setDeviceMessage(`Port detected at ${baudRate} baud. This is a connection check, not proof that a production job was sent. Export the prepared file to the selected machine software.`);
    } catch (error) {
      setDevice("error");
      setDeviceName("No device connected");
      setDeviceMessage(error instanceof Error && error.name !== "NotFoundError" ? error.message : "Device selection was cancelled.");
    }
  }
  async function disconnectDevice() {
    try { await portRef.current?.close(); } catch { /* The device may already be disconnected. */ }
    portRef.current = null;
    setDevice("not-configured");
    setDeviceName("No output device selected");
    setDeviceMessage("The serial port is closed. SVG export and system printing remain available.");
  }

  const deviceTone = device === "connected" ? "border-emerald-200 bg-emerald-50" : device === "unsupported" || device === "error" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50";
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300"><Scissors size={15} /> Professional production workspace</div><h2 className="mt-2 text-2xl font-semibold">Design on the transfer material—not on a jersey mockup.</h2><p className="mt-2 max-w-3xl text-sm text-slate-300">Layer artwork, text, and vector shapes; prepare cut marks and contour settings; then export or print through a verified output path.</p><p className={`mt-2 text-xs font-semibold ${saveStatus === "error" ? "text-red-300" : saveStatus === "saved" ? "text-emerald-300" : "text-slate-400"}`}>{saveMessage}</p></div>
          <div className="flex max-w-2xl flex-wrap justify-end gap-2"><Button variant="outline" onClick={undo} disabled={!past.length}><Undo2 size={16} /> Undo</Button><Button variant="outline" onClick={redo} disabled={!future.length}><Redo2 size={16} /> Redo</Button><Button variant="outline" onClick={saveProject} disabled={saveStatus === "saving"}><Save size={16} /> {saveStatus === "saving" ? "Saving…" : designJobId ? "Save changes" : "Save project"}</Button><Button variant="outline" onClick={downloadBackup}><Download size={16} /> Download backup</Button><Button variant="outline" onClick={() => projectInputRef.current?.click()}><Upload size={16} /> Open backup</Button><input ref={projectInputRef} className="hidden" type="file" accept="application/json,.json" onChange={loadProject} /></div>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[330px_minmax(500px,1fr)_350px]">
        <aside className="space-y-4">
          <section className="panel p-4"><h3 className="font-semibold">Job details</h3>{savedDesigns.length ? <label className="mt-3 block text-xs font-semibold text-slate-600">Open shop project<select className="field mt-1" value="" onChange={(event) => { const saved = savedDesigns.find((item) => item.id === event.target.value); if (saved) applyProject(saved.canvas, saved.id); }}><option value="">Select a saved project</option>{savedDesigns.map((design) => <option key={design.id} value={design.id}>{design.title}</option>)}</select></label> : null}<label className="mt-3 block text-xs font-semibold text-slate-600">Job name<input className="field mt-1" value={jobName} onChange={(event) => setJobName(event.target.value)} /></label><label className="mt-3 block text-xs font-semibold text-slate-600">Customer or team<input className="field mt-1" value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Links automatically on one exact customer match" /></label></section>

          <section className="panel p-4">
            <div className="flex items-center gap-2"><ImagePlus size={18} /><h3 className="font-semibold">Insert artwork</h3></div>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold hover:border-[var(--shop-primary)]"><ImagePlus size={18} /> Add pictures or SVGs<input className="hidden" type="file" accept="image/*,.svg" multiple onChange={uploadArtwork} /></label>
            {uploadMessage ? <p className="mt-2 text-xs font-medium text-slate-600">{uploadMessage}</p> : null}
            <div className="mt-3 flex gap-2"><input className="field min-w-0" value={newText} onChange={(event) => setNewText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addText(); }} placeholder="Name, number, text…" /><Button variant="outline" onClick={addText}><Type size={16} /></Button></div>
            <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => addShape("rectangle")}><Square size={16} /> Rectangle</Button><Button variant="outline" onClick={() => addShape("circle")}><Circle size={16} /> Circle</Button></div>
          </section>

          <section className="panel p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Layers3 size={18} /><h3 className="font-semibold">Layers</h3></div><span className="text-xs text-slate-500">{layers.length}</span></div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {[...layers].reverse().map((layer) => <div key={layer.id} className={`rounded-lg border p-2 ${selectedId === layer.id ? "border-[var(--shop-primary)] bg-emerald-50" : "border-[#ded8cd] bg-white"}`}><button type="button" className="block w-full truncate text-left text-sm font-semibold" onClick={() => setSelectedId(layer.id)}>{layer.name}</button><div className="mt-2 flex gap-1"><button type="button" aria-label="Toggle visibility" className="rounded p-1 hover:bg-slate-100" onClick={() => updateLayer(layer.id, { visible: !layer.visible })}>{layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button><button type="button" aria-label="Toggle lock" className="rounded p-1 hover:bg-slate-100" onClick={() => updateLayer(layer.id, { locked: !layer.locked })}>{layer.locked ? <Lock size={15} /> : <Unlock size={15} />}</button><button type="button" aria-label="Duplicate" className="rounded p-1 hover:bg-slate-100" onClick={() => duplicateLayer(layer)}><Copy size={15} /></button><button type="button" aria-label="Move up" className="rounded p-1 hover:bg-slate-100" onClick={() => moveLayer(layer.id, 1)}><ChevronUp size={15} /></button><button type="button" aria-label="Move down" className="rounded p-1 hover:bg-slate-100" onClick={() => moveLayer(layer.id, -1)}><ChevronDown size={15} /></button><button type="button" aria-label="Delete" className="ml-auto rounded p-1 text-red-600 hover:bg-red-50" onClick={() => { checkpoint(layers.filter((item) => item.id !== layer.id)); if (selectedId === layer.id) setSelectedId(null); }}><Trash2 size={15} /></button></div></div>)}
              {!layers.length ? <p className="rounded-lg bg-[#f6f4ef] p-4 text-sm text-slate-500">Add pictures, text, or shapes. Each item becomes an editable layer.</p> : null}
            </div>
          </section>
        </aside>

        <main className="panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8cd] bg-white px-4 py-3"><div><p className="text-sm font-semibold">Material workspace</p><p className="text-xs text-slate-500">{size.width} × {size.height} mm · {copies} cop{copies === 1 ? "y" : "ies"} · {mirror ? "mirrored output" : "normal output"}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setShowGrid(!showGrid)}><Grid3X3 size={16} /> {showGrid ? "Grid on" : "Grid off"}</Button><Button variant="outline" onClick={() => setSnap(!snap)}>{snap ? "Snap 5 mm" : "Free move"}</Button></div></div>
          <div className="flex min-h-[700px] items-center justify-center overflow-auto bg-slate-200 p-8" onPointerMove={drag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onPointerDown={() => setSelectedId(null)}>
            <div className="relative shrink-0 overflow-hidden border border-slate-500 bg-white shadow-2xl touch-none" style={{ width: preview.width, height: preview.height, backgroundImage: showGrid ? "linear-gradient(#dbe2ea 1px, transparent 1px), linear-gradient(90deg, #dbe2ea 1px, transparent 1px)" : undefined, backgroundSize: showGrid ? `${preview.width * 5 / size.width}px ${preview.height * 5 / size.height}px` : undefined, transform: mirror ? "scaleX(-1)" : undefined }}>
              {weedBox ? <div className="pointer-events-none absolute inset-[10px] border border-dashed border-slate-600" /> : null}
              {registrationMarks ? <>{[[8, 8], [92, 8], [8, 92], [92, 92]].map(([x, y]) => <div key={`${x}-${y}`} className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white" style={{ left: `${x}%`, top: `${y}%` }} />)}</> : null}
              {layers.map((layer) => layer.visible ? <div key={layer.id} role="button" tabIndex={0} onPointerDown={(event) => startDrag(event, layer)} className={`absolute flex cursor-move select-none items-center justify-center ${selectedId === layer.id ? "ring-2 ring-sky-500 ring-offset-2" : ""} ${layer.locked ? "cursor-not-allowed" : ""}`} style={{ left: `${layer.x / size.width * 100}%`, top: `${layer.y / size.height * 100}%`, width: `${layer.width / size.width * 100}%`, height: `${layer.height / size.height * 100}%`, transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`, color: layer.color, filter: contourOffset > 0 ? `drop-shadow(0 0 ${Math.max(1, contourOffset * preview.width / size.width)}px ${layer.color})` : undefined }}>
                {layer.kind === "image" && layer.url ? <Image unoptimized fill draggable={false} alt={layer.name} src={layer.url} className="pointer-events-none object-contain" /> : null}
                {layer.kind === "text" ? <span className="pointer-events-none whitespace-nowrap text-center font-bold leading-none" style={{ fontFamily: layer.fontFamily, fontWeight: layer.fontWeight, fontSize: `${Math.max(10, layer.height * preview.height / size.height)}px` }}>{layer.content}</span> : null}
                {layer.kind === "rectangle" ? <div className="pointer-events-none h-full w-full" style={{ backgroundColor: layer.color }} /> : null}
                {layer.kind === "circle" ? <div className="pointer-events-none h-full w-full rounded-full" style={{ backgroundColor: layer.color }} /> : null}
                {selectedId === layer.id ? <span className="pointer-events-none absolute -top-6 left-0 rounded bg-sky-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">{layer.width.toFixed(1)} × {layer.height.toFixed(1)} mm</span> : null}
              </div> : null)}
              {!layers.length ? <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400"><ImagePlus size={46} /><p className="mt-3 text-sm font-semibold">Insert artwork, text, or shapes</p><p className="mt-1 text-xs">No garment mockup—the sheet is the production surface</p></div> : null}
              <div className="absolute bottom-2 right-2 rounded bg-slate-950 px-2 py-1 text-[9px] font-semibold text-white" style={{ transform: mirror ? "scaleX(-1)" : undefined }}>{mirror ? "MIRRORED" : "NORMAL"}</div>
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          <section className="panel p-4">
            <h3 className="font-semibold">Selected layer</h3>
            {selected ? <div className="mt-3 space-y-2"><input className="field" value={selected.name} onChange={(event) => updateLayer(selected.id, { name: event.target.value })} aria-label="Layer name" />{selected.kind === "text" ? <><textarea className="field min-h-16" value={selected.content} onChange={(event) => updateLayer(selected.id, { content: event.target.value, name: event.target.value.slice(0, 24) || "Text" })} /><select className="field" value={selected.fontFamily} onChange={(event) => updateLayer(selected.id, { fontFamily: event.target.value })}><option>Arial</option><option>Impact</option><option>Georgia</option><option>Courier New</option><option>Times New Roman</option></select></> : null}<div className="grid grid-cols-2 gap-2"><NumberField label="X (mm)" value={selected.x} onChange={(x) => updateLayer(selected.id, { x: snapValue(x) })} /><NumberField label="Y (mm)" value={selected.y} onChange={(y) => updateLayer(selected.id, { y: snapValue(y) })} /><NumberField label="Width (mm)" value={selected.width} min={1} onChange={(width) => updateLayer(selected.id, { width })} /><NumberField label="Height (mm)" value={selected.height} min={1} onChange={(height) => updateLayer(selected.id, { height })} /></div><NumberField label="Rotation (degrees)" value={selected.rotation} onChange={(rotation) => updateLayer(selected.id, { rotation })} />{selected.kind !== "image" ? <label className="block text-xs font-semibold text-slate-600">Colour<input className="mt-1 h-10 w-full rounded border border-[#ded8cd]" type="color" value={selected.color} onChange={(event) => updateLayer(selected.id, { color: event.target.value })} /></label> : null}</div> : <p className="mt-3 rounded-lg bg-[#f6f4ef] p-3 text-sm text-slate-500">Select a layer on the sheet or in the layer list to set its exact position and size.</p>}
          </section>

          <section className="panel p-4"><h3 className="font-semibold">Material and cut setup</h3><label className="mt-3 block text-xs font-semibold text-slate-600">Material<select className="field mt-1" value={material} onChange={(event) => { const value = event.target.value as Material; setMaterial(value); setMirror(materialDetails[value].defaultMirror); }}>{Object.entries(materialDetails).map(([value, detail]) => <option key={value} value={value}>{detail.label}</option>)}</select></label><label className="mt-3 block text-xs font-semibold text-slate-600">Sheet or roll area<select className="field mt-1" value={sheet} onChange={(event) => setSheet(event.target.value as Sheet)}>{Object.entries(sheets).map(([value, detail]) => <option key={value} value={value}>{detail.label} · {detail.width}×{detail.height} mm</option>)}<option value="custom">Custom dimensions</option></select></label>{sheet === "custom" ? <div className="mt-2 grid grid-cols-2 gap-2"><NumberField label="Width mm" value={customWidth} min={50} onChange={setCustomWidth} /><NumberField label="Height mm" value={customHeight} min={50} onChange={setCustomHeight} /></div> : null}<div className="mt-2 grid grid-cols-2 gap-2"><NumberField label="Copies" value={copies} min={1} onChange={setCopies} /><NumberField label="Contour (mm)" value={contourOffset} min={0} step={0.1} onChange={setContourOffset} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Toggle label="Mirror output" checked={mirror} onChange={setMirror} /><Toggle label="Weed box" checked={weedBox} onChange={setWeedBox} /><Toggle label="Registration marks" checked={registrationMarks} onChange={setRegistrationMarks} /><Toggle label="Snap to grid" checked={snap} onChange={setSnap} /></div><div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">{materialDetails[material].instruction}</div></section>

          <section className={`rounded-lg border p-4 ${deviceTone}`}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Usb size={18} /><h3 className="font-semibold">Device readiness</h3></div>{device === "connected" ? <CheckCircle2 className="text-emerald-600" size={19} /> : <AlertTriangle className="text-amber-600" size={19} />}</div><p className="mt-2 text-sm font-semibold">{deviceName}</p><p className="mt-1 text-xs leading-5 text-slate-600">{deviceMessage}</p><label className="mt-3 block text-xs font-semibold text-slate-600">Serial speed<select className="field mt-1" value={baudRate} onChange={(event) => setBaudRate(Number(event.target.value))} disabled={device === "connected"}>{[9600, 19200, 38400, 57600, 115200].map((rate) => <option key={rate}>{rate}</option>)}</select></label>{device === "connected" ? <Button className="mt-3 w-full" variant="outline" onClick={disconnectDevice}>Close checked port</Button> : <Button className="mt-3 w-full" variant="outline" onClick={connectDevice} disabled={device === "selecting"}><Usb size={16} /> {device === "selecting" ? "Checking port…" : "Check USB / serial port"}</Button>}</section>

          <section className="panel p-4"><div className="flex items-center gap-2"><Download size={18} /><h3 className="font-semibold">Production output</h3></div><label className="mt-3 block text-xs font-semibold text-slate-600">Machine workflow<select className="field mt-1" value={machineProfile} onChange={(event) => setMachineProfile(event.target.value as MachineProfile)}><option>Generic SVG</option><option>SignMaster</option><option>VinylMaster</option><option>Print/RIP</option></select></label><div className="mt-3 grid gap-2"><Button onClick={() => download(`${safeName(jobName)}.svg`, svgDocument(), "image/svg+xml")}><Scissors size={16} /> Export for {machineProfile}</Button><Button variant="secondary" onClick={printDesign}><Printer size={16} /> Print through this computer</Button><Button variant="outline" onClick={exportManifest}><MonitorCog size={16} /> Export job manifest</Button></div><p className="mt-3 text-[11px] leading-4 text-slate-500">Printing opens only the production sheet at its real millimetre size and uses the printer installed on this computer. SVG carries the prepared artwork into SignMaster, VinylMaster, RIP, or cutter software; the browser does not claim a job was sent directly.</p></section>
        </aside>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, min, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; step?: number }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}<input className="field mt-1" type="number" value={Number.isFinite(value) ? value : 0} min={min} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-lg border border-[#ded8cd] bg-white p-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
