"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Flame,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EMPTY_HEAT_PRESS_QUALITY,
  HEAT_PRESS_QUALITY_KEYS,
  HEAT_PRESS_QUALITY_LABELS,
  heatPressQualityComplete,
  heatPressTimerElapsedMs,
  heatPressTargetMs,
  type HeatPressQualityChecklist,
  type HeatPressRecipeSnapshot,
} from "@/lib/heat-press-workflow";

type RunStatus = "READY" | "PRESSING" | "PAUSED" | "FIRST_PRESS_COMPLETE" | "PEEL_COMPLETE" | "REPRESSING" | "QUALITY_CHECK" | "PASSED" | "REWORK_REQUIRED";
type TimerMode = "FIRST_PRESS" | "REPRESS";

type RunView = {
  id: string;
  attemptNumber: number;
  status: RunStatus;
  timerMode: TimerMode | null;
  timerStartedAt: string | null;
  timerElapsedMs: number;
  firstPressElapsedMs: number | null;
  repressElapsedMs: number | null;
  firstPressCompletedAt: string | null;
  peelCompletedAt: string | null;
  repressCompletedAt: string | null;
  qualityChecklist: unknown;
  qualityPassedAt: string | null;
  reworkReason: string | null;
  pressTemperatureC: number;
  pressDurationSeconds: number;
  pressure: string;
  peelType: string;
  repressSeconds: number;
  updatedAt: string;
};

type EventView = {
  id: string;
  type: string;
  timerMode: TimerMode | null;
  elapsedMs: number | null;
  note: string | null;
  createdAt: string;
  createdByName: string;
};

type EvidenceView = {
  id: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  createdAt: string;
  uploadedByName: string;
  url: string;
};

