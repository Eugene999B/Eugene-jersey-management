"use client";

import { CheckCircle2, CircleAlert, PlugZap, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MACHINE_CONNECTION_MODE_LABELS,
  MACHINE_DEVICE_TYPE_LABELS,
  compareDetectedHardware,
  configuredMachineIdentity,
  configuredSerialFilters,
  defaultConnectionModeForOutput,
  formatUsbId,
  machineProfileCompatibilityError,
  productionRouteForProfile,
} from "@/lib/design-device-readiness";
import {
  MACHINE_CONNECTION_MODES,
  MACHINE_DEVICE_TYPES,
  MACHINE_ORIGINS,
  MACHINE_OUTPUT_FORMATS,
  normalizeMachineConnectionMode,
  normalizeMachineDeviceType,
  type DesignMachineProfile,
  type MachineConnectionMode,
  type MachineDeviceType,
  type MachineOrigin,
  type MachineOutputFormat,
} from "@/lib/design-machine-profile";

type ProfileDraft = {
  name: string;
  manufacturer: string;
  model: string;
  deviceType: MachineDeviceType;
  connectionMode: MachineConnectionMode;
  outputFormat: MachineOutputFormat;
  bedWidthMm: number;
  bedHeightMm: number;
  unitsPerMm: number;
  baudRate: number;
  usbVendorId: string;
  usbProductId: string;
  origin: MachineOrigin;
  mirrorDefault: boolean;
  isDefault: boolean;
  isActive: boolean;
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
    name: "New production device",
    manufacturer: "",
    model: "",
    deviceType: "CUTTER_PLOTTER",
    connectionMode: "VENDOR_FILE",
    outputFormat: "SVG_CUT",
    bedWidthMm: 305,
    bedHeightMm: 508,
    unitsPerMm: 40,
    baudRate: 9600,
    usbVendorId: "",
    usbProductId: "",
    origin: "BOTTOM_LEFT",
    mirrorDefault: true,
    isDefault: false,
    isActive: true,
  };
}

