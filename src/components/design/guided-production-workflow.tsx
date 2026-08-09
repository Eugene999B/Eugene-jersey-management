"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Ruler, Save, Scissors, Shirt, Thermometer, Usb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  productionSelectionFingerprint,
  reviewDesignProduction,
  type DesignProductionCanvas,
  type DesignProductionSelection,
} from "@/lib/design-production-brief";
import type {
  ProductionGarmentSpec,
  ProductionMaterialSpec,
  ProductionPlacementSpec,
} from "@/lib/production-specs";

type SavedDesign = {
  id: string;
  title: string;
  customer: string | null;
  updatedAt: string;
  canvas: DesignProductionCanvas;
};

type ExistingBrief = {
  id: string;
  designJobId: string;
  garmentId: string;
  garmentSize: string;
  placementId: string;
  materialId: string;
  status: "DRAFT" | "REVIEWED";
  reviewedAt: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function selectedClass(selected: boolean) {
  return selected
    ? "border-[var(--shop-primary)] bg-[color:var(--shop-primary)]/10 ring-2 ring-[color:var(--shop-primary)]/15"
    : "border-[#ded8cd] bg-white hover:border-slate-400";
}

function dateTime(value: string | null) {
  if (!value) return "Not reviewed";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function placementRect(location: string) {
  const code = location.toUpperCase();
  if (code.includes("LEFT") && code.includes("CHEST")) return { x: 68, y: 75, width: 48, height: 42 };
  if (code.includes("RIGHT") && code.includes("CHEST")) return { x: 124, y: 75, width: 48, height: 42 };
  if (code.includes("SLEEVE")) return { x: 34, y: 74, width: 34, height: 55 };
  if (code.includes("BACK")) return { x: 68, y: 68, width: 104, height: 120 };
  if (code.includes("SHORT")) return { x: 75, y: 125, width: 90, height: 70 };
  return { x: 68, y: 68, width: 104, height: 120 };
}

function GarmentPreview({
  garment,
  size,
  placement,
  artworkWidth,
  artworkHeight,
}: {
  garment: ProductionGarmentSpec | null;
  size: string;
  placement: ProductionPlacementSpec | null;
  artworkWidth: number;
  artworkHeight: number;
}) {
  const box = placementRect(placement?.location ?? "FULL_FRONT");
  const ratio = artworkWidth > 0 && artworkHeight > 0 ? Math.min(1, artworkWidth / Math.max(artworkHeight, 1)) : 0.7;
  const artWidth = Math.max(18, box.width * Math.min(0.9, 0.55 + ratio * 0.25));
  const artHeight = Math.max(14, box.height * 0.55);
  const artX = box.x + (box.width - artWidth) / 2;
  const artY = box.y + (box.height - artHeight) / 2;

  return (
    <div className="rounded-2xl border border-[#ded8cd] bg-[#f8f6f1] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Garment preview</p><p className="font-semibold">{garment?.name ?? "Choose a garment"}{size ? ` · ${size}` : ""}</p></div>
        {placement ? <Badge tone="blue">{placement.name}</Badge> : null}
      </div>
      <svg viewBox="0 0 240 240" className="mx-auto h-auto w-full max-w-[320px]" role="img" aria-label="Selected garment placement preview">
        <path d="M80 32 L101 22 Q120 38 139 22 L160 32 L205 62 L184 102 L166 90 L166 215 L74 215 L74 90 L56 102 L35 62 Z" fill="#ffffff" stroke="#64748b" strokeWidth="2" />
        <path d="M101 22 Q120 52 139 22" fill="none" stroke="#94a3b8" strokeWidth="2" />
        {placement ? <rect x={box.x} y={box.y} width={box.width} height={box.height} rx="5" fill="none" stroke="#0f766e" strokeWidth="2" strokeDasharray="5 4" /> : null}
        {placement && artworkWidth > 0 ? <rect x={artX} y={artY} width={artWidth} height={artHeight} rx="3" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.5" /> : null}
        {placement ? <text x={box.x + box.width / 2} y={box.y + box.height + 14} textAnchor="middle" fontSize="10" fill="#334155">{placement.name}</text> : null}
      </svg>
      <p className="mt-2 text-center text-xs leading-5 text-slate-500">Preview is a placement guide. Production dimensions below remain the authoritative millimetre measurements.</p>
    </div>
  );
}

export function GuidedProductionWorkflow({
  designs,
  materials,
  garments,
  placements,
  initialBriefs,
  initialDesignId,
}: {
  designs: SavedDesign[];
  materials: ProductionMaterialSpec[];
  garments: ProductionGarmentSpec[];
  placements: ProductionPlacementSpec[];
  initialBriefs: ExistingBrief[];
  initialDesignId?: string;
}) {
  const firstDesignId = designs.some((design) => design.id === initialDesignId) ? initialDesignId as string : designs[0]?.id ?? "";
  const initialBrief = initialBriefs.find((brief) => brief.designJobId === firstDesignId) ?? null;
  const [designJobId, setDesignJobId] = useState(firstDesignId);
  const [garmentId, setGarmentId] = useState(initialBrief?.garmentId ?? "");
  const [garmentSize, setGarmentSize] = useState(initialBrief?.garmentSize ?? "");
  const [placementId, setPlacementId] = useState(initialBrief?.placementId ?? "");
  const [materialId, setMaterialId] = useState(initialBrief?.materialId ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState(initialBrief?.status === "REVIEWED" ? `Reviewed ${dateTime(initialBrief.reviewedAt)}` : "Choose every production option explicitly before review.");
  const [reviewedFingerprint, setReviewedFingerprint] = useState(initialBrief?.status === "REVIEWED"
    ? productionSelectionFingerprint({ designJobId: initialBrief.designJobId, garmentId: initialBrief.garmentId, garmentSize: initialBrief.garmentSize, placementId: initialBrief.placementId, materialId: initialBrief.materialId })
    : "");

  const design = designs.find((item) => item.id === designJobId) ?? null;
  const garment = garments.find((item) => item.id === garmentId) ?? null;
  const material = materials.find((item) => item.id === materialId) ?? null;
  const allowedPlacements = placements.filter((item) => !item.garmentId || item.garmentId === garmentId);
  const placement = allowedPlacements.find((item) => item.id === placementId) ?? null;
  const selection: DesignProductionSelection = { designJobId, garmentId, garmentSize, placementId, materialId };
  const fingerprint = productionSelectionFingerprint(selection);
  const complete = Boolean(design && garment && garmentSize && placement && material);
  const review = useMemo(() => complete && design && garment && placement && material
    ? reviewDesignProduction({ canvas: design.canvas, garment, garmentSize, placement, material })
    : null, [complete, design, garment, garmentSize, placement, material]);
  const reviewed = Boolean(reviewedFingerprint && reviewedFingerprint === fingerprint && review && !review.errors.length);

  function chooseDesign(nextDesignId: string) {
    const brief = initialBriefs.find((item) => item.designJobId === nextDesignId) ?? null;
    setDesignJobId(nextDesignId);
    setGarmentId(brief?.garmentId ?? "");
    setGarmentSize(brief?.garmentSize ?? "");
    setPlacementId(brief?.placementId ?? "");
    setMaterialId(brief?.materialId ?? "");
    const nextFingerprint = brief?.status === "REVIEWED"
      ? productionSelectionFingerprint({ designJobId: brief.designJobId, garmentId: brief.garmentId, garmentSize: brief.garmentSize, placementId: brief.placementId, materialId: brief.materialId })
      : "";
    setReviewedFingerprint(nextFingerprint);
    setSaveState("idle");
    setMessage(brief?.status === "REVIEWED" ? `Reviewed ${dateTime(brief.reviewedAt)}` : "Choose every production option explicitly before review.");
  }

  function chooseGarment(nextId: string) {
    setGarmentId(nextId);
    setGarmentSize("");
    setPlacementId("");
    setSaveState("idle");
    setMessage("Garment changed. Choose the exact size and placement.");
  }

  async function save(action: "SAVE" | "REVIEW") {
    if (!complete || !review) {
      setSaveState("error");
      setMessage("Choose the design, garment, exact size, placement and material first.");
      return;
    }
    if (action === "REVIEW" && review.errors.length) {
      setSaveState("error");
      setMessage(review.errors.join(" "));
      return;
    }
    setSaveState("saving");
    setMessage(action === "REVIEW" ? "Recording reviewed production snapshot…" : "Saving production draft…");
    try {
      const response = await fetch("/api/design-production-briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selection, action }),
      });
      const result = await response.json() as { brief?: ExistingBrief; error?: string };
      if (!response.ok || !result.brief) throw new Error(result.error ?? "Could not save production review.");
      setSaveState("saved");
      if (action === "REVIEW") {
        setReviewedFingerprint(fingerprint);
        setMessage(`Production review approved ${dateTime(result.brief.reviewedAt)}. The garment, material and placement snapshots are now fixed for this reviewed job.`);
      } else {
        setReviewedFingerprint("");
        setMessage("Production draft saved. Complete all fit checks before approval.");
      }
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "Could not save production review.");
    }
  }

  if (!designs.length) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><h2 className="font-semibold">Save artwork first</h2><p className="mt-2 text-sm leading-6">Create and save the production artwork in Design Studio before starting the guided garment-to-cutter workflow.</p><a className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--shop-primary)] px-4 text-sm font-semibold text-white" href="/dashboard/designs">Open Design Studio</a></div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f4b942]">Guided production workflow</p>
        <h2 className="mt-2 text-2xl font-semibold">Saved artwork → exact garment → material → review → cutter</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">This workflow never silently chooses the first size or production recipe. The operator must explicitly select every physical production option before the cutter queue becomes the next step.</p>
        <p className={`mt-3 text-sm font-semibold ${saveState === "error" ? "text-red-300" : saveState === "saved" ? "text-emerald-300" : "text-cyan-200"}`}>{message}</p>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 1</p><h3 className="mt-1 text-lg font-semibold">Choose the job and exact physical item</h3></div>
        <div className="grid gap-5 p-4 sm:p-5">
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Saved Design Studio artwork<select className="field" value={designJobId} onChange={(event) => chooseDesign(event.target.value)}>{designs.map((item) => <option key={item.id} value={item.id}>{item.title}{item.customer ? ` — ${item.customer}` : ""}</option>)}</select></label>

          <div><p className="mb-2 text-sm font-semibold">Garment profile</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{garments.map((item) => <button type="button" key={item.id} onClick={() => chooseGarment(item.id)} className={`rounded-xl border p-3 text-left ${selectedClass(garmentId === item.id)}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.name}</span>{garmentId === item.id ? <CheckCircle2 size={18} className="text-[var(--shop-primary)]" /> : null}</div><p className="mt-1 text-xs text-slate-500">{item.fabric}{item.colour ? ` · ${item.colour}` : ""}</p></button>)}</div></div>

          <div><p className="mb-2 text-sm font-semibold">Exact size</p>{garment ? <div className="flex flex-wrap gap-2">{garment.sizes.map((size) => <button type="button" key={size} onClick={() => setGarmentSize(size)} className={`min-h-11 min-w-14 rounded-xl border px-4 text-sm font-semibold ${selectedClass(garmentSize === size)}`}>{garmentSize === size ? <Check size={15} className="mr-1 inline" /> : null}{size}</button>)}</div> : <p className="text-sm text-slate-500">Choose the garment first.</p>}</div>

          <div><p className="mb-2 text-sm font-semibold">Print placement</p>{garment ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{allowedPlacements.map((item) => <button type="button" key={item.id} onClick={() => setPlacementId(item.id)} className={`rounded-xl border p-3 text-left ${selectedClass(placementId === item.id)}`}><div className="flex items-center justify-between"><span className="font-semibold">{item.name}</span>{placementId === item.id ? <CheckCircle2 size={18} className="text-[var(--shop-primary)]" /> : null}</div><p className="mt-1 text-xs text-slate-500">{item.location}</p></button>)}</div> : <p className="text-sm text-slate-500">Choose the garment first.</p>}</div>

          <div><p className="mb-2 text-sm font-semibold">Production material</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{materials.map((item) => <button type="button" key={item.id} onClick={() => setMaterialId(item.id)} className={`rounded-xl border p-3 text-left ${selectedClass(materialId === item.id)}`}><div className="flex items-center justify-between"><span className="font-semibold">{item.name}</span>{materialId === item.id ? <CheckCircle2 size={18} className="text-[var(--shop-primary)]" /> : null}</div><p className="mt-1 text-xs text-slate-500">{item.type}{item.colour ? ` · ${item.colour}` : ""} · {item.rollWidthMm} mm roll</p></button>)}</div></div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 2</p><h3 className="mt-1 flex items-center gap-2 text-lg font-semibold"><Shirt size={19} /> Design on garment preview</h3></div><div className="p-4"><GarmentPreview garment={garment} size={garmentSize} placement={placement} artworkWidth={review?.measurements.artworkWidthMm ?? 0} artworkHeight={review?.measurements.artworkHeightMm ?? 0} /><div className="mt-4"><a href="/dashboard/designs" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ded8cd] bg-white px-4 text-sm font-semibold"><Scissors size={16} /> Edit saved artwork in Design Studio</a></div></div></div>

        <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 3</p><h3 className="mt-1 flex items-center gap-2 text-lg font-semibold"><Ruler size={19} /> Production cut-sheet view</h3></div><div className="p-4">{review && material && placement ? <div className="grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Cut sheet</span><p className="mt-1 font-bold">{review.measurements.cutSheetWidthMm.toFixed(1)} × {review.measurements.cutSheetHeightMm.toFixed(1)} mm</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Artwork bounds</span><p className="mt-1 font-bold">{review.measurements.artworkWidthMm.toFixed(1)} × {review.measurements.artworkHeightMm.toFixed(1)} mm</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Placement allowance</span><p className="mt-1 font-bold">{review.measurements.placementWidthMm.toFixed(1)} × {review.measurements.placementHeightMm.toFixed(1)} mm</p></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Loaded material</span><p className="mt-1 font-bold">{material.rollWidthMm.toFixed(1)} mm roll · {material.mirrorRequired ? "Mirror" : "No mirror"}</p></div><div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><span className="text-slate-500">Cutter recipe</span><p className="mt-1 font-bold">{material.blade || "Blade not recorded"} · force {material.cutterForce || "?"} · speed {material.cutterSpeed || "?"} · {material.passes} pass{material.passes === 1 ? "" : "es"}</p></div></div> : <p className="text-sm text-slate-500">Choose all Step 1 options to calculate the real production geometry.</p>}</div></div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 4</p><h3 className="mt-1 text-lg font-semibold">Production review</h3></div>
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_320px]">
          <div>{review ? <div className="space-y-2">{review.checks.map((check) => <div key={check.key} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${check.passed ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-950"}`}>{check.passed ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}<span className="font-semibold">{check.label}</span></div>)}</div> : <p className="text-sm text-slate-500">The checklist appears after every physical option is selected.</p>}</div>
          <div className="space-y-3">{review?.errors.map((error) => <div key={error} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950"><strong>Blocker:</strong> {error}</div>)}{review?.warnings.map((warning) => <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Operator check:</strong> {warning}</div>)}{material && garment ? <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><p className="flex items-center gap-2 font-semibold"><Thermometer size={16} /> Heat press guidance</p><p className="mt-1">{material.pressTemperatureC} °C · {material.pressDurationSeconds}s · {material.pressure} pressure · {material.peelType} peel{material.repressSeconds ? ` · ${material.repressSeconds}s repress` : ""}</p><p className="mt-1 text-xs">Garment heat limit: {garment.maxPressTemperatureC} °C</p></div> : null}</div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-[#ded8cd] p-4 sm:p-5"><Button variant="outline" onClick={() => save("SAVE")} disabled={!complete || saveState === "saving"}><Save size={16} /> Save production draft</Button><Button onClick={() => save("REVIEW")} disabled={!complete || Boolean(review?.errors.length) || saveState === "saving"}><CheckCircle2 size={16} /> Approve production review</Button></div>
      </section>

      <section className={`rounded-2xl border p-5 ${reviewed ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Step 5</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-semibold">Send through the controlled cutter workflow</h3><p className="mt-1 text-sm text-slate-600">The next screen still requires machine identity, physical material loading, blade/origin checks, cutter-panel test cut and explicit send confirmation.</p></div>{reviewed ? <a href={`/dashboard/designs/production?design=${encodeURIComponent(designJobId)}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[var(--shop-primary)] px-4 text-sm font-semibold text-white"><Usb size={17} /> Continue to cutter <ChevronRight size={16} /></a> : <span className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-500">Review required first</span>}</div>
      </section>
    </div>
  );
}
