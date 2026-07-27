"use client";

import { CheckCircle2, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MACHINE_ORIGINS,
  MACHINE_OUTPUT_FORMATS,
  type DesignMachineProfile,
  type MachineOrigin,
  type MachineOutputFormat,
} from "@/lib/design-machine-profile";

type ProfileDraft = Omit<DesignMachineProfile, "id">;

const formatLabels: Record<MachineOutputFormat, string> = {
  SVG_CUT: "Cut-path SVG",
  HPGL: "HPGL / PLT",
  DXF: "DXF polyline",
  PRINT_RIP: "Print / RIP",
};

const originLabels: Record<MachineOrigin, string> = {
  BOTTOM_LEFT: "Bottom-left plotter origin",
  TOP_LEFT: "Top-left screen origin",
};

function newDraft(): ProfileDraft {
  return {
    name: "New cutter",
    outputFormat: "SVG_CUT",
    bedWidthMm: 305,
    bedHeightMm: 508,
    unitsPerMm: 40,
    baudRate: 9600,
    origin: "BOTTOM_LEFT",
    mirrorDefault: true,
    isDefault: false,
    isActive: true,
  };
}

function draftFromProfile(profile: DesignMachineProfile): ProfileDraft {
  return {
    name: profile.name,
    outputFormat: profile.outputFormat,
    bedWidthMm: profile.bedWidthMm,
    bedHeightMm: profile.bedHeightMm,
    unitsPerMm: profile.unitsPerMm,
    baudRate: profile.baudRate,
    origin: profile.origin,
    mirrorDefault: profile.mirrorDefault,
    isDefault: profile.isDefault,
    isActive: profile.isActive,
  };
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function MachineProfilePanel({
  profiles,
  selectedId,
  canManage,
  onSelect,
  onProfilesChange,
  onUseBed,
}: {
  profiles: DesignMachineProfile[];
  selectedId: string;
  canManage: boolean;
  onSelect: (profile: DesignMachineProfile) => void;
  onProfilesChange: (profiles: DesignMachineProfile[]) => void;
  onUseBed: (profile: DesignMachineProfile) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(newDraft);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles.find((profile) => profile.isDefault) ?? profiles[0];
  const selectedIsHistorical = Boolean(selected && !selected.isActive);

  function beginCreate() {
    setEditingId("new");
    setDraft(newDraft());
    setStatus("");
  }

  function beginEdit(profile: DesignMachineProfile) {
    setEditingId(profile.id);
    setDraft(draftFromProfile(profile));
    setStatus("");
  }

  async function saveProfile() {
    setSaving(true);
    setStatus(editingId === "new" ? "Creating machine profile…" : "Saving machine profile…");
    try {
      const response = await fetch("/api/design-machine-profiles", {
        method: editingId === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId === "new" ? draft : { id: editingId, ...draft }),
      });
      const result = await response.json() as { profile?: DesignMachineProfile; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "Could not save this machine profile.");
      const next = editingId === "new"
        ? [...profiles.map((profile) => result.profile?.isDefault ? { ...profile, isDefault: false } : profile), result.profile]
        : profiles.map((profile) => profile.id === result.profile?.id
          ? result.profile
          : result.profile?.isDefault ? { ...profile, isDefault: false } : profile);
      onProfilesChange(next.filter(Boolean) as DesignMachineProfile[]);
      onSelect(result.profile);
      setEditingId(null);
      setStatus("Machine profile saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save this machine profile.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(profile: DesignMachineProfile) {
    if (!window.confirm(`Delete the machine profile “${profile.name}”? Saved design versions keep their profile snapshot.`)) return;
    setSaving(true);
    setStatus("Deleting machine profile…");
    try {
      const response = await fetch("/api/design-machine-profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profile.id }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not delete this machine profile.");
      const next = profiles.filter((candidate) => candidate.id !== profile.id);
      const replacement = next.find((candidate) => candidate.isDefault) ?? next[0];
      onProfilesChange(next);
      if (replacement) onSelect(replacement);
      setEditingId(null);
      setStatus("Machine profile deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete this machine profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Settings2 size={18} /><h3 className="font-semibold">Shop machine profile</h3></div>
        {selected?.isDefault ? <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800"><CheckCircle2 size={12} /> Default</span> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">Profiles belong only to this shop. They control bed size, cutter units, origin, serial speed and the preferred production format.</p>

      {selected ? (
        <>
          <label className="mt-3 block text-xs font-semibold text-slate-600">Active machine
            <select className="field mt-1" value={selected.id} onChange={(event) => { const profile = profiles.find((candidate) => candidate.id === event.target.value); if (profile) onSelect(profile); }}>
              {profiles.filter((profile) => profile.isActive || profile.id === selectedId).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {formatLabels[profile.outputFormat]}{profile.isActive ? "" : " · historical"}</option>)}
            </select>
          </label>
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">
            <p className="font-semibold">{selected.bedWidthMm} × {selected.bedHeightMm} mm · {formatLabels[selected.outputFormat]}</p>
            <p>{originLabels[selected.origin]} · {selected.unitsPerMm} plotter units/mm · {selected.baudRate} baud</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onUseBed(selected)}>Use machine bed</Button>
            {canManage && selected.isActive ? <Button variant="outline" onClick={() => beginEdit(selected)}>Edit profile</Button> : <Button variant="outline" disabled>{selectedIsHistorical ? "Historical snapshot" : "Owner/manager only"}</Button>}
          </div>
        </>
      ) : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No active machine profile is available.</p>}

      {canManage && editingId === null ? <Button className="mt-2 w-full" variant="outline" onClick={beginCreate}><Plus size={16} /> Add machine profile</Button> : null}

      {canManage && editingId !== null ? (
        <div className="mt-4 space-y-3 border-t border-[#ded8cd] pt-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">{editingId === "new" ? "New machine profile" : "Edit machine profile"}</p><button type="button" aria-label="Close machine profile editor" onClick={() => setEditingId(null)}><X size={17} /></button></div>
          <label className="block text-xs font-semibold text-slate-600">Profile name<input className="field mt-1" maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="block text-xs font-semibold text-slate-600">Output format<select className="field mt-1" value={draft.outputFormat} onChange={(event) => setDraft({ ...draft, outputFormat: event.target.value as MachineOutputFormat })}>{MACHINE_OUTPUT_FORMATS.map((format) => <option key={format} value={format}>{formatLabels[format]}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-600">Bed width mm<input className="field mt-1" type="number" min={20} max={2000} value={draft.bedWidthMm} onChange={(event) => setDraft({ ...draft, bedWidthMm: parseNumber(event.target.value, draft.bedWidthMm) })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Bed height mm<input className="field mt-1" type="number" min={20} max={5000} value={draft.bedHeightMm} onChange={(event) => setDraft({ ...draft, bedHeightMm: parseNumber(event.target.value, draft.bedHeightMm) })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Units per mm<input className="field mt-1" type="number" min={1} max={1000} value={draft.unitsPerMm} onChange={(event) => setDraft({ ...draft, unitsPerMm: Math.round(parseNumber(event.target.value, draft.unitsPerMm)) })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Serial baud<input className="field mt-1" type="number" min={300} max={1000000} value={draft.baudRate} onChange={(event) => setDraft({ ...draft, baudRate: Math.round(parseNumber(event.target.value, draft.baudRate)) })} /></label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">Plotter origin<select className="field mt-1" value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value as MachineOrigin })}>{MACHINE_ORIGINS.map((origin) => <option key={origin} value={origin}>{originLabels[origin]}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 rounded border border-[#ded8cd] p-2"><input type="checkbox" checked={draft.mirrorDefault} onChange={(event) => setDraft({ ...draft, mirrorDefault: event.target.checked })} /> Mirror by default</label>
            <label className="flex items-center gap-2 rounded border border-[#ded8cd] p-2"><input type="checkbox" checked={draft.isDefault} onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })} /> Shop default</label>
            <label className="col-span-2 flex items-center gap-2 rounded border border-[#ded8cd] p-2"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Active and selectable</label>
          </div>
          <div className="grid grid-cols-2 gap-2"><Button onClick={saveProfile} disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save profile"}</Button>{editingId !== "new" && selected?.isActive ? <Button variant="outline" onClick={() => deleteProfile(selected)} disabled={saving}><Trash2 size={16} /> Delete</Button> : <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>}</div>
        </div>
      ) : null}
      {status ? <p className={`mt-3 text-xs font-medium ${status.toLowerCase().includes("could not") || status.toLowerCase().includes("must keep") ? "text-red-600" : "text-slate-600"}`}>{status}</p> : null}
    </section>
  );
}