function draftFromProfile(profile: DesignMachineProfile): ProfileDraft {
  return {
    name: profile.name,
    manufacturer: profile.manufacturer ?? "",
    model: profile.model ?? "",
    deviceType: normalizeMachineDeviceType(profile.deviceType),
    connectionMode: normalizeMachineConnectionMode(profile.connectionMode, profile.outputFormat),
    outputFormat: profile.outputFormat,
    bedWidthMm: profile.bedWidthMm,
    bedHeightMm: profile.bedHeightMm,
    unitsPerMm: profile.unitsPerMm,
    baudRate: profile.baudRate,
    usbVendorId: profile.usbVendorId == null ? "" : `0x${formatUsbId(profile.usbVendorId)}`,
    usbProductId: profile.usbProductId == null ? "" : `0x${formatUsbId(profile.usbProductId)}`,
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

function parseUsbId(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const radix = /^0x/i.test(normalized) || /[a-f]/i.test(normalized) ? 16 : 10;
  const digits = normalized.replace(/^0x/i, "");
  const parsed = Number.parseInt(digits, radix);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : Number.NaN;
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
  const [testing, setTesting] = useState(false);
  const [preflightTone, setPreflightTone] = useState<"idle" | "success" | "error">("idle");
  const selected = profiles.find((profile) => profile.id === selectedId) ?? profiles.find((profile) => profile.isDefault) ?? profiles[0];
  const selectedIsHistorical = Boolean(selected && !selected.isActive);
  const selectedDeviceType = selected ? normalizeMachineDeviceType(selected.deviceType) : "CUTTER_PLOTTER";
  const selectedConnectionMode = selected
    ? normalizeMachineConnectionMode(selected.connectionMode, selected.outputFormat)
    : "VENDOR_FILE";
  const selectedRoute = selected
    ? productionRouteForProfile({ ...selected, connectionMode: selectedConnectionMode })
    : null;

  function beginCreate() {
    setEditingId("new");
    setDraft(newDraft());
    setStatus("");
    setPreflightTone("idle");
  }

  function beginEdit(profile: DesignMachineProfile) {
    setEditingId(profile.id);
    setDraft(draftFromProfile(profile));
    setStatus("");
    setPreflightTone("idle");
  }

  async function saveProfile() {
    const usbVendorId = parseUsbId(draft.usbVendorId);
    const usbProductId = parseUsbId(draft.usbProductId);
    if (Number.isNaN(usbVendorId) || Number.isNaN(usbProductId)) {
      setStatus("USB IDs must be decimal or hexadecimal values from 0x0000 to 0xFFFF.");
      return;
    }
    const payload = {
      ...draft,
      manufacturer: draft.manufacturer.trim() || null,
      model: draft.model.trim() || null,
      usbVendorId,
      usbProductId,
    };
    const compatibilityError = machineProfileCompatibilityError(payload);
    if (compatibilityError) {
      setStatus(compatibilityError);
      return;
    }

    setSaving(true);
    setStatus(editingId === "new" ? "Creating machine profile…" : "Saving machine profile…");
    try {
      const response = await fetch("/api/design-machine-profiles", {
        method: editingId === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId === "new" ? payload : { id: editingId, ...payload }),
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
      setPreflightTone("idle");
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
      setPreflightTone("idle");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete this machine profile.");
    } finally {
      setSaving(false);
    }
  }

  async function testSerialConnection() {
    if (!selected || selectedConnectionMode !== "WEB_SERIAL" || selected.outputFormat !== "HPGL") return;
    if (!window.isSecureContext) {
      setPreflightTone("error");
      setStatus("Direct serial access requires HTTPS or a trusted local development origin.");
      return;
    }
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) {
      setPreflightTone("error");
      setStatus("This browser does not expose Web Serial. Use current Chrome or Edge, or use the exported PLT file in vendor software.");
      return;
    }

    setTesting(true);
    setPreflightTone("idle");
    setStatus("Choose the configured cutter port. The test opens it, checks identity and writability, then closes it without sending movement commands.");
    let port: SerialPortLike | null = null;
    try {
      const filters = configuredSerialFilters(selected);
      port = await serial.requestPort(filters.length ? { filters } : undefined);
      await port.open({ baudRate: selected.baudRate });
      const detected = port.getInfo?.() ?? null;
      const comparison = compareDetectedHardware(selected, detected);
      if (!comparison.matches) throw new Error(comparison.message);
      if (!port.writable) throw new Error("The selected serial port opened but is not writable.");
      const detectedIdentity = detected?.usbVendorId
        ? `USB VID ${formatUsbId(detected.usbVendorId)}${detected.usbProductId ? ` · PID ${formatUsbId(detected.usbProductId)}` : ""}`
        : "serial port without browser-visible USB IDs";
      setPreflightTone("success");
      setStatus(`Connection preflight passed for ${configuredMachineIdentity(selected)}: ${detectedIdentity}, writable at ${selected.baudRate} baud. The port was closed safely without moving the machine.`);
    } catch (error) {
      setPreflightTone("error");
      setStatus(error instanceof Error && error.name !== "NotFoundError" ? error.message : "Device selection was cancelled.");
    } finally {
      try {
        await port?.close();
      } catch {
        // The user or operating system may already have closed the port.
      }
      setTesting(false);
    }
  }

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Settings2 size={18} /><h3 className="font-semibold">Shop machine profile</h3></div>
        {selected?.isDefault ? <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800"><CheckCircle2 size={12} /> Default</span> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">Profiles belong only to this shop. They identify the machine and choose the honest production route: system print, RIP file, vendor file, or direct serial HPGL.</p>

      {selected ? (
        <>
          <label className="mt-3 block text-xs font-semibold text-slate-600">Active machine
            <select className="field mt-1" value={selected.id} onChange={(event) => { const profile = profiles.find((candidate) => candidate.id === event.target.value); if (profile) { onSelect(profile); setStatus(""); setPreflightTone("idle"); } }}>
              {profiles.filter((profile) => profile.isActive || profile.id === selectedId).map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {formatLabels[profile.outputFormat]}{profile.isActive ? "" : " · historical"}</option>)}
            </select>
          </label>
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">
            <p className="font-semibold">{configuredMachineIdentity(selected)}</p>
            <p>{MACHINE_DEVICE_TYPE_LABELS[selectedDeviceType]} · {formatLabels[selected.outputFormat]}</p>
            <p>{selected.bedWidthMm} × {selected.bedHeightMm} mm · {originLabels[selected.origin]}</p>
            <p className="mt-2 font-semibold">{MACHINE_CONNECTION_MODE_LABELS[selectedConnectionMode]}</p>
            <p>{selectedRoute?.description}</p>
            {selectedConnectionMode === "WEB_SERIAL" ? <p className="mt-2">{selected.baudRate} baud · {selected.unitsPerMm} plotter units/mm{selected.usbVendorId == null ? " · any user-approved serial port" : ` · USB VID ${formatUsbId(selected.usbVendorId)}${selected.usbProductId == null ? "" : ` / PID ${formatUsbId(selected.usbProductId)}`}`}</p> : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onUseBed(selected)}>Use machine bed</Button>
            {canManage && selected.isActive ? <Button variant="outline" onClick={() => beginEdit(selected)}>Edit profile</Button> : <Button variant="outline" disabled>{selectedIsHistorical ? "Historical snapshot" : "Owner/manager only"}</Button>}
          </div>
          {selectedConnectionMode === "WEB_SERIAL" && selected.outputFormat === "HPGL" ? (
            <div className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${preflightTone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : preflightTone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-white text-slate-600"}`}>
              <div className="flex items-center gap-2">{preflightTone === "success" ? <CheckCircle2 size={16} /> : <PlugZap size={16} />}<p className="font-semibold">Serial device preflight</p></div>
              <p className="mt-1">This checks the port and configured USB identity without sending cutter movement commands.</p>
              <Button className="mt-2 w-full" variant="outline" onClick={testSerialConnection} disabled={testing}><PlugZap size={16} /> {testing ? "Testing connection…" : "Test serial connection"}</Button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
              <p className="font-semibold text-slate-900">Production route ready</p>
              <p>{selectedRoute?.title}. The operating system or vendor/RIP software selects and identifies the physical printer.</p>
            </div>
          )}
        </>
      ) : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No active machine profile is available.</p>}

      {canManage && editingId === null ? <Button className="mt-2 w-full" variant="outline" onClick={beginCreate}><Plus size={16} /> Add machine profile</Button> : null}

      {canManage && editingId !== null ? (
        <div className="mt-4 space-y-3 border-t border-[#ded8cd] pt-4">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">{editingId === "new" ? "New machine profile" : "Edit machine profile"}</p><button type="button" aria-label="Close machine profile editor" onClick={() => setEditingId(null)}><X size={17} /></button></div>
          <label className="block text-xs font-semibold text-slate-600">Profile name<input className="field mt-1" maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-600">Manufacturer<input className="field mt-1" maxLength={80} value={draft.manufacturer} onChange={(event) => setDraft({ ...draft, manufacturer: event.target.value })} placeholder="Roland, Epson, Graphtec…" /></label>
            <label className="block text-xs font-semibold text-slate-600">Model<input className="field mt-1" maxLength={80} value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} placeholder="Machine model" /></label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">Device category<select className="field mt-1" value={draft.deviceType} onChange={(event) => setDraft({ ...draft, deviceType: event.target.value as MachineDeviceType })}>{MACHINE_DEVICE_TYPES.map((type) => <option key={type} value={type}>{MACHINE_DEVICE_TYPE_LABELS[type]}</option>)}</select></label>
          <label className="block text-xs font-semibold text-slate-600">Output format<select className="field mt-1" value={draft.outputFormat} onChange={(event) => { const outputFormat = event.target.value as MachineOutputFormat; setDraft({ ...draft, outputFormat, connectionMode: defaultConnectionModeForOutput(outputFormat) }); }}>{MACHINE_OUTPUT_FORMATS.map((format) => <option key={format} value={format}>{formatLabels[format]}</option>)}</select></label>
          <label className="block text-xs font-semibold text-slate-600">Connection and production route<select className="field mt-1" value={draft.connectionMode} onChange={(event) => setDraft({ ...draft, connectionMode: event.target.value as MachineConnectionMode })}>{MACHINE_CONNECTION_MODES.map((mode) => <option key={mode} value={mode}>{MACHINE_CONNECTION_MODE_LABELS[mode]}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-600">Bed width mm<input className="field mt-1" type="number" min={20} max={2000} value={draft.bedWidthMm} onChange={(event) => setDraft({ ...draft, bedWidthMm: parseNumber(event.target.value, draft.bedWidthMm) })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Bed height mm<input className="field mt-1" type="number" min={20} max={5000} value={draft.bedHeightMm} onChange={(event) => setDraft({ ...draft, bedHeightMm: parseNumber(event.target.value, draft.bedHeightMm) })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Units per mm<input className="field mt-1" type="number" min={1} max={1000} value={draft.unitsPerMm} onChange={(event) => setDraft({ ...draft, unitsPerMm: Math.round(parseNumber(event.target.value, draft.unitsPerMm)) })} /></label>
            <label className="block text-xs font-semibold text-slate-600">Serial baud<input className="field mt-1" type="number" min={300} max={1000000} value={draft.baudRate} onChange={(event) => setDraft({ ...draft, baudRate: Math.round(parseNumber(event.target.value, draft.baudRate)) })} /></label>
          </div>
          {draft.connectionMode === "WEB_SERIAL" ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><CircleAlert size={15} /> Optional USB identity lock</div><p className="mt-1 text-[11px] leading-4 text-slate-500">Enter IDs from the device or adapter documentation. Leave both blank when the port has no stable USB identifiers.</p><div className="mt-2 grid grid-cols-2 gap-2"><label className="block text-xs font-semibold text-slate-600">USB vendor ID<input className="field mt-1" value={draft.usbVendorId} onChange={(event) => setDraft({ ...draft, usbVendorId: event.target.value })} placeholder="0x1A86" /></label><label className="block text-xs font-semibold text-slate-600">USB product ID<input className="field mt-1" value={draft.usbProductId} onChange={(event) => setDraft({ ...draft, usbProductId: event.target.value })} placeholder="0x7523" /></label></div></div> : null}
          <label className="block text-xs font-semibold text-slate-600">Plotter origin<select className="field mt-1" value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value as MachineOrigin })}>{MACHINE_ORIGINS.map((origin) => <option key={origin} value={origin}>{originLabels[origin]}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 rounded border border-[#ded8cd] p-2"><input type="checkbox" checked={draft.mirrorDefault} onChange={(event) => setDraft({ ...draft, mirrorDefault: event.target.checked })} /> Mirror by default</label>
            <label className="flex items-center gap-2 rounded border border-[#ded8cd] p-2"><input type="checkbox" checked={draft.isDefault} onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })} /> Shop default</label>
            <label className="col-span-2 flex items-center gap-2 rounded border border-[#ded8cd] p-2"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Active and selectable</label>
          </div>
          <div className="grid grid-cols-2 gap-2"><Button onClick={saveProfile} disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save profile"}</Button>{editingId !== "new" && selected?.isActive ? <Button variant="outline" onClick={() => deleteProfile(selected)} disabled={saving}><Trash2 size={16} /> Delete</Button> : <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>}</div>
        </div>
      ) : null}
      {status ? <p className={`mt-3 text-xs font-medium ${preflightTone === "success" ? "text-emerald-700" : status.toLowerCase().includes("could not") || status.toLowerCase().includes("must keep") || preflightTone === "error" ? "text-red-600" : "text-slate-600"}`}>{status}</p> : null}
    </section>
  );
}
