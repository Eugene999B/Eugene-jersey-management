import { ArrowLeft, Flame, Layers3, Ruler, Shirt, SlidersHorizontal, Usb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { readProductionLibrary, type ProductionGarmentSpec, type ProductionMaterialSpec, type ProductionPlacementSpec } from "@/lib/production-specs";
import { permissions } from "@/lib/rbac";
import {
  saveHeatPressProfileAction,
  saveProductionGarmentAction,
  saveProductionMaterialAction,
  saveProductionPlacementAction,
  setProductionResourceActiveAction,
} from "./actions";

const fieldClass = "min-h-11 w-full rounded-xl border border-[#d8d1c5] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--shop-primary)] focus:ring-2 focus:ring-[color:var(--shop-primary)]/15";
const labelClass = "grid gap-1.5 text-sm font-medium text-slate-700";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--shop-primary)] px-4 text-sm font-semibold text-white hover:opacity-95";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d8d1c5] bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50";

function NumberField({ name, label, defaultValue, step = "1", min = 0, required = true }: { name: string; label: string; defaultValue: number; step?: string; min?: number; required?: boolean }) {
  return <label className={labelClass}>{label}<input className={fieldClass} name={name} type="number" min={min} step={step} defaultValue={defaultValue} required={required} /></label>;
}

function TextField({ name, label, defaultValue = "", placeholder, required = false }: { name: string; label: string; defaultValue?: string; placeholder?: string; required?: boolean }) {
  return <label className={labelClass}>{label}<input className={fieldClass} name={name} defaultValue={defaultValue} placeholder={placeholder} required={required} /></label>;
}

function TextAreaField({ name, label, defaultValue = "", placeholder }: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  return <label className={labelClass}>{label}<textarea className={`${fieldClass} min-h-24 resize-y`} name={name} defaultValue={defaultValue} placeholder={placeholder} /></label>;
}

