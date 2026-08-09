import { ArrowLeft, Flame, Layers3, Ruler, Shirt, Usb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import {
  readProductionLibrary,
  type ProductionGarmentSpec,
  type ProductionMaterialSpec,
  type ProductionPlacementSpec,
} from "@/lib/production-specs";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";
import {
  saveHeatPressProfileAction,
  saveProductionGarmentAction,
  saveProductionMaterialAction,
  saveProductionPlacementAction,
  setProductionResourceActiveAction,
} from "./actions";

const field = "min-h-11 w-full rounded-xl border border-[#d8d1c5] bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--shop-primary)]";
const label = "grid gap-1.5 text-sm font-medium text-slate-700";
const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--shop-primary)] px-4 text-sm font-semibold text-white";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8d1c5] bg-white px-4 text-sm font-semibold text-slate-800";

function TextInput(props: { name: string; label: string; defaultValue?: string; placeholder?: string; required?: boolean }) {
  return <label className={label}>{props.label}<input className={field} name={props.name} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder} required={props.required} /></label>;
}

function NumberInput(props: { name: string; label: string; defaultValue: number; step?: string; min?: number }) {
  return <label className={label}>{props.label}<input className={field} type="number" name={props.name} defaultValue={props.defaultValue} step={props.step ?? "1"} min={props.min ?? 0} required /></label>;
}

function TextArea(props: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  return <label className={label}>{props.label}<textarea className={`${field} min-h-24 resize-y`} name={props.name} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder} /></label>;
}

function ActiveButton({ resource, id, active }: { resource: "material" | "garment" | "placement"; id: string; active: boolean }) {
  return (
    <form action={setProductionResourceActiveAction}>
      <input type="hidden" name="resource" value={resource} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="nextActive" value={active ? "false" : "true"} />
      <button type="submit" className={secondary}>{active ? "Archive" : "Reactivate"}</button>
    </form>
  );
}

function MaterialForm({ item }: { item?: ProductionMaterialSpec }) {
  return (
    <form action={saveProductionMaterialAction} className="grid gap-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextInput name="name" label="Material name" defaultValue={item?.name} placeholder="White standard HTV" required />
        <TextInput name="type" label="Material type" defaultValue={item?.type ?? "Heat-transfer vinyl"} required />
        <TextInput name="brand" label="Brand" defaultValue={item?.brand} />
        <TextInput name="colour" label="Colour" defaultValue={item?.colour} />
        <NumberInput name="rollWidthMm" label="Roll width (mm)" defaultValue={item?.rollWidthMm ?? 500} />
        <NumberInput name="remainingLengthM" label="Remaining length (m)" defaultValue={item?.remainingLengthM ?? 0} step="0.01" />
        <NumberInput name="costPerMetre" label="Cost per metre" defaultValue={item?.costPerMetre ?? 0} step="0.01" />
        <TextInput name="blade" label="Blade / profile" defaultValue={item?.blade} placeholder="45° blade" />
        <NumberInput name="cutterForce" label="Cutter force" defaultValue={item?.cutterForce ?? 0} step="0.1" />
        <NumberInput name="cutterSpeed" label="Cutter speed" defaultValue={item?.cutterSpeed ?? 0} step="0.1" />
        <NumberInput name="passes" label="Cut passes" defaultValue={item?.passes ?? 1} min={1} />
        <label className={label}>Production mirror<span className="flex min-h-11 items-center gap-2 rounded-xl border border-[#d8d1c5] bg-white px-3 font-normal"><input type="checkbox" name="mirrorRequired" defaultChecked={item?.mirrorRequired ?? true} /> Mirror before cutting</span></label>
        <NumberInput name="pressTemperatureC" label="Press temperature (°C)" defaultValue={item?.pressTemperatureC ?? 150} />
        <NumberInput name="pressDurationSeconds" label="Press duration (seconds)" defaultValue={item?.pressDurationSeconds ?? 12} step="0.1" />
        <TextInput name="pressure" label="Pressure" defaultValue={item?.pressure ?? "Medium"} required />
        <TextInput name="peelType" label="Peel method" defaultValue={item?.peelType ?? "Warm"} required />
        <NumberInput name="repressSeconds" label="Repress (seconds)" defaultValue={item?.repressSeconds ?? 0} step="0.1" />
        <div className="md:col-span-2 xl:col-span-3"><TextInput name="compatibleFabrics" label="Compatible fabrics" defaultValue={item?.compatibleFabrics.join(", ")} placeholder="Cotton, polyester, poly-cotton" /></div>
      </div>
      <TextArea name="warnings" label="Warnings / exceptions" defaultValue={item?.warnings} placeholder="Record heat-sensitive fabrics, testing rules or special handling." />
      <div><button type="submit" className={primary}>{item ? "Save material changes" : "Add material recipe"}</button></div>
    </form>
  );
}

