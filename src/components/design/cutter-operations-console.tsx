"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, CircleOff, RefreshCw, Scissors, Send, Unplug, Usb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildCutHpgl, buildDesignCutPaths, type CutPathLayer } from "@/lib/design-cut-path";
import {
  compareDetectedHardware,
  configuredSerialFilters,
  formatUsbId,
} from "@/lib/design-device-readiness";
import {
  CUTTER_CHECKLIST_ITEMS,
  EMPTY_CUTTER_CHECKLIST,
  cutterChecklistComplete,
  directCutterIdentity,
  machineProductionAreaError,
  type CutterChecklist,
} from "@/lib/design-machine-operations";
import type { DesignMachineProfile } from "@/lib/design-machine-profile";
import { outlineDesignTextLayers } from "@/lib/design-text-outline";
import { titleCase } from "@/lib/format";
import type { MachineJobStatus } from "@/lib/design-machine-operations";

type SavedDesign = {
  id: string;
  title: string;
  updatedAt: string;
  canvas: Record<string, unknown>;
};

type QueueJob = {
  id: string;
  designJobId: string;
  designTitle: string;
  machineProfileId: string;
  machineName: string;
  manufacturer: string | null;
  model: string | null;
  createdByName: string;
  jobName: string;
  material: string;
  materialWidthMm: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
  mirror: boolean;
  origin: string;
  payloadHash: string;
  pathCount: number;
  byteLength: number;
  status: MachineJobStatus;
  attemptCount: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
};

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  getInfo?: () => { usbVendorId?: number; usbProductId?: number };
};

type NavigatorWithSerial = Navigator & {
  serial?: {
    requestPort(options?: { filters?: Array<{ usbVendorId: number; usbProductId?: number }> }): Promise<SerialPortLike>;
  };
};

type DesignLayer = CutPathLayer & {
  content?: string;
  url?: string;
  fontFamily?: string;
  fontWeight?: number;
};

type PreparedOutput = {
  payload: string;
  pathCount: number;
  warnings: string[];
};

const sheets: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  "12x20": { width: 305, height: 508 },
  "15x20": { width: 381, height: 508 },
};

function finite(value: unknown, fallback: number, min = -100_000, max = 100_000) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function designLayers(canvas: Record<string, unknown>): DesignLayer[] {
  const allowed = new Set(["image", "text", "rectangle", "circle"]);
  if (!Array.isArray(canvas.layers)) return [];
  return canvas.layers.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const layer = entry as Record<string, unknown>;
    if (!allowed.has(String(layer.kind))) return [];
    return [{
      id: stringValue(layer.id, crypto.randomUUID()),
      kind: layer.kind as DesignLayer["kind"],
      name: stringValue(layer.name, "Layer").slice(0, 120),
      visible: booleanValue(layer.visible, true),
      locked: booleanValue(layer.locked, false),
      x: finite(layer.x, 0),
      y: finite(layer.y, 0),
      width: finite(layer.width, 20, 1),
      height: finite(layer.height, 20, 1),
      rotation: finite(layer.rotation, 0, -3600, 3600),
      color: /^#[0-9a-f]{6}$/i.test(stringValue(layer.color)) ? stringValue(layer.color) : "#111827",
      content: stringValue(layer.content).slice(0, 500) || undefined,
      url: stringValue(layer.url).slice(0, 1_500_000) || undefined,
      fontFamily: stringValue(layer.fontFamily, "Arial").slice(0, 80),
      fontWeight: Math.round(finite(layer.fontWeight, 700, 100, 900)),
    }];
  });
}

function productionSize(canvas: Record<string, unknown>) {
  const sheet = stringValue(canvas.sheet, "a3");
  if (sheet === "custom") {
    return {
      width: finite(canvas.customWidth, 300, 20, 2_000),
      height: finite(canvas.customHeight, 500, 20, 5_000),
    };
  }
  return sheets[sheet] ?? sheets.a3;
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: MachineJobStatus): "green" | "red" | "orange" | "blue" | "slate" {
  if (status === "SENT") return "green";
  if (status === "FAILED") return "red";
  if (status === "SENDING") return "orange";
  if (status === "CANCELLED") return "slate";
  return "blue";
}