function statusTone(status: RunStatus): "green" | "red" | "orange" | "blue" | "slate" {
  if (status === "PASSED") return "green";
  if (status === "REWORK_REQUIRED") return "red";
  if (["PRESSING", "REPRESSING"].includes(status)) return "orange";
  if (["QUALITY_CHECK", "FIRST_PRESS_COMPLETE", "PEEL_COMPLETE"].includes(status)) return "blue";
  return "slate";
}

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(milliseconds: number) {
  const safe = Math.max(0, Math.round(milliseconds));
  const totalSeconds = safe / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(totalSeconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function normalizeChecklist(value: unknown): HeatPressQualityChecklist {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_HEAT_PRESS_QUALITY };
  const record = value as Record<string, unknown>;
  return Object.fromEntries(HEAT_PRESS_QUALITY_KEYS.map((key) => [key, record[key] === true])) as HeatPressQualityChecklist;
}

export function HeatPressWorkflowConsole({
  briefId,
  designTitle,
  customerName,
  orderHref,
  recipe,
  run: initialRun,
  events,
  evidence,
}: {
  briefId: string;
  designTitle: string;
  customerName: string | null;
  orderHref: string | null;
  recipe: HeatPressRecipeSnapshot;
  run: RunView | null;
  events: EventView[];
  evidence: EvidenceView[];
}) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const [tick, setTick] = useState(() => Date.now());
  const [quality, setQuality] = useState<HeatPressQualityChecklist>(() => normalizeChecklist(initialRun?.qualityChecklist));
  const [reworkReason, setReworkReason] = useState(initialRun?.reworkReason ?? "");
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setRun(initialRun);
    setQuality(normalizeChecklist(initialRun?.qualityChecklist));
    setReworkReason(initialRun?.reworkReason ?? "");
  }, [initialRun]);

  useEffect(() => {
    if (!run?.timerStartedAt) return;
    const id = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [run?.timerStartedAt]);

  const elapsedMs = useMemo(() => run ? heatPressTimerElapsedMs({ timerElapsedMs: run.timerElapsedMs, timerStartedAt: run.timerStartedAt }, new Date(tick)) : 0, [run, tick]);
  const activeMode = run?.timerMode ?? "FIRST_PRESS";
  const targetMs = heatPressTargetMs(activeMode, recipe);
  const progress = targetMs > 0 ? Math.min(100, elapsedMs / targetMs * 100) : 0;
  const qualityReady = heatPressQualityComplete(quality);
  const canFirstPress = run && ["READY", "PRESSING", "PAUSED"].includes(run.status) && (run.timerMode === null || run.timerMode === "FIRST_PRESS");
  const canRepress = run && recipe.repressSeconds > 0 && ["PEEL_COMPLETE", "REPRESSING", "PAUSED"].includes(run.status) && (run.status !== "PAUSED" || run.timerMode === "REPRESS");

  async function createAttempt() {
    setMessage({ tone: "info", text: "Creating a durable manual heat-press attempt…" });
    startTransition(async () => {
      try {
        const response = await fetch("/api/heat-press-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ designProductionBriefId: briefId }),
        });
        const payload = await response.json() as { run?: RunView; error?: string };
        if (!response.ok || !payload.run) throw new Error(payload.error ?? "Could not create the heat press attempt.");
        setRun(payload.run);
        setQuality({ ...EMPTY_HEAT_PRESS_QUALITY });
        setReworkReason("");
        setMessage({ tone: "success", text: `Heat press attempt ${payload.run.attemptNumber} is ready.` });
        router.refresh();
      } catch (error) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not create the heat press attempt." });
      }
    });
  }

  async function act(body: Record<string, unknown>, successMessage: string) {
    if (!run) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/heat-press-runs/${encodeURIComponent(run.id)}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json() as { run?: RunView; error?: string };
        if (!response.ok || !payload.run) throw new Error(payload.error ?? "Could not update the heat press workflow.");
        setRun(payload.run);
        setTick(Date.now());
        setMessage({ tone: "success", text: successMessage });
        router.refresh();
      } catch (error) {
        setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not update the heat press workflow." });
      }
    });
  }

  async function uploadPhoto(file: File | null) {
    if (!run || !file) return;
    setUploading(true);
    setMessage({ tone: "info", text: "Saving finished-product evidence to the shop record…" });
    try {
      const form = new FormData();
      form.set("photo", file);
      const response = await fetch(`/api/heat-press-runs/${encodeURIComponent(run.id)}/evidence`, { method: "POST", body: form });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not attach the finished-product photo.");
      setMessage({ tone: "success", text: "Finished-product photo attached to this heat press attempt." });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not attach the finished-product photo." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f4b942]">Manual heat press execution</p>
            <h2 className="mt-2 text-2xl font-semibold">{designTitle}</h2>
            <p className="mt-1 text-sm text-slate-300">{customerName ?? "No customer attached"} · {recipe.garmentName} · {recipe.garmentSize} · {recipe.placementName}</p>
          </div>
          {run ? <Badge tone={statusTone(run.status)}>Attempt {run.attemptNumber} · {titleCase(run.status)}</Badge> : <Badge tone="slate">No attempt yet</Badge>}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">ESM guides and records this manual process. It does not electronically set temperature, pressure, clamp force or peel the garment.</p>
        {message ? <p role={message.tone === "error" ? "alert" : "status"} className={`mt-3 rounded-xl border p-3 text-sm font-semibold ${message.tone === "error" ? "border-red-700 bg-red-950/60 text-red-100" : message.tone === "success" ? "border-emerald-700 bg-emerald-950/50 text-emerald-100" : "border-cyan-700 bg-cyan-950/50 text-cyan-100"}`}>{message.text}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Material</p><p className="mt-1 font-bold">{recipe.materialName}{recipe.materialColour ? ` · ${recipe.materialColour}` : ""}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Garment</p><p className="mt-1 font-bold">{recipe.garmentName} · {recipe.garmentSize}</p><p className="mt-1 text-xs text-slate-500">{recipe.garmentFabric}{recipe.garmentColour ? ` · ${recipe.garmentColour}` : ""}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Placement</p><p className="mt-1 font-bold">{recipe.placementName}</p><p className="mt-1 text-xs text-slate-500">{recipe.placementLocation}</p></div>
        <div className="panel p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Press recipe</p><p className="mt-1 font-bold">{recipe.pressTemperatureC} °C · {recipe.pressDurationSeconds}s</p><p className="mt-1 text-xs text-slate-500">{recipe.pressure} · {recipe.peelType} peel{recipe.repressSeconds ? ` · ${recipe.repressSeconds}s repress` : ""}</p></div>
      </section>

      {(recipe.heatRestriction || recipe.materialWarning) ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="flex items-center gap-2 font-bold"><AlertTriangle size={17} /> Physical-production warnings</p>{recipe.heatRestriction ? <p className="mt-2"><strong>Garment:</strong> {recipe.heatRestriction}</p> : null}{recipe.materialWarning ? <p className="mt-1"><strong>Material:</strong> {recipe.materialWarning}</p> : null}</section> : null}

      {!run || run.status === "REWORK_REQUIRED" ? (
        <section className="panel p-5">
          <h3 className="font-bold">{run?.status === "REWORK_REQUIRED" ? "Start the rework attempt" : "Start the heat press record"}</h3>
          <p className="mt-1 text-sm text-slate-600">{run?.status === "REWORK_REQUIRED" ? `Attempt ${run.attemptNumber} remains preserved with its failure reason. The next attempt receives a new number and its own timer, QC and photo evidence.` : "Create the execution record only when the correct garment, transfer and press are physically ready."}</p>
          {run?.reworkReason ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-900">Rework reason: {run.reworkReason}</p> : null}
          <Button className="mt-4" onClick={createAttempt} disabled={isPending}><RefreshCcw size={16} /> {run ? "Create rework attempt" : "Create heat press attempt"}</Button>
        </section>
      ) : null}

      {run && run.status !== "REWORK_REQUIRED" ? <>
        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Press controls</p><h3 className="mt-1 flex items-center gap-2 text-lg font-semibold"><Flame size={19} /> First press and repress timers</h3></div>
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{activeMode === "REPRESS" ? "Repress timer" : "First-press timer"}</p>
              <p className="mt-2 text-5xl font-black tabular-nums">{formatDuration(elapsedMs)}</p>
              <p className="mt-2 text-sm text-slate-300">Target {formatDuration(targetMs)}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-white transition-[width]" style={{ width: `${progress}%` }} /></div>
              {targetMs > 0 && elapsedMs >= targetMs ? <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckCircle2 size={16} /> Recipe time reached</p> : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[#ded8cd] bg-slate-50 p-4 text-sm"><p className="font-bold">Before clamping the manual press</p><ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600"><li>Verify {recipe.pressTemperatureC} °C on the press display.</li><li>Set {recipe.pressure} pressure manually.</li><li>Position the transfer at {recipe.placementName} on the {recipe.garmentSize} garment.</li><li>Protect the garment/material as required by the saved warnings.</li></ul></div>

              {canFirstPress && !run.firstPressCompletedAt ? <div className="flex flex-wrap gap-2">{run.status === "PRESSING" ? <Button variant="outline" onClick={() => act({ action: "PAUSE_TIMER" }, "First-press timer paused.")} disabled={isPending}><Pause size={16} /> Pause</Button> : <Button onClick={() => act({ action: "START_TIMER", mode: "FIRST_PRESS" }, run.status === "PAUSED" ? "First-press timer resumed." : "First-press timer started.")} disabled={isPending}><Play size={16} /> {run.status === "PAUSED" ? "Resume first press" : "Start first press"}</Button>}<Button variant="outline" onClick={() => act({ action: "RESET_TIMER" }, "First-press timer reset.")} disabled={isPending}><TimerReset size={16} /> Reset timer</Button>{["PRESSING", "PAUSED"].includes(run.status) ? <Button onClick={() => act({ action: "COMPLETE_FIRST_PRESS" }, "First press recorded. Follow the saved peel method next.")} disabled={isPending}><CheckCircle2 size={16} /> Mark first press complete</Button> : null}</div> : null}

              {run.status === "FIRST_PRESS_COMPLETE" ? <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="font-bold text-sky-950">Peel step: {recipe.peelType}</p><p className="mt-1 text-sm text-sky-800">Remove the carrier using the saved material method, inspect the transfer, then record the peel.</p><Button className="mt-3" onClick={() => act({ action: "COMPLETE_PEEL" }, recipe.repressSeconds > 0 ? "Peel recorded. Repress is now ready." : "Peel recorded. Continue to quality inspection.")} disabled={isPending}>Record peel completed</Button></div> : null}

              {canRepress ? <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><p className="font-bold text-violet-950">Repress required: {recipe.repressSeconds}s</p><div className="mt-3 flex flex-wrap gap-2">{run.status === "REPRESSING" ? <Button variant="outline" onClick={() => act({ action: "PAUSE_TIMER" }, "Repress timer paused.")} disabled={isPending}><Pause size={16} /> Pause repress</Button> : <Button onClick={() => act(run.status === "PEEL_COMPLETE" ? { action: "START_REPRESS" } : { action: "START_TIMER", mode: "REPRESS" }, run.status === "PAUSED" ? "Repress timer resumed." : "Repress timer started.")} disabled={isPending}><Play size={16} /> {run.status === "PAUSED" ? "Resume repress" : "Start repress"}</Button>}<Button variant="outline" onClick={() => act({ action: "RESET_TIMER" }, "Repress timer reset.")} disabled={isPending}><TimerReset size={16} /> Reset repress</Button>{["REPRESSING", "PAUSED"].includes(run.status) ? <Button onClick={() => act({ action: "COMPLETE_REPRESS" }, "Repress recorded. Continue to quality inspection.")} disabled={isPending}><CheckCircle2 size={16} /> Mark repress complete</Button> : null}</div></div> : null}

              <div className="grid gap-2 text-sm sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">First press actual</span><p className="font-bold">{run.firstPressElapsedMs === null ? "Not completed" : formatDuration(run.firstPressElapsedMs)}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Peel recorded</span><p className="font-bold">{dateTime(run.peelCompletedAt)}</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Repress actual</span><p className="font-bold">{run.repressElapsedMs === null ? (recipe.repressSeconds > 0 ? "Not completed" : "Not required") : formatDuration(run.repressElapsedMs)}</p></div></div>
            </div>
          </div>
        </section>

        {(run.status === "QUALITY_CHECK" || run.status === "PASSED") ? <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Quality inspection</p><h3 className="mt-1 flex items-center gap-2 text-lg font-semibold"><ShieldCheck size={19} /> Finished garment checklist</h3></div>
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-2 sm:grid-cols-2">{HEAT_PRESS_QUALITY_KEYS.map((key) => <label key={key} className={`flex min-h-14 items-start gap-3 rounded-xl border p-3 text-sm ${quality[key] ? "border-emerald-300 bg-emerald-50" : "border-[#ded8cd] bg-white"}`}><input type="checkbox" className="mt-0.5 h-5 w-5" checked={quality[key]} disabled={run.status === "PASSED"} onChange={(event) => setQuality((current) => ({ ...current, [key]: event.target.checked }))} /><span className="font-semibold">{HEAT_PRESS_QUALITY_LABELS[key]}</span></label>)}</div>
            <div className="space-y-3">
              {run.status === "QUALITY_CHECK" ? <><div className={`rounded-xl border p-3 text-sm ${qualityReady ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>{qualityReady ? "All required quality checks pass." : "Any failed check should be recorded as rework rather than hidden."}</div><Button onClick={() => act({ action: "PASS_QUALITY", checklist: quality }, "Quality passed. This heat press attempt is complete.")} disabled={!qualityReady || isPending}><CheckCircle2 size={16} /> Mark quality passed</Button><label className="grid gap-1.5 text-sm font-semibold text-slate-700">Rework reason<textarea className="field min-h-24" value={reworkReason} onChange={(event) => setReworkReason(event.target.value)} placeholder="Describe the lifted edge, scorch mark, wrong placement or other issue" /></label><Button variant="danger" onClick={() => act({ action: "REQUIRE_REWORK", checklist: quality, reason: reworkReason }, "Rework recorded. The failed attempt remains preserved.")} disabled={reworkReason.trim().length < 3 || isPending}><RotateCcw size={16} /> Require rework</Button></> : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Quality passed</p><p className="mt-1 text-sm">Completed {dateTime(run.qualityPassedAt)}</p>{orderHref ? <a className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold" href={orderHref}>Return to order workflow</a> : null}</div>}
            </div>
          </div>
        </section> : null}

        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><Camera size={19} /> Finished-product evidence</h3><p className="mt-1 text-sm text-slate-500">Attach up to six JPEG, PNG or WebP images, maximum 5 MB each. Evidence is stored with this shop and attempt rather than on the browser/device.</p></div>
          <div className="p-4 sm:p-5"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#ded8cd] bg-white px-4 text-sm font-semibold"><Camera size={16} /> {uploading ? "Saving photo…" : "Attach finished photo"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={uploading} onChange={(event) => { void uploadPhoto(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} /></label>{evidence.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{evidence.map((item) => <figure key={item.id} className="overflow-hidden rounded-xl border border-[#ded8cd] bg-slate-50"><img src={item.url} alt={`Finished garment evidence uploaded ${dateTime(item.createdAt)}`} className="aspect-[4/3] w-full object-cover" /><figcaption className="p-3 text-xs text-slate-600">{Math.ceil(item.byteLength / 1024)} KB · {item.uploadedByName}<br /><span className="font-mono">SHA-256 {item.sha256.slice(0, 12)}…</span></figcaption></figure>)}</div> : <p className="mt-3 text-sm text-slate-500">No finished-product photo has been attached to this attempt.</p>}</div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h3 className="flex items-center gap-2 text-lg font-semibold"><Clock3 size={19} /> Attempt history</h3></div>
          <div className="divide-y divide-[#ded8cd]">{events.map((event) => <div key={event.id} className="grid gap-1 p-4 text-sm sm:grid-cols-[180px_1fr_auto]"><span className="font-semibold">{titleCase(event.type)}</span><span className="text-slate-600">{event.note || "Recorded production event"}{event.elapsedMs !== null ? ` · ${formatDuration(event.elapsedMs)}` : ""}</span><span className="text-xs text-slate-500">{event.createdByName} · {dateTime(event.createdAt)}</span></div>)}{!events.length ? <p className="p-4 text-sm text-slate-500">No execution events recorded yet.</p> : null}</div>
        </section>
      </> : null}
    </div>
  );
}
