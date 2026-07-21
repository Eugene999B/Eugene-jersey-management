"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileImage,
  ImagePlus,
  MonitorCog,
  Printer,
  RotateCcw,
  Scissors,
  Settings2,
  Type,
  Usb,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";

type Material = "htv" | "printable-htv" | "sublimation" | "dtf" | "flock";
type Sheet = "a4" | "a3" | "12x20" | "15x20" | "custom";
type DeviceState = "not-configured" | "unsupported" | "selecting" | "connected" | "error";

type Artwork = {
  name: string;
  url: string;
  width: number;
  height: number;
};

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};

type NavigatorWithSerial = Navigator & {
  serial?: { requestPort(): Promise<SerialPortLike> };
};

const sheets: Record<Exclude<Sheet, "custom">, { label: string; width: number; height: number }> = {
  a4: { label: "A4", width: 210, height: 297 },
  a3: { label: "A3", width: 297, height: 420 },
  "12x20": { label: '12 × 20 in', width: 305, height: 508 },
  "15x20": { label: '15 × 20 in', width: 381, height: 508 },
};

const materialDetails: Record<Material, { label: string; instruction: string; defaultMirror: boolean }> = {
  htv: { label: "Heat-transfer vinyl (HTV)", instruction: "Mirror before cutting. Weed, cover, then press to the vinyl maker's specification.", defaultMirror: true },
  "printable-htv": { label: "Printable HTV", instruction: "Print on the printable face, contour-cut, mask if required, then heat apply.", defaultMirror: false },
  sublimation: { label: "Sublimation paper", instruction: "Mirror before printing. Use suitable polyester material and the ink/paper profile.", defaultMirror: true },
  dtf: { label: "DTF transfer film", instruction: "Print using the RIP workflow, powder and cure, then heat apply.", defaultMirror: false },
  flock: { label: "Flock vinyl", instruction: "Mirror before cutting. Weed carefully and follow the material temperature and peel instructions.", defaultMirror: true },
};