function MaterialForm({ material }: { material?: ProductionMaterialSpec }) {
  return (
    <form action={saveProductionMaterialAction} className="grid gap-4">
      {material ? <input type="hidden" name="id" value={material.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextField name="name" label="Material name" defaultValue={material?.name} placeholder="Standard white HTV" required />
        <TextField name="type" label="Material type" defaultValue={material?.type ?? "Heat-transfer vinyl"} placeholder="Heat-transfer vinyl" required />
        <TextField name="brand" label="Brand" defaultValue={material?.brand} placeholder="Optional" />
        <TextField name="colour" label="Colour" defaultValue={material?.colour} placeholder="White" />
        <NumberField name="rollWidthMm" label="Roll width (mm)" defaultValue={material?.rollWidthMm ?? 500} />
        <NumberField name="remainingLengthM" label="Remaining length (m)" defaultValue={material?.remainingLengthM ?? 0} step="0.01" />
        <NumberField name="costPerMetre" label="Cost per metre" defaultValue={material?.costPerMetre ?? 0} step="0.01" />
        <TextField name="blade" label="Blade / profile" defaultValue={material?.blade} placeholder="45° blade" />
        <NumberField name="cutterForce" label="Cutter force" defaultValue={material?.cutterForce ?? 0} step="0.1" />
        <NumberField name="cutterSpeed" label="Cutter speed" defaultValue={material?.cutterSpeed ?? 0} step="0.1" />
        <NumberField name="passes" label="Cut passes" defaultValue={material?.passes ?? 1} min={1} />
        <label className={`${labelClass} self-end`}><span>Production mirror</span><span className="flex min-h-11 items-center gap-2 rounded-xl border border-[#d8d1c5] bg-white px-3 font-normal"><input name="mirrorRequired" type="checkbox" defaultChecked={material?.mirrorRequired ?? true} /> Mirror before cutting</span></label>
        <NumberField name="pressTemperatureC" label="Press temperature (°C)" defaultValue={material?.pressTemperatureC ?? 150} />
        <NumberField name="pressDurationSeconds" label="Press duration (seconds)" defaultValue={material?.pressDurationSeconds ?? 12} step="0.1" />
        <TextField name="pressure" label="Pressure" defaultValue={material?.pressure ?? "Medium"} placeholder="Medium" required />
        <TextField name="peelType" label="Peel method" defaultValue={material?.peelType ?? "Warm"} placeholder="Hot, warm or cold" required />
        <NumberField name="repressSeconds" label="Repress (seconds)" defaultValue={material?.repressSeconds ?? 0} step="0.1" />
        <div className="md:col-span-2 xl:col-span-3"><TextField name="compatibleFabrics" label="Compatible fabrics" defaultValue={material?.compatibleFabrics.join(", ")} placeholder="Cotton, polyester, poly-cotton" /></div>
      </div>
      <TextAreaField name="warnings" label="Warnings / exceptions" defaultValue={material?.warnings} placeholder="Example: lower temperature for heat-sensitive polyester; test before production." />
      <div><button className={buttonClass} type="submit">{material ? "Save material changes" : "Add material recipe"}</button></div>
    </form>
  );
}

function GarmentForm({ garment }: { garment?: ProductionGarmentSpec }) {
  return (
    <form action={saveProductionGarmentAction} className="grid gap-4">
      {garment ? <input type="hidden" name="id" value={garment.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextField name="name" label="Garment profile name" defaultValue={garment?.name} placeholder="Black cotton tee" required />
        <TextField name="garmentType" label="Garment type" defaultValue={garment?.garmentType ?? "T-shirt"} required />
        <TextField name="colour" label="Colour" defaultValue={garment?.colour} placeholder="Black" />
        <TextField name="fabric" label="Fabric" defaultValue={garment?.fabric} placeholder="100% cotton" required />
        <div className="md:col-span-2"><TextField name="sizes" label="Available sizes" defaultValue={garment?.sizes.join(", ")} placeholder="S, M, L, XL, 2XL" required /></div>
        <TextField name="supplier" label="Supplier" defaultValue={garment?.supplier} placeholder="Optional supplier name" />
        <NumberField name="maxPressTemperatureC" label="Maximum press temperature (°C)" defaultValue={garment?.maxPressTemperatureC ?? 170} />
        <NumberField name="cost" label="Garment cost" defaultValue={garment?.cost ?? 0} step="0.01" />
        <NumberField name="sellingPrice" label="Default selling price" defaultValue={garment?.sellingPrice ?? 0} step="0.01" />
      </div>
      <TextAreaField name="heatRestrictions" label="Heat restrictions" defaultValue={garment?.heatRestrictions} placeholder="Example: use a cover sheet; avoid prolonged dwell on coated fabric." />
      <div><button className={buttonClass} type="submit">{garment ? "Save garment changes" : "Add garment profile"}</button></div>
    </form>
  );
}

function PlacementForm({ placement, garments }: { placement?: ProductionPlacementSpec; garments: ProductionGarmentSpec[] }) {
  const sizeRuleText = placement ? Object.entries(placement.sizeRules).map(([size, rule]) => `${size}: ${rule.widthMm}x${rule.heightMm}`).join("\n") : "";
  return (
    <form action={saveProductionPlacementAction} className="grid gap-4">
      {placement ? <input type="hidden" name="id" value={placement.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextField name="name" label="Placement name" defaultValue={placement?.name} placeholder="Left chest" required />
        <TextField name="location" label="Location code" defaultValue={placement?.location ?? "LEFT_CHEST"} placeholder="LEFT_CHEST" required />
        <label className={labelClass}>Garment profile<select className={fieldClass} name="garmentId" defaultValue={placement?.garmentId ?? ""}><option value="">Any garment</option>{garments.map((garment) => <option value={garment.id} key={garment.id}>{garment.name}</option>)}</select></label>
        <div className="hidden xl:block" />
        <NumberField name="defaultWidthMm" label="Default width (mm)" defaultValue={placement?.defaultWidthMm ?? 100} step="0.1" />
        <NumberField name="defaultHeightMm" label="Default height (mm)" defaultValue={placement?.defaultHeightMm ?? 100} step="0.1" />
        <div className="md:col-span-2"><TextAreaField name="sizeRules" label="Size-specific dimensions" defaultValue={sizeRuleText} placeholder={"S: 90x90\nM: 100x100\nL: 110x110"} /></div>
      </div>
      <TextAreaField name="notes" label="Placement notes" defaultValue={placement?.notes} placeholder="Reference points, offsets or operator notes." />
      <div><button className={buttonClass} type="submit">{placement ? "Save placement changes" : "Add placement template"}</button></div>
    </form>
  );
}

function ActiveToggle({ resource, id, isActive }: { resource: "material" | "garment" | "placement"; id: string; isActive: boolean }) {
  return <form action={setProductionResourceActiveAction}><input type="hidden" name="resource" value={resource} /><input type="hidden" name="id" value={id} /><input type="hidden" name="nextActive" value={isActive ? "false" : "true"} /><button className={secondaryButtonClass} type="submit">{isActive ? "Archive" : "Reactivate"}</button></form>;
}

export default async function ProductionMaterialsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireRole(permissions.designs);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const query = await searchParams;
  const canManage = session.role === "OWNER" || session.role === "MANAGER";
  const library = readProductionLibrary(shop.productionSetup);
  const activeMaterials = library.materials.filter((item) => item.isActive);
  const activeGarments = library.garments.filter((item) => item.isActive);
  const activePlacements = library.placements.filter((item) => item.isActive);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Printing and production"
        title="Materials, garments & press recipes"
        description="Store the exact physical production rules operators need before cutting or pressing: material width, cutter settings, heat recipe, compatible fabrics, garment heat limits and placement dimensions."
        actions={<><a href="/dashboard/designs" className={secondaryButtonClass}><ArrowLeft size={16} /> Design Studio</a><a href="/dashboard/designs/production" className={secondaryButtonClass}><Usb size={16} /> Cutter operations</a></>}
      />

      {query.saved ? <FeedbackState state="success" title="Production library saved" description="The updated shop-specific production rule is available to operators immediately." /> : null}
      {query.error ? <FeedbackState state="error" title="Production rule was not saved" description="Check the required measurements and wording. Placement size rules use the format S: 90x90, M: 100x100." /> : null}
      {!canManage ? <FeedbackState state="info" title="Read-only production reference" description="Designers can use these verified shop recipes during production. Only owners and managers can change machine/material/garment settings." /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><div className="flex items-center gap-2 text-slate-500"><Layers3 size={17} /> Active materials</div><p className="mt-2 text-2xl font-bold">{activeMaterials.length}</p></div>
        <div className="panel p-4"><div className="flex items-center gap-2 text-slate-500"><Shirt size={17} /> Active garments</div><p className="mt-2 text-2xl font-bold">{activeGarments.length}</p></div>
        <div className="panel p-4"><div className="flex items-center gap-2 text-slate-500"><Ruler size={17} /> Active placements</div><p className="mt-2 text-2xl font-bold">{activePlacements.length}</p></div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><div className="flex items-center gap-2"><Flame size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Heat press profile</h2></div><p className="mt-1 text-sm text-slate-500">This records what the manual press can do. Material recipes below still determine the actual temperature, time, pressure and peel method.</p></div>
        <div className="p-4 sm:p-5">
          {canManage ? <form action={saveHeatPressProfileAction} className="grid gap-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><TextField name="name" label="Press name" defaultValue={library.heatPress.name} required /><NumberField name="plateWidthMm" label="Plate width (mm)" defaultValue={library.heatPress.plateWidthMm || 380} /><NumberField name="plateHeightMm" label="Plate height (mm)" defaultValue={library.heatPress.plateHeightMm || 380} /><TextField name="pressureControl" label="Pressure control" defaultValue={library.heatPress.pressureControl} required /><NumberField name="minimumTemperatureC" label="Minimum temperature (°C)" defaultValue={library.heatPress.minimumTemperatureC} /><NumberField name="maximumTemperatureC" label="Maximum temperature (°C)" defaultValue={library.heatPress.maximumTemperatureC} /><TextField name="timerControl" label="Timer control" defaultValue={library.heatPress.timerControl} required /></div><TextAreaField name="notes" label="Press notes" defaultValue={library.heatPress.notes} placeholder="Warm-up behaviour, pressure reference, plate condition or safety notes." /><div><button className={buttonClass} type="submit">Save heat press profile</button></div></form> : <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-slate-500">Press</span><p className="font-semibold">{library.heatPress.name}</p></div><div><span className="text-slate-500">Plate</span><p className="font-semibold">{library.heatPress.plateWidthMm || "?"} × {library.heatPress.plateHeightMm || "?"} mm</p></div><div><span className="text-slate-500">Temperature range</span><p className="font-semibold">{library.heatPress.minimumTemperatureC}–{library.heatPress.maximumTemperatureC} °C</p></div><div><span className="text-slate-500">Pressure</span><p className="font-semibold">{library.heatPress.pressureControl}</p></div></div>}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><div className="flex items-center gap-2"><Layers3 size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Material library</h2></div><p className="mt-1 text-sm text-slate-500">Every recipe connects cutting behaviour to the real heat-press process. Never copy a generic temperature into production without validating the material and garment.</p></div>
        {canManage ? <div className="border-b border-[#ded8cd] bg-slate-50/60 p-4 sm:p-5"><h3 className="mb-3 font-semibold">Add a material recipe</h3><MaterialForm /></div> : null}
        <div className="divide-y divide-[#ded8cd] bg-white">
          {library.materials.map((item) => <article key={item.id} className="p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone={item.isActive ? "green" : "gray"}>{item.isActive ? "Active" : "Archived"}</Badge>{item.mirrorRequired ? <Badge tone="blue">Mirror cut</Badge> : null}</div><p className="mt-1 text-sm text-slate-500">{item.type}{item.brand ? ` · ${item.brand}` : ""}{item.colour ? ` · ${item.colour}` : ""}</p></div><div className="flex flex-wrap gap-2">{canManage ? <ActiveToggle resource="material" id={item.id} isActive={item.isActive} /> : null}</div></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-slate-500">Roll / stock</span><p className="font-semibold">{item.rollWidthMm} mm · {item.remainingLengthM} m remaining</p></div><div><span className="text-slate-500">Cutter</span><p className="font-semibold">{item.blade || "Blade not recorded"} · force {item.cutterForce || "?"} · speed {item.cutterSpeed || "?"} · {item.passes} pass{item.passes === 1 ? "" : "es"}</p></div><div><span className="text-slate-500">Press</span><p className="font-semibold">{item.pressTemperatureC} °C · {item.pressDurationSeconds}s · {item.pressure}</p></div><div><span className="text-slate-500">Peel / repress</span><p className="font-semibold">{item.peelType} peel · {item.repressSeconds}s repress</p></div></div>{item.compatibleFabrics.length ? <p className="mt-3 text-sm"><span className="text-slate-500">Compatible fabrics:</span> {item.compatibleFabrics.join(", ")}</p> : null}{item.warnings ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Warning:</strong> {item.warnings}</div> : null}{canManage ? <details className="mt-4 rounded-xl border border-[#ded8cd] bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Edit this material recipe</summary><div className="border-t border-[#ded8cd] p-4"><MaterialForm material={item} /></div></details> : null}</article>)}
          {!library.materials.length ? <div className="p-4 sm:p-5"><FeedbackState state="empty" title="No material recipes yet" description="Add the vinyl or transfer materials actually used in the shop before relying on automatic production guidance." /></div> : null}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><div className="flex items-center gap-2"><Shirt size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Garment library</h2></div><p className="mt-1 text-sm text-slate-500">Record fabric, available sizes, cost and the maximum safe press temperature for each real garment profile.</p></div>
        {canManage ? <div className="border-b border-[#ded8cd] bg-slate-50/60 p-4 sm:p-5"><h3 className="mb-3 font-semibold">Add a garment profile</h3><GarmentForm /></div> : null}
        <div className="divide-y divide-[#ded8cd] bg-white">
          {library.garments.map((item) => <article key={item.id} className="p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone={item.isActive ? "green" : "gray"}>{item.isActive ? "Active" : "Archived"}</Badge></div><p className="mt-1 text-sm text-slate-500">{item.garmentType}{item.colour ? ` · ${item.colour}` : ""} · {item.fabric}</p></div>{canManage ? <ActiveToggle resource="garment" id={item.id} isActive={item.isActive} /> : null}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-slate-500">Sizes</span><p className="font-semibold">{item.sizes.join(", ") || "No sizes recorded"}</p></div><div><span className="text-slate-500">Heat limit</span><p className="font-semibold">Maximum {item.maxPressTemperatureC} °C</p></div><div><span className="text-slate-500">Cost / selling</span><p className="font-semibold">{shop.currency} {item.cost.toFixed(2)} / {shop.currency} {item.sellingPrice.toFixed(2)}</p></div><div><span className="text-slate-500">Supplier</span><p className="font-semibold">{item.supplier || "Not recorded"}</p></div></div>{item.heatRestrictions ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Heat restriction:</strong> {item.heatRestrictions}</div> : null}{canManage ? <details className="mt-4 rounded-xl border border-[#ded8cd] bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Edit this garment profile</summary><div className="border-t border-[#ded8cd] p-4"><GarmentForm garment={item} /></div></details> : null}</article>)}
          {!library.garments.length ? <div className="p-4 sm:p-5"><FeedbackState state="empty" title="No garment profiles yet" description="Add the garments you actually press so heat limits and placement dimensions can be checked before production." /></div> : null}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><div className="flex items-center gap-2"><Ruler size={18} className="text-[var(--shop-primary)]" /><h2 className="text-lg font-semibold">Placement templates</h2></div><p className="mt-1 text-sm text-slate-500">Define the normal print area once and override dimensions by garment size where necessary.</p></div>
        {canManage ? <div className="border-b border-[#ded8cd] bg-slate-50/60 p-4 sm:p-5"><h3 className="mb-3 font-semibold">Add a placement template</h3><PlacementForm garments={library.garments} /></div> : null}
        <div className="divide-y divide-[#ded8cd] bg-white">
          {library.placements.map((item) => { const garment = library.garments.find((candidate) => candidate.id === item.garmentId); return <article key={item.id} className="p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone={item.isActive ? "green" : "gray"}>{item.isActive ? "Active" : "Archived"}</Badge></div><p className="mt-1 text-sm text-slate-500">{item.location} · {garment?.name ?? "Any garment"}</p></div>{canManage ? <ActiveToggle resource="placement" id={item.id} isActive={item.isActive} /> : null}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-slate-500">Default dimensions</span><p className="font-semibold">{item.defaultWidthMm} × {item.defaultHeightMm} mm</p></div><div><span className="text-slate-500">Size rules</span><p className="font-semibold">{Object.keys(item.sizeRules).length ? Object.entries(item.sizeRules).map(([size, rule]) => `${size}: ${rule.widthMm}×${rule.heightMm}`).join(" · ") : "Use default dimensions"}</p></div></div>{item.notes ? <p className="mt-3 text-sm text-slate-600">{item.notes}</p> : null}{canManage ? <details className="mt-4 rounded-xl border border-[#ded8cd] bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Edit this placement template</summary><div className="border-t border-[#ded8cd] p-4"><PlacementForm placement={item} garments={library.garments} /></div></details> : null}</article>; })}
          {!library.placements.length ? <div className="p-4 sm:p-5"><FeedbackState state="empty" title="No placement templates yet" description="Add common locations such as left chest, full front, upper back, full back, sleeve or shorts leg." /></div> : null}
        </div>
      </section>

      <FeedbackState state="info" title="Operator rule" description="If a saved material recipe conflicts with a garment heat limit, use the safer lower-temperature process only after a real test. The system must never pretend a manual heat press is electronically controlled." />
    </div>
  );
}
