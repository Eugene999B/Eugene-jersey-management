"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { PlatformGovernanceSettingsData } from "@/lib/platform-governance-shared";

type Props = { initialSettings: PlatformGovernanceSettingsData };

const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";
const labelClass = "text-sm font-semibold text-slate-800";

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Toggle({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" />
      <span><span className="block font-semibold text-slate-950">{label}</span><span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span></span>
    </label>
  );
}

export function PlatformGovernanceForm({ initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(initialSettings);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [saved, settings]);

  function set<K extends keyof PlatformGovernanceSettingsData>(key: K, value: PlatformGovernanceSettingsData[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!dirty) {
      setMessage("No governance values changed.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/governance-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...settings, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save governance settings.");
      setSettings(result.settings);
      setSaved(result.settings);
      setReason("");
      setMessage(`Governance settings saved. ${result.changedFields.length} field${result.changedFields.length === 1 ? "" : "s"} updated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save governance settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Platform profile</h2>
        <p className="mt-1 text-sm text-slate-600">Public identity and operating defaults. Secret provider credentials remain in Railway.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className={labelClass}>Platform name<input className={inputClass} value={settings.platformName} onChange={(event) => set("platformName", event.target.value)} /></label>
          <label className={labelClass}>Legal company name<input className={inputClass} value={settings.legalCompanyName} onChange={(event) => set("legalCompanyName", event.target.value)} /></label>
          <label className={labelClass}>Support email<input type="email" className={inputClass} value={settings.supportEmail} onChange={(event) => set("supportEmail", event.target.value)} /></label>
          <label className={labelClass}>Support phone<input className={inputClass} value={settings.supportPhone} onChange={(event) => set("supportPhone", event.target.value)} /></label>
          <label className={labelClass}>Default country<input className={inputClass} value={settings.defaultCountry} onChange={(event) => set("defaultCountry", event.target.value)} /></label>
          <label className={labelClass}>Currency code<input className={inputClass} maxLength={3} value={settings.defaultCurrency} onChange={(event) => set("defaultCurrency", event.target.value.toUpperCase())} /></label>
          <label className={labelClass}>Timezone<input className={inputClass} value={settings.defaultTimezone} onChange={(event) => set("defaultTimezone", event.target.value)} /></label>
          <label className={labelClass}>Terms version<input className={inputClass} value={settings.termsVersion} onChange={(event) => set("termsVersion", event.target.value)} /></label>
          <label className={labelClass}>Privacy version<input className={inputClass} value={settings.privacyVersion} onChange={(event) => set("privacyVersion", event.target.value)} /></label>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Commercial defaults</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className={labelClass}>Trial duration (days)<input type="number" min={0} max={365} className={inputClass} value={settings.trialDays} onChange={(event) => set("trialDays", numeric(event.target.value))} /></label>
          <label className={labelClass}>Included staff accounts<input type="number" min={1} max={10000} className={inputClass} value={settings.includedStaffAccounts} onChange={(event) => set("includedStaffAccounts", numeric(event.target.value))} /></label>
          <label className={labelClass}>Support SLA (hours)<input type="number" min={1} max={720} className={inputClass} value={settings.supportSlaHours} onChange={(event) => set("supportSlaHours", numeric(event.target.value))} /></label>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Platform operations</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Toggle checked={settings.marketplaceEnabled} label="Public marketplace" description="Allow customers to browse the public marketplace." onChange={(value) => set("marketplaceEnabled", value)} />
          <Toggle checked={settings.publicApplicationsEnabled} label="Public applications" description="Allow future shop and supplier application forms." onChange={(value) => set("publicApplicationsEnabled", value)} />
          <Toggle checked={settings.signupsEnabled} label="Buyer sign-ups" description="Allow new buyer accounts to register." onChange={(value) => set("signupsEnabled", value)} />
          <Toggle checked={settings.paymentsEnabled} label="Platform payments" description="Master operational policy for online payment features; provider secrets stay separate." onChange={(value) => set("paymentsEnabled", value)} />
          <Toggle checked={settings.messagingEnabled} label="Operational messaging" description="Master policy for SMS and WhatsApp features; security OTP remains separate." onChange={(value) => set("messagingEnabled", value)} />
          <Toggle checked={settings.maintenanceMode} label="Read-only maintenance mode" description="Record the approved platform maintenance state." onChange={(value) => set("maintenanceMode", value)} />
          <Toggle checked={settings.incidentMode} label="Incident mode" description="Record an active operational incident for administrators." onChange={(value) => set("incidentMode", value)} />
        </div>
        <label className={`${labelClass} mt-4 block`}>Maintenance or incident notice<textarea rows={3} className={inputClass} value={settings.maintenanceNotice} onChange={(event) => set("maintenanceNotice", event.target.value)} /></label>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Security and retention policy</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className={labelClass}>Login-attempt limit<input type="number" min={3} max={20} className={inputClass} value={settings.loginAttemptLimit} onChange={(event) => set("loginAttemptLimit", numeric(event.target.value))} /></label>
          <label className={labelClass}>Session lifetime (minutes)<input type="number" min={15} max={525600} className={inputClass} value={settings.sessionLifetimeMinutes} onChange={(event) => set("sessionLifetimeMinutes", numeric(event.target.value))} /></label>
          <label className={labelClass}>Sensitive-action reauthentication (minutes)<input type="number" min={1} max={1440} className={inputClass} value={settings.sensitiveActionReauthMinutes} onChange={(event) => set("sensitiveActionReauthMinutes", numeric(event.target.value))} /></label>
          <label className={labelClass}>Audit retention (days)<input type="number" min={30} max={36500} className={inputClass} value={settings.auditRetentionDays} onChange={(event) => set("auditRetentionDays", numeric(event.target.value))} /></label>
          <label className={labelClass}>Data retention (days)<input type="number" min={30} max={36500} className={inputClass} value={settings.dataRetentionDays} onChange={(event) => set("dataRetentionDays", numeric(event.target.value))} /></label>
          <label className={labelClass}>Allowed upload MIME types<input className={inputClass} value={settings.allowedUploadTypes.join(", ")} onChange={(event) => set("allowedUploadTypes", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-semibold">Approve and record change</h2>
        <p className="mt-1 text-sm text-slate-600">Every save records the administrator, reason, changed values, IP address and device user agent in the audit log.</p>
        <label className={`${labelClass} mt-4 block`}>Change reason<textarea aria-label="Governance change reason" required minLength={5} maxLength={300} rows={3} className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || !dirty} className="button-primary disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving governance..." : "Save governance settings"}</button>
          <span className="text-sm text-slate-500">{dirty ? "Unsaved governance changes" : "Settings match the authoritative database copy"}</span>
        </div>
        {message ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p> : null}
        <p className="mt-3 text-xs text-slate-500">Last authoritative update: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "initial defaults"}</p>
      </section>
    </form>
  );
}