export function CutterOperationsConsole({
  designs,
  machineProfiles,
  initialJobs,
}: {
  designs: SavedDesign[];
  machineProfiles: DesignMachineProfile[];
  initialJobs: QueueJob[];
}) {
  const directProfiles = useMemo(
    () => machineProfiles.filter((profile) => profile.isActive && profile.outputFormat === "HPGL" && profile.connectionMode === "WEB_SERIAL"),
    [machineProfiles],
  );
  const [selectedDesignId, setSelectedDesignId] = useState(designs[0]?.id ?? "");
  const selectedDesign = designs.find((design) => design.id === selectedDesignId) ?? designs[0] ?? null;
  const savedProfileId = selectedDesign ? stringValue(selectedDesign.canvas.machineProfileId) : "";
  const initialProfile = directProfiles.find((profile) => profile.id === savedProfileId)
    ?? directProfiles.find((profile) => profile.isDefault)
    ?? directProfiles[0]
    ?? null;
  const [machineProfileId, setMachineProfileId] = useState(initialProfile?.id ?? "");
  const machineProfile = directProfiles.find((profile) => profile.id === machineProfileId) ?? directProfiles[0] ?? null;
  const size = selectedDesign ? productionSize(selectedDesign.canvas) : { width: 0, height: 0 };
  const [material, setMaterial] = useState(selectedDesign ? stringValue(selectedDesign.canvas.material, "htv") : "htv");
  const [materialWidthMm, setMaterialWidthMm] = useState(initialProfile ? Math.max(size.width, Math.min(initialProfile.bedWidthMm, 610)) : size.width);
  const [mirror, setMirror] = useState(selectedDesign ? booleanValue(selectedDesign.canvas.mirror, true) : true);
  const [checklist, setChecklist] = useState<CutterChecklist>(EMPTY_CUTTER_CHECKLIST);
  const [jobs, setJobs] = useState(initialJobs);
  const [deviceState, setDeviceState] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [deviceMessage, setDeviceMessage] = useState("Connect the configured cutter only after loading material and setting the machine origin.");
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [duplicateJobId, setDuplicateJobId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const portRef = useRef<SerialPortLike | null>(null);

  useEffect(() => {
    return () => {
      void portRef.current?.close().catch(() => undefined);
      portRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedDesign) return;
    const requestedProfileId = stringValue(selectedDesign.canvas.machineProfileId);
    const nextProfile = directProfiles.find((profile) => profile.id === requestedProfileId)
      ?? directProfiles.find((profile) => profile.isDefault)
      ?? directProfiles[0];
    if (nextProfile) {
      setMachineProfileId(nextProfile.id);
      setMaterialWidthMm(Math.max(productionSize(selectedDesign.canvas).width, Math.min(nextProfile.bedWidthMm, 610)));
    }
    setMaterial(stringValue(selectedDesign.canvas.material, "htv"));
    setMirror(booleanValue(selectedDesign.canvas.mirror, true));
    setChecklist(EMPTY_CUTTER_CHECKLIST);
    setDuplicateJobId(null);
  }, [directProfiles, selectedDesign]);

  const areaError = machineProfile
    ? machineProductionAreaError({ profile: machineProfile, materialWidthMm, sheet: size })
    : "Create an active direct-serial HPGL machine profile before producing cutter jobs.";
  const checklistReady = cutterChecklistComplete(checklist);
  const canPrepare = Boolean(selectedDesign && machineProfile && !areaError && checklistReady);

  async function refreshJobs() {
    const response = await fetch("/api/design-machine-jobs", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Could not refresh the cutter queue.");
    setJobs(payload.jobs);
  }

  async function connectCutter() {
    if (!machineProfile) return;
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) {
      setDeviceState("error");
      setDeviceMessage("Direct serial cutting requires current Chrome or Edge on a computer with the cutter connected by USB or serial adapter.");
      return;
    }
    setDeviceState("connecting");
    setDeviceMessage("Choose the exact cutter port shown by the browser.");
    try {
      const port = await serial.requestPort({ filters: configuredSerialFilters(machineProfile) });
      await port.open({ baudRate: machineProfile.baudRate });
      const detected = port.getInfo?.() ?? null;
      const comparison = compareDetectedHardware(machineProfile, detected);
      if (!comparison.matches) {
        await port.close().catch(() => undefined);
        throw new Error(comparison.message);
      }
      await portRef.current?.close().catch(() => undefined);
      portRef.current = port;
      setDeviceState("connected");
      const identity = directCutterIdentity(machineProfile);
      const detectedText = detected?.usbVendorId
        ? ` USB ${formatUsbId(detected.usbVendorId)}${detected.usbProductId ? `:${formatUsbId(detected.usbProductId)}` : ""}.`
        : "";
      setDeviceMessage(`${identity} connected at ${machineProfile.baudRate} baud.${detectedText}`);
    } catch (error) {
      portRef.current = null;
      setDeviceState("error");
      setDeviceMessage(error instanceof Error && error.name !== "NotFoundError" ? error.message : "Cutter selection was cancelled.");
    }
  }

  async function disconnectCutter() {
    await portRef.current?.close().catch(() => undefined);
    portRef.current = null;
    setDeviceState("disconnected");
    setDeviceMessage("Cutter disconnected. Reconnect and confirm the material setup before another send.");
  }

  async function buildPreparedOutput(): Promise<PreparedOutput> {
    if (!selectedDesign || !machineProfile) throw new Error("Choose a saved design and direct HPGL cutter.");
    const layers = designLayers(selectedDesign.canvas);
    const base = buildDesignCutPaths({
      layers,
      sheet: size,
      weedBox: booleanValue(selectedDesign.canvas.weedBox, true),
      registrationMarks: booleanValue(selectedDesign.canvas.registrationMarks, false),
    });
    const outlined = await outlineDesignTextLayers(layers);
    const errors = [...base.errors, ...outlined.errors];
    const outsideText = outlined.paths.filter((path) => path.points.some((point) => point.x < -0.01 || point.y < -0.01 || point.x > size.width + 0.01 || point.y > size.height + 0.01));
    if (outsideText.length) errors.push(`${outsideText.length} outlined text path${outsideText.length === 1 ? " is" : "s are"} outside the saved production area.`);
    if (errors.length) throw new Error([...new Set(errors)].join(" "));
    const paths = [...base.paths, ...outlined.paths];
    if (!paths.length) throw new Error("This saved design has no usable cutter paths.");
    return {
      payload: buildCutHpgl({
        paths,
        sheet: size,
        mirror,
        origin: machineProfile.origin,
        unitsPerMm: machineProfile.unitsPerMm,
      }),
      pathCount: paths.length,
      warnings: [...new Set([...base.warnings, ...outlined.warnings])],
    };
  }

  function prepareJob(allowDuplicate = false) {
    if (!canPrepare || !selectedDesign || !machineProfile) return;
    setMessage({ tone: "info", text: "Validating the saved artwork and preparing cutter paths…" });
    setDuplicateJobId(null);
    startTransition(async () => {
      try {
        const output = await buildPreparedOutput();
        const response = await fetch("/api/design-machine-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designJobId: selectedDesign.id,
            machineProfileId: machineProfile.id,
            jobName: selectedDesign.title,
            material,
            materialWidthMm,
            sheetWidthMm: size.width,
            sheetHeightMm: size.height,
            mirror,
            origin: machineProfile.origin,
            copies: 1,
            payload: output.payload,
            pathCount: output.pathCount,
            checklist,
            warnings: output.warnings,
            allowDuplicate,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          if (payload.code === "MACHINE_JOB_DUPLICATE") setDuplicateJobId(payload.existingJobId ?? "unknown");
          throw new Error(payload.error ?? "Could not prepare the cutter job.");
        }
        setJobs((current) => [payload.job, ...current.filter((job) => job.id !== payload.job.id)]);
        setMessage({ tone: "success", text: `${selectedDesign.title} is prepared. Review the queue record, then send it once to the connected cutter.` });
      } catch (error) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not prepare the cutter job." });
      }
    });
  }

  async function postResult(jobId: string, success: boolean, deviceInfo: Record<string, unknown>, error?: string) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`/api/design-machine-jobs/${jobId}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success, deviceInfo, error: error ?? null }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not record the cutter result.");
        return payload.job as QueueJob;
      } catch (caught) {
        lastError = caught instanceof Error ? caught : new Error("Could not record the cutter result.");
        await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
      }
    }
    throw lastError ?? new Error("Could not record the cutter result.");
  }

  function sendJob(job: QueueJob) {
    if (!machineProfile || job.machineProfileId !== machineProfile.id) {
      setMessage({ tone: "error", text: "Select and connect the same machine profile recorded on this queue job before sending." });
      return;
    }
    const port = portRef.current;
    const writable = port?.writable;
    if (deviceState !== "connected" || !writable) {
      setMessage({ tone: "error", text: "Connect the configured cutter before sending this queue job." });
      return;
    }
    if (!window.confirm(`Send ${job.jobName} to ${directCutterIdentity(machineProfile)} now? Once serial bytes reach the cutter, the browser cannot recall blade movement.`)) return;

    setMessage({ tone: "info", text: `Claiming ${job.jobName} for one controlled send…` });
    startTransition(async () => {
      let claimed = false;
      const detected = port.getInfo?.() ?? {};
      const deviceInfo = {
        usbVendorId: detected.usbVendorId ?? null,
        usbProductId: detected.usbProductId ?? null,
        baudRate: machineProfile.baudRate,
        machineProfileId: machineProfile.id,
        machineName: directCutterIdentity(machineProfile),
        browser: navigator.userAgent.slice(0, 300),
      };
      try {
        const claimResponse = await fetch(`/api/design-machine-jobs/${job.id}/claim`, { method: "POST" });
        const claimPayload = await claimResponse.json();
        if (!claimResponse.ok) throw new Error(claimPayload.error ?? "Could not claim the cutter job.");
        claimed = true;
        const claimedJob = claimPayload.job as QueueJob & { payload: string; baudRate: number; usbVendorId: number | null; usbProductId: number | null };
        if (claimedJob.machineProfileId !== machineProfile.id || claimedJob.baudRate !== machineProfile.baudRate) {
          throw new Error("The claimed job no longer matches the connected machine profile.");
        }
        const hardware = compareDetectedHardware({ usbVendorId: claimedJob.usbVendorId, usbProductId: claimedJob.usbProductId }, detected);
        if (!hardware.matches) throw new Error(hardware.message);

        const writer = writable.getWriter();
        try {
          await writer.write(new TextEncoder().encode(claimedJob.payload));
        } finally {
          writer.releaseLock();
        }
        const completed = await postResult(job.id, true, deviceInfo);
        setJobs((current) => current.map((entry) => entry.id === completed.id ? completed : entry));
        setMessage({ tone: "success", text: `${job.jobName} was written to the cutter once. Stay with the machine and verify the first movement and material feed.` });
      } catch (error) {
        const text = error instanceof Error ? error.message : "The cutter did not accept the job.";
        if (claimed) {
          try {
            const failed = await postResult(job.id, false, deviceInfo, text);
            setJobs((current) => current.map((entry) => entry.id === failed.id ? failed : entry));
          } catch {
            setMessage({ tone: "error", text: `${text} The send outcome could not be recorded. Do not resend until the operator inspects the cutter and resolves the SENDING queue record.` });
            return;
          }
        }
        setMessage({ tone: "error", text });
      }
    });
  }

  function resolveSending(job: QueueJob, success: boolean) {
    const statement = success
      ? "Confirm this job physically reached the cutter and should be recorded as sent?"
      : "Confirm no production cut should be accepted for this attempt? Inspect the machine and material before marking it failed.";
    if (!window.confirm(statement)) return;
    startTransition(async () => {
      try {
        const resolved = await postResult(job.id, success, { manualResolution: true, resolvedAt: new Date().toISOString() }, success ? undefined : "Operator marked the uncertain send as failed after physical inspection.");
        setJobs((current) => current.map((entry) => entry.id === resolved.id ? resolved : entry));
        setMessage({ tone: "success", text: `${job.jobName} was resolved as ${success ? "sent" : "failed"}.` });
      } catch (error) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not resolve the cutter job." });
      }
    });
  }

  function cancelJob(job: QueueJob) {
    if (!window.confirm(`Cancel the unsent queue record for ${job.jobName}?`)) return;
    startTransition(async () => {
      const response = await fetch(`/api/design-machine-jobs/${job.id}/cancel`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Could not cancel the cutter job." });
        return;
      }
      await refreshJobs();
      setMessage({ tone: "success", text: `${job.jobName} was cancelled before sending.` });
    });
  }

  return (
    <div className="space-y-5">
      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm font-semibold ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-900"}`}>{message.text}</p> : null}

      <section className="panel p-4 sm:p-5" aria-labelledby="production-source-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="production-source-heading" className="text-lg font-bold">1. Choose saved artwork and cutter</h2><p className="mt-1 text-sm text-slate-600">Only a saved shop design can enter the durable machine queue.</p></div>
          <Badge tone="blue"><Scissors size={14} /> Direct HPGL</Badge>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Saved design
            <select className="field mt-1" value={selectedDesignId} onChange={(event) => setSelectedDesignId(event.target.value)}>
              {designs.map((design) => <option key={design.id} value={design.id}>{design.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Direct cutter profile
            <select className="field mt-1" value={machineProfileId} onChange={(event) => { setMachineProfileId(event.target.value); setChecklist(EMPTY_CUTTER_CHECKLIST); }}>
              {directProfiles.map((profile) => <option key={profile.id} value={profile.id}>{directCutterIdentity(profile)} — {profile.bedWidthMm} × {profile.bedHeightMm} mm</option>)}
            </select>
          </label>
        </div>
        {!designs.length ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Save a Design Studio project before opening machine operations.</p> : null}
        {!directProfiles.length ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Create an HPGL profile using Direct browser serial connection, including the cutter baud rate and USB IDs when known.</p> : null}
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="material-heading">
        <h2 id="material-heading" className="text-lg font-bold">2. Load material and verify the physical setup</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">Material
            <select className="field mt-1" value={material} onChange={(event) => { setMaterial(event.target.value); setChecklist((current) => ({ ...current, materialLoaded: false, bladeChecked: false, testCutPassed: false })); }}>
              <option value="htv">Heat-transfer vinyl (HTV)</option><option value="flock">Flock vinyl</option><option value="adhesive-vinyl">Adhesive vinyl</option><option value="other-vinyl">Other cutter material</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Loaded roll/sheet width (mm)
            <input className="field mt-1" type="number" min="20" max="2000" step="1" value={materialWidthMm} onChange={(event) => { setMaterialWidthMm(Number(event.target.value)); setChecklist((current) => ({ ...current, materialLoaded: false, testCutPassed: false })); }} />
          </label>
          <label className="text-sm font-semibold text-slate-700">Output orientation
            <select className="field mt-1" value={mirror ? "mirrored" : "normal"} onChange={(event) => { setMirror(event.target.value === "mirrored"); setChecklist((current) => ({ ...current, testCutPassed: false })); }}><option value="mirrored">Mirrored</option><option value="normal">Normal</option></select>
          </label>
        </div>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="rounded-xl bg-slate-100 p-3"><strong>Saved area</strong><br />{size.width} × {size.height} mm</p>
          <p className="rounded-xl bg-slate-100 p-3"><strong>Machine bed</strong><br />{machineProfile ? `${machineProfile.bedWidthMm} × ${machineProfile.bedHeightMm} mm` : "Not configured"}</p>
          <p className="rounded-xl bg-slate-100 p-3"><strong>Origin</strong><br />{machineProfile ? titleCase(machineProfile.origin) : "Not configured"}</p>
        </div>
        {areaError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"><AlertTriangle className="mr-2 inline" size={16} />{areaError}</p> : null}
        <div className="mt-4 grid gap-2">
          {CUTTER_CHECKLIST_ITEMS.map((item) => (
            <label key={item.key} className="flex min-h-12 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">
              <input className="mt-0.5 h-5 w-5" type="checkbox" checked={checklist[item.key]} onChange={(event) => setChecklist((current) => ({ ...current, [item.key]: event.target.checked }))} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Use the cutter’s own panel test-cut function for blade depth and pressure. The browser does not move the machine during this checklist.</p>
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="connection-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="connection-heading" className="text-lg font-bold">3. Connect the exact cutter</h2><p className="mt-1 text-sm text-slate-600">Chrome or Edge requires a user gesture before it can open the serial port.</p></div>
          <Badge tone={deviceState === "connected" ? "green" : deviceState === "error" ? "red" : "slate"}>{titleCase(deviceState)}</Badge>
        </div>
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{deviceMessage}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={connectCutter} disabled={!machineProfile || deviceState === "connecting"}><Usb size={16} />{deviceState === "connected" ? "Choose cutter again" : "Connect configured cutter"}</Button>
          <Button variant="outline" onClick={disconnectCutter} disabled={deviceState !== "connected"}><Unplug size={16} /> Disconnect</Button>
        </div>
      </section>

      <section className="panel p-4 sm:p-5" aria-labelledby="prepare-heading">
        <h2 id="prepare-heading" className="text-lg font-bold">4. Prepare one durable queue job</h2>
        <p className="mt-1 text-sm text-slate-600">Preparation converts the saved project to validated vector paths and stores the exact payload hash before any machine transmission.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => prepareJob(false)} disabled={!canPrepare || isPending}><CheckCircle2 size={16} />{isPending ? "Working…" : "Prepare cutter job"}</Button>{duplicateJobId ? <Button variant="danger" onClick={() => prepareJob(true)} disabled={isPending}><AlertTriangle size={16} /> Prepare intentional resend</Button> : null}</div>
        {!checklistReady ? <p className="mt-3 text-sm font-semibold text-amber-800">Complete every physical checklist item, including the machine-panel test cut.</p> : null}
        {duplicateJobId ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Matching sent job: {duplicateJobId}. Inspect the previous cut and material before intentionally preparing another copy.</p> : null}
      </section>

      <section className="panel overflow-hidden" aria-labelledby="queue-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 sm:p-5"><div><h2 id="queue-heading" className="text-lg font-bold">5. Machine queue and send history</h2><p className="mt-1 text-sm text-slate-600">Prepared and failed jobs may be sent. Sent jobs are immutable records.</p></div><Button variant="outline" onClick={() => startTransition(async () => { try { await refreshJobs(); } catch (error) { setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not refresh the queue." }); } })}><RefreshCw size={16} /> Refresh</Button></div>
        <div className="divide-y divide-slate-200 bg-white">
          {jobs.map((job) => (
            <article key={job.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold text-slate-950">{job.jobName}</p><p className="mt-1 text-sm text-slate-600">{job.machineName} · {job.material} · {job.materialWidthMm} mm · {job.pathCount} paths · {job.byteLength} bytes</p><p className="mt-1 text-xs text-slate-500">Prepared by {job.createdByName} · {dateTime(job.createdAt)} · attempt {job.attemptCount}</p></div><Badge tone={statusTone(job.status)}>{titleCase(job.status)}</Badge></div>
              {job.lastError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{job.lastError}</p> : null}
              {job.status === "SENT" ? <p className="mt-3 text-sm font-semibold text-emerald-800">Recorded sent {dateTime(job.sentAt)}. Payload {job.payloadHash.slice(0, 12)}…</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {(job.status === "PREPARED" || job.status === "FAILED") ? <Button onClick={() => sendJob(job)} disabled={isPending || deviceState !== "connected"}><Send size={16} />{job.status === "FAILED" ? "Retry after inspection" : "Send once to cutter"}</Button> : null}
                {(job.status === "PREPARED" || job.status === "FAILED") ? <Button variant="outline" onClick={() => cancelJob(job)} disabled={isPending}><CircleOff size={16} /> Cancel unsent job</Button> : null}
                {job.status === "SENDING" ? <><Button onClick={() => resolveSending(job, true)} disabled={isPending}>Mark physically sent</Button><Button variant="danger" onClick={() => resolveSending(job, false)} disabled={isPending}>Mark not sent after inspection</Button></> : null}
              </div>
            </article>
          ))}
          {!jobs.length ? <div className="p-8 text-center text-sm text-slate-500">No cutter queue jobs yet.</div> : null}
        </div>
      </section>
    </div>
  );
}