function download(name: string, content: string, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function safeName(value: string) {
  return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "transfer-job";
}

export function ProductionStudio() {
  const [jobName, setJobName] = useState("New transfer job");
  const [customer, setCustomer] = useState("");
  const [material, setMaterial] = useState<Material>("htv");
  const [sheet, setSheet] = useState<Sheet>("a3");
  const [customWidth, setCustomWidth] = useState(300);
  const [customHeight, setCustomHeight] = useState(500);
  const [copies, setCopies] = useState(1);
  const [mirror, setMirror] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [artworkScale, setArtworkScale] = useState(58);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(46);
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [device, setDevice] = useState<DeviceState>("not-configured");
  const [deviceName, setDeviceName] = useState("No output device selected");
  const [deviceMessage, setDeviceMessage] = useState("Downloads are available. Direct sending needs a supported cutter and its exact command profile.");
  const portRef = useRef<SerialPortLike | null>(null);

  const size = sheet === "custom" ? { label: "Custom", width: customWidth, height: customHeight } : sheets[sheet];
  const preview = useMemo(() => {
    const ratio = size.height / Math.max(size.width, 1);
    const width = ratio > 1.45 ? 360 : 430;
    return { width, height: Math.min(610, Math.max(360, width * ratio)) };
  }, [size.height, size.width]);

  function changeMaterial(value: Material) {
    setMaterial(value);
    setMirror(materialDetails[value].defaultMirror);
  }

  async function uploadArtwork(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.name.toLowerCase().endsWith(".svg")) return;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("Could not read artwork."));
      reader.readAsDataURL(file);
    });
    const image = new window.Image();
    image.onload = () => setArtwork({ name: file.name, url, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => setArtwork({ name: file.name, url, width: 1, height: 1 });
    image.src = url;
  }

  function svgDocument() {
    const width = Math.max(50, size.width);
    const height = Math.max(50, size.height);
    const imageWidth = width * (artworkScale / 100);
    const imageHeight = artwork ? imageWidth * (artwork.height / Math.max(artwork.width, 1)) : 0;
    const x = width / 2 + offsetX;
    const y = height / 2 + offsetY;
    const transform = `translate(${x} ${y}) rotate(${rotation}) scale(${mirror ? -1 : 1} 1)`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">
  <title>${jobName.replace(/[<>&]/g, "")}</title>
  <rect width="100%" height="100%" fill="white"/>
  <g transform="${transform}">
    ${artwork ? `<image href="${artwork.url}" x="${-imageWidth / 2}" y="${-imageHeight / 2}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>` : ""}
    ${text ? `<text x="0" y="${artwork ? imageHeight / 2 + fontSize / 3 : 0}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize / 3.78}" font-weight="700">${text.replace(/[<>&]/g, "")}</text>` : ""}
  </g>
</svg>`;
  }

  function exportManifest() {
    const manifest = {
      jobName,
      customer: customer || null,
      createdAt: new Date().toISOString(),
      workflow: "transfer-material-production",
      material,
      sheet: { preset: sheet, widthMm: size.width, heightMm: size.height },
      output: { copies, mirror, rotationDegrees: rotation },
      artwork: artwork ? { fileName: artwork.name, sourcePixels: [artwork.width, artwork.height], scalePercent: artworkScale, offsetMm: [offsetX, offsetY] } : null,
      text: text ? { value: text, fontSize } : null,
      heatPressNote: materialDetails[material].instruction,
      device: { state: device, name: deviceName, directSendAttempted: device !== "not-configured" },
    };
    download(`${safeName(jobName)}-production.json`, JSON.stringify(manifest, null, 2), "application/json");
  }

  async function connectDevice() {
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) {
      setDevice("unsupported");
      setDeviceName("Browser serial access unavailable");
      setDeviceMessage("Use current Chrome or Edge over HTTPS for Web Serial, or install a future local machine bridge. Printing remains available through the operating-system print dialog.");
      return;
    }
    setDevice("selecting");
    setDeviceMessage("Choose the exact cutter connection. Nothing will be sent during this check.");
    try {
      const port = await serial.requestPort();
      portRef.current = port;
      const info = port.getInfo?.();
      const id = info?.usbVendorId ? `VID ${info.usbVendorId.toString(16).toUpperCase()}` : "Serial device";
      setDevice("connected");
      setDeviceName(id);
      setDeviceMessage("Port permission granted. Command sending is intentionally disabled until this device's model, language, baud rate, origin point, and safe test procedure are configured.");
    } catch (error) {
      setDevice("error");
      setDeviceName("No device connected");
      setDeviceMessage(error instanceof Error && error.name !== "NotFoundError" ? error.message : "Device selection was cancelled.");
    }
  }

  const deviceTone = device === "connected" ? "border-emerald-200 bg-emerald-50" : device === "unsupported" || device === "error" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50";

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300"><Scissors size={15} /> Production workspace</div>
            <h2 className="mt-2 text-2xl font-semibold">Prepare the transfer. Apply it to the garment later.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Build artwork on the actual vinyl, film, paper, or transfer-sheet dimensions. The garment is intentionally not part of this workspace.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
            {["1 Artwork", "2 Material", "3 Output", "4 Heat press"].map((item, index) => <div key={item} className={`rounded-lg px-3 py-2 ${index === 0 ? "bg-emerald-400 text-slate-950" : "bg-white/10 text-slate-200"}`}>{item}</div>)}
          </div>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-[320px_minmax(480px,1fr)_340px]">
        <aside className="space-y-4">
          <section className="panel p-4">
            <div className="flex items-center gap-2"><FileImage size={18} /><h3 className="font-semibold">Job details</h3></div>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Job name<input className="field mt-1" value={jobName} onChange={(event) => setJobName(event.target.value)} /></label>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Customer / team<input className="field mt-1" value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Optional" /></label>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2"><ImagePlus size={18} /><h3 className="font-semibold">Artwork</h3></div>
            <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold hover:border-[var(--shop-primary)]"><ImagePlus size={18} /> Insert picture or SVG<input className="hidden" type="file" accept="image/*,.svg" onChange={uploadArtwork} /></label>
            <p className="mt-2 truncate text-xs text-slate-500">{artwork ? `${artwork.name} · ${artwork.width}×${artwork.height}px` : "PNG, JPG, WebP, or SVG"}</p>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Scale · {artworkScale}%<input className="mt-2 w-full" type="range" min="10" max="100" value={artworkScale} onChange={(event) => setArtworkScale(Number(event.target.value))} /></label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-600">X offset (mm)<input className="field mt-1" type="number" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} /></label>
              <label className="text-xs font-semibold text-slate-600">Y offset (mm)<input className="field mt-1" type="number" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} /></label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Rotation<input className="field mt-1" type="number" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} /></label>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2"><Type size={18} /><h3 className="font-semibold">Simple text</h3></div>
            <input className="field mt-4" value={text} onChange={(event) => setText(event.target.value)} placeholder="Name, number, label…" />
            <label className="mt-3 block text-xs font-semibold text-slate-600">Text size<input className="field mt-1" type="number" min="8" max="240" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
          </section>
        </aside>

        <main className="panel min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ded8cd] bg-white px-4 py-3">
            <div><p className="text-sm font-semibold">Transfer-sheet preview</p><p className="text-xs text-slate-500">{size.width} × {size.height} mm · {copies} cop{copies === 1 ? "y" : "ies"} · {mirror ? "mirrored" : "normal"}</p></div>
            <Button variant="outline" onClick={() => { setOffsetX(0); setOffsetY(0); setRotation(0); setArtworkScale(58); }}><RotateCcw size={16} /> Reset layout</Button>
          </div>
          <div className="flex min-h-[660px] items-center justify-center overflow-auto bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-8">
            <div className="relative shrink-0 overflow-hidden border border-slate-400 bg-white shadow-2xl" style={{ width: preview.width, height: preview.height }}>
              <div className="absolute inset-3 border border-dashed border-slate-300" />
              <div className="absolute left-3 top-1 text-[9px] font-semibold text-slate-400">{size.width} mm</div>
              <div className="absolute left-1 top-1/2 -rotate-90 text-[9px] font-semibold text-slate-400">{size.height} mm</div>
              <div className="absolute left-1/2 top-1/2 flex max-w-[90%] flex-col items-center" style={{ transform: `translate(calc(-50% + ${offsetX * 0.7}px), calc(-50% + ${offsetY * 0.7}px)) rotate(${rotation}deg) scaleX(${mirror ? -1 : 1})`, width: `${artworkScale}%` }}>
                {artwork ? <Image unoptimized alt="Uploaded transfer artwork" className="max-h-[420px] h-auto w-full object-contain" src={artwork.url} width={Math.max(1, artwork.width)} height={Math.max(1, artwork.height)} /> : <div className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-slate-400"><ImagePlus size={42} /><p className="mt-3 text-sm font-semibold">Insert artwork</p><p className="mt-1 text-xs">Your transfer begins here</p></div>}
                {text ? <div className="mt-3 max-w-full truncate text-center font-black leading-none text-slate-950" style={{ fontSize: Math.max(12, fontSize * 0.55) }}>{text}</div> : null}
              </div>
              <div className="absolute bottom-2 right-3 rounded bg-slate-950 px-2 py-1 text-[9px] font-semibold text-white">{mirror ? "MIRRORED OUTPUT" : "NORMAL OUTPUT"}</div>
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          <section className="panel p-4">
            <div className="flex items-center gap-2"><Settings2 size={18} /><h3 className="font-semibold">Material and sheet</h3></div>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Production material<select className="field mt-1" value={material} onChange={(event) => changeMaterial(event.target.value as Material)}>{Object.entries(materialDetails).map(([value, detail]) => <option key={value} value={value}>{detail.label}</option>)}</select></label>
            <label className="mt-3 block text-xs font-semibold text-slate-600">Sheet / roll area<select className="field mt-1" value={sheet} onChange={(event) => setSheet(event.target.value as Sheet)}>{Object.entries(sheets).map(([value, detail]) => <option key={value} value={value}>{detail.label} · {detail.width}×{detail.height} mm</option>)}<option value="custom">Custom dimensions</option></select></label>
            {sheet === "custom" ? <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-600">Width mm<input className="field mt-1" type="number" min="50" value={customWidth} onChange={(event) => setCustomWidth(Number(event.target.value))} /></label><label className="text-xs font-semibold text-slate-600">Height mm<input className="field mt-1" type="number" min="50" value={customHeight} onChange={(event) => setCustomHeight(Number(event.target.value))} /></label></div> : null}
            <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-slate-600">Copies<input className="field mt-1" type="number" min="1" max="100" value={copies} onChange={(event) => setCopies(Number(event.target.value))} /></label><label className="text-xs font-semibold text-slate-600">Orientation<select className="field mt-1" value={mirror ? "mirror" : "normal"} onChange={(event) => setMirror(event.target.value === "mirror")}><option value="mirror">Mirror</option><option value="normal">Normal</option></select></label></div>
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">{materialDetails[material].instruction}</div>
          </section>

          <section className={`rounded-lg border p-4 ${deviceTone}`}>
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Usb size={18} /><h3 className="font-semibold">Output device</h3></div>{device === "connected" ? <CheckCircle2 className="text-emerald-600" size={19} /> : <AlertTriangle className="text-amber-600" size={19} />}</div>
            <p className="mt-3 text-sm font-semibold">{deviceName}</p><p className="mt-2 text-xs leading-5 text-slate-600">{deviceMessage}</p>
            <Button className="mt-4 w-full" variant="outline" onClick={connectDevice} disabled={device === "selecting"}><Usb size={16} /> {device === "selecting" ? "Waiting for selection…" : "Check USB / serial device"}</Button>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">A browser port permission is not proof that a cutter is ready. The app will not send unknown commands to production hardware.</p>
          </section>

          <section className="panel p-4">
            <div className="flex items-center gap-2"><Download size={18} /><h3 className="font-semibold">Production output</h3></div>
            <div className="mt-4 grid gap-2">
              <Button onClick={() => download(`${safeName(jobName)}.svg`, svgDocument(), "image/svg+xml")}><Scissors size={16} /> Download production SVG</Button>
              <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Open system print dialog</Button>
              <Button variant="outline" onClick={exportManifest}><MonitorCog size={16} /> Download job manifest</Button>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">SVG is for artwork transfer to SignMaster, VinylMaster, RIP, or cutter software. The print dialog uses the printer installed on this computer.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