function GarmentForm({ item }: { item?: ProductionGarmentSpec }) {
  return (
    <form action={saveProductionGarmentAction} className="grid gap-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextInput name="name" label="Garment profile" defaultValue={item?.name} placeholder="Black cotton tee" required />
        <TextInput name="garmentType" label="Garment type" defaultValue={item?.garmentType ?? "T-shirt"} required />
        <TextInput name="colour" label="Colour" defaultValue={item?.colour} />
        <TextInput name="fabric" label="Fabric" defaultValue={item?.fabric} placeholder="100% cotton" required />
        <div className="md:col-span-2"><TextInput name="sizes" label="Available sizes" defaultValue={item?.sizes.join(", ")} placeholder="S, M, L, XL, 2XL" required /></div>
        <TextInput name="supplier" label="Supplier" defaultValue={item?.supplier} />
        <NumberInput name="maxPressTemperatureC" label="Maximum safe press temperature (°C)" defaultValue={item?.maxPressTemperatureC ?? 170} />
        <NumberInput name="cost" label="Garment cost" defaultValue={item?.cost ?? 0} step="0.01" />
        <NumberInput name="sellingPrice" label="Default selling price" defaultValue={item?.sellingPrice ?? 0} step="0.01" />
      </div>
      <TextArea name="heatRestrictions" label="Heat restrictions" defaultValue={item?.heatRestrictions} placeholder="Record scorch risk, cover-sheet requirement or reduced dwell time." />
      <div><button type="submit" className={primary}>{item ? "Save garment changes" : "Add garment profile"}</button></div>
    </form>
  );
}

function PlacementForm({ item, garments }: { item?: ProductionPlacementSpec; garments: ProductionGarmentSpec[] }) {
  const sizeRules = item ? Object.entries(item.sizeRules).map(([size, rule]) => `${size}: ${rule.widthMm}x${rule.heightMm}`).join("\n") : "";
  return (
    <form action={saveProductionPlacementAction} className="grid gap-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextInput name="name" label="Placement name" defaultValue={item?.name} placeholder="Left chest" required />
        <TextInput name="location" label="Location code" defaultValue={item?.location ?? "LEFT_CHEST"} required />
        <label className={label}>Garment profile<select className={field} name="garmentId" defaultValue={item?.garmentId ?? ""}><option value="">Any garment</option>{garments.map((garment) => <option key={garment.id} value={garment.id}>{garment.name}</option>)}</select></label>
        <div className="hidden xl:block" />
        <NumberInput name="defaultWidthMm" label="Default width (mm)" defaultValue={item?.defaultWidthMm ?? 100} step="0.1" />
        <NumberInput name="defaultHeightMm" label="Default height (mm)" defaultValue={item?.defaultHeightMm ?? 100} step="0.1" />
        <div className="md:col-span-2"><TextArea name="sizeRules" label="Size-specific dimensions" defaultValue={sizeRules} placeholder={"S: 90x90\nM: 100x100\nL: 110x110"} /></div>
      </div>
      <TextArea name="notes" label="Placement notes" defaultValue={item?.notes} />
      <div><button type="submit" className={primary}>{item ? "Save placement changes" : "Add placement template"}</button></div>
    </form>
  );
}

export default async function ProductionMaterialsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireRole(permissions.designs);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const query = await searchParams;
  const canManage = session.role === "OWNER" || session.role === "MANAGER";
  const library = readProductionLibrary(shop.productionSetup);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Printing and production"
        title="Materials, garments & press recipes"
        description="Keep the real cutting and pressing rules beside Design Studio so operators do not guess material width, blade settings, heat, pressure, peel method or placement size."
        actions={<><a href="/dashboard/designs" className={secondary}><ArrowLeft size={16} /> Design Studio</a><a href="/dashboard/designs/production" className={secondary}><Usb size={16} /> Cutter operations</a></>}
      />

      {query.saved ? <FeedbackState state="success" title="Production library saved" description="The shop-specific production rule is available immediately." /> : null}
      {query.error ? <FeedbackState state="error" title="Production rule was not saved" description="Check the required measurements. Placement size rules use entries such as S: 90x90 and M: 100x100." /> : null}
      {!canManage ? <FeedbackState state="info" title="Read-only production reference" description="Designers can use these recipes during production. Only owners and managers can change shop production settings." /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><p className="flex items-center gap-2 text-sm text-slate-500"><Layers3 size={17} /> Active materials</p><p className="mt-2 text-2xl font-bold">{library.materials.filter((item) => item.isActive).length}</p></div>
        <div className="panel p-4"><p className="flex items-center gap-2 text-sm text-slate-500"><Shirt size={17} /> Active garments</p><p className="mt-2 text-2xl font-bold">{library.garments.filter((item) => item.isActive).length}</p></div>
        <div className="panel p-4"><p className="flex items-center gap-2 text-sm text-slate-500"><Ruler size={17} /> Active placements</p><p className="mt-2 text-2xl font-bold">{library.placements.filter((item) => item.isActive).length}</p></div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Flame size={18} className="text-[var(--shop-primary)]" /> Manual heat press</h2><p className="mt-1 text-sm text-slate-500">The press profile describes the physical machine. Each material recipe below determines the actual production temperature, time, pressure and peel method.</p></div>
        <div className="p-4 sm:p-5">
          {canManage ? (
            <form action={saveHeatPressProfileAction} className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <TextInput name="name" label="Press name" defaultValue={library.heatPress.name} required />
                <NumberInput name="plateWidthMm" label="Plate width (mm)" defaultValue={library.heatPress.plateWidthMm || 380} />
                <NumberInput name="plateHeightMm" label="Plate height (mm)" defaultValue={library.heatPress.plateHeightMm || 380} />
                <TextInput name="pressureControl" label="Pressure control" defaultValue={library.heatPress.pressureControl} required />
                <NumberInput name="minimumTemperatureC" label="Minimum temperature (°C)" defaultValue={library.heatPress.minimumTemperatureC} />
                <NumberInput name="maximumTemperatureC" label="Maximum temperature (°C)" defaultValue={library.heatPress.maximumTemperatureC} />
                <TextInput name="timerControl" label="Timer control" defaultValue={library.heatPress.timerControl} required />
              </div>
              <TextArea name="notes" label="Press notes" defaultValue={library.heatPress.notes} />
              <div><button type="submit" className={primary}>Save heat press profile</button></div>
            </form>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p><span className="text-slate-500">Press</span><br /><strong>{library.heatPress.name}</strong></p>
              <p><span className="text-slate-500">Plate</span><br /><strong>{library.heatPress.plateWidthMm || "?"} × {library.heatPress.plateHeightMm || "?"} mm</strong></p>
              <p><span className="text-slate-500">Temperature</span><br /><strong>{library.heatPress.minimumTemperatureC}–{library.heatPress.maximumTemperatureC} °C</strong></p>
              <p><span className="text-slate-500">Pressure</span><br /><strong>{library.heatPress.pressureControl}</strong></p>
            </div>
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Material library</h2><p className="mt-1 text-sm text-slate-500">Tie each real vinyl or transfer material to cutting and heat-press instructions.</p></div>
        {canManage ? <div className="border-b border-[#ded8cd] bg-slate-50 p-4 sm:p-5"><h3 className="mb-3 font-semibold">Add material recipe</h3><MaterialForm /></div> : null}
        <div className="divide-y divide-[#ded8cd] bg-white">
          {library.materials.map((item) => <article key={item.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone={item.isActive ? "green" : "slate"}>{item.isActive ? "Active" : "Archived"}</Badge>{item.mirrorRequired ? <Badge tone="blue">Mirror cut</Badge> : null}</div><p className="mt-1 text-sm text-slate-500">{item.type}{item.brand ? ` · ${item.brand}` : ""}{item.colour ? ` · ${item.colour}` : ""}</p></div>{canManage ? <ActiveButton resource="material" id={item.id} active={item.isActive} /> : null}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-slate-500">Roll / stock</span><br /><strong>{item.rollWidthMm} mm · {item.remainingLengthM} m</strong></p><p><span className="text-slate-500">Cutter</span><br /><strong>{item.blade || "Blade not recorded"} · force {item.cutterForce || "?"} · speed {item.cutterSpeed || "?"} · {item.passes} pass{item.passes === 1 ? "" : "es"}</strong></p><p><span className="text-slate-500">Press</span><br /><strong>{item.pressTemperatureC} °C · {item.pressDurationSeconds}s · {item.pressure}</strong></p><p><span className="text-slate-500">Peel / repress</span><br /><strong>{item.peelType} · {item.repressSeconds}s</strong></p></div>{item.warnings ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Warning:</strong> {item.warnings}</p> : null}{canManage ? <details className="mt-4 rounded-xl border border-[#ded8cd] bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Edit material recipe</summary><div className="border-t border-[#ded8cd] p-4"><MaterialForm item={item} /></div></details> : null}</article>)}
          {!library.materials.length ? <div className="p-4 sm:p-5"><FeedbackState state="empty" title="No material recipes yet" description="Record the vinyl and transfer materials actually used in this shop." /></div> : null}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Garment library</h2><p className="mt-1 text-sm text-slate-500">Record fabric, size range, cost and safe heat limits for the garments you press.</p></div>
        {canManage ? <div className="border-b border-[#ded8cd] bg-slate-50 p-4 sm:p-5"><h3 className="mb-3 font-semibold">Add garment profile</h3><GarmentForm /></div> : null}
        <div className="divide-y divide-[#ded8cd] bg-white">
          {library.garments.map((item) => <article key={item.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone={item.isActive ? "green" : "slate"}>{item.isActive ? "Active" : "Archived"}</Badge></div><p className="mt-1 text-sm text-slate-500">{item.garmentType}{item.colour ? ` · ${item.colour}` : ""} · {item.fabric}</p></div>{canManage ? <ActiveButton resource="garment" id={item.id} active={item.isActive} /> : null}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><p><span className="text-slate-500">Sizes</span><br /><strong>{item.sizes.join(", ") || "Not recorded"}</strong></p><p><span className="text-slate-500">Heat limit</span><br /><strong>Maximum {item.maxPressTemperatureC} °C</strong></p><p><span className="text-slate-500">Cost / selling</span><br /><strong>{shop.currency} {item.cost.toFixed(2)} / {shop.currency} {item.sellingPrice.toFixed(2)}</strong></p><p><span className="text-slate-500">Supplier</span><br /><strong>{item.supplier || "Not recorded"}</strong></p></div>{item.heatRestrictions ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Heat restriction:</strong> {item.heatRestrictions}</p> : null}{canManage ? <details className="mt-4 rounded-xl border border-[#ded8cd] bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Edit garment profile</summary><div className="border-t border-[#ded8cd] p-4"><GarmentForm item={item} /></div></details> : null}</article>)}
          {!library.garments.length ? <div className="p-4 sm:p-5"><FeedbackState state="empty" title="No garment profiles yet" description="Record the real garments you produce so heat and placement rules can be checked." /></div> : null}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="text-lg font-semibold">Placement templates</h2><p className="mt-1 text-sm text-slate-500">Keep common print areas and size-specific artwork dimensions consistent.</p></div>
        {canManage ? <div className="border-b border-[#ded8cd] bg-slate-50 p-4 sm:p-5"><h3 className="mb-3 font-semibold">Add placement template</h3><PlacementForm garments={library.garments} /></div> : null}
        <div className="divide-y divide-[#ded8cd] bg-white">
          {library.placements.map((item) => { const garment = library.garments.find((candidate) => candidate.id === item.garmentId); return <article key={item.id} className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone={item.isActive ? "green" : "slate"}>{item.isActive ? "Active" : "Archived"}</Badge></div><p className="mt-1 text-sm text-slate-500">{item.location} · {garment?.name ?? "Any garment"}</p></div>{canManage ? <ActiveButton resource="placement" id={item.id} active={item.isActive} /> : null}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Default dimensions</span><br /><strong>{item.defaultWidthMm} × {item.defaultHeightMm} mm</strong></p><p><span className="text-slate-500">Size rules</span><br /><strong>{Object.keys(item.sizeRules).length ? Object.entries(item.sizeRules).map(([size, rule]) => `${size}: ${rule.widthMm}×${rule.heightMm}`).join(" · ") : "Use default dimensions"}</strong></p></div>{canManage ? <details className="mt-4 rounded-xl border border-[#ded8cd] bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Edit placement template</summary><div className="border-t border-[#ded8cd] p-4"><PlacementForm item={item} garments={library.garments} /></div></details> : null}</article>; })}
          {!library.placements.length ? <div className="p-4 sm:p-5"><FeedbackState state="empty" title="No placement templates yet" description="Add locations such as left chest, full front, upper back, sleeve or shorts leg." /></div> : null}
        </div>
      </section>

      <FeedbackState state="info" title="Physical production remains operator-controlled" description="If a material recipe conflicts with a garment heat limit, test the safer process before production. ESM gives settings, checklists and timers; it does not claim electronic control of a manual heat press." />
    </div>
  );
}
