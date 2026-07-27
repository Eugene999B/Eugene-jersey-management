"use client";

import {
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";

type SecurityStatus = {
  configured: boolean;
  enabled: boolean;
  enabledAt: string | Date | null;
  recoveryCodesRemaining: number;
  setupPending: boolean;
};

type SetupDetails = {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
  expiresAt: string;
};

type ApiResult = {
  ok: boolean;
  error?: string;
  status?: SecurityStatus;
  setup?: SetupDetails;
  recoveryCodes?: string[];
  redirectPath?: string;
};

const errorCopy: Record<string, string> = {
  password: "The current password is not correct.",
  code: "The authenticator or recovery code is not correct, or the setup expired.",
  rate: "Too many security attempts. Wait a few minutes and try again.",
  unavailable: "Two-factor security is unavailable until the platform encryption key is configured.",
  "already-enabled": "Two-factor authentication is already enabled on this account.",
  unauthorized: "Your session expired. Sign in again.",
  origin: "The security request was rejected. Refresh the page and try again.",
  invalid: "The security request was incomplete.",
};

function RecoveryCodes({ codes, title }: { codes: string[]; title: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-amber-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Store these somewhere private. Each code works once, and this same set cannot be displayed again.
          </p>
        </div>
        <button
          type="button"
          onClick={copyCodes}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
        >
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {codes.map((recoveryCode) => (
          <code
            key={recoveryCode}
            className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-center text-sm font-bold tracking-[0.12em] text-slate-950"
          >
            {recoveryCode}
          </code>
        ))}
      </div>
    </div>
  );
}

export function TwoFactorSecurityPanel({ initialStatus }: { initialStatus: SecurityStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [setup, setSetup] = useState<SetupDetails | null>(null);
  const [replacementCodes, setReplacementCodes] = useState<string[]>([]);
  const [setupPassword, setSetupPassword] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [actionPassword, setActionPassword] = useState("");
  const [actionCode, setActionCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function request(payload: Record<string, string>) {
    const response = await fetch("/api/account/two-factor", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null) as ApiResult | null;
    if (!result || !response.ok || !result.ok) throw new Error(result?.error ?? "invalid");
    return result;
  }

  function startAction(name: string) {
    setBusy(name);
    setError("");
    setNotice("");
  }

  function showError(value: unknown) {
    const key = value instanceof Error ? value.message : "invalid";
    setError(errorCopy[key] ?? errorCopy.invalid);
  }

  async function beginSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction("begin");
    try {
      const result = await request({ action: "begin", password: setupPassword });
      if (!result.setup) throw new Error("invalid");
      setSetup(result.setup);
      setReplacementCodes([]);
      setSetupPassword("");
      setSetupCode("");
      setNotice("Setup started. Confirm a six-digit authenticator code before the ten-minute setup expires.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction("confirm");
    try {
      const result = await request({ action: "confirm", code: setupCode });
      if (!result.redirectPath) throw new Error("invalid");
      window.location.replace(result.redirectPath);
    } catch (caught) {
      showError(caught);
      setBusy(null);
    }
  }

  async function cancelSetup() {
    startAction("cancel");
    try {
      const result = await request({ action: "cancel" });
      if (result.status) setStatus(result.status);
      setSetup(null);
      setSetupCode("");
      setNotice("Setup was cancelled. Your normal password login remains unchanged.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function regenerateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction("regenerate");
    try {
      const result = await request({
        action: "regenerate",
        password: actionPassword,
        code: actionCode,
      });
      if (!result.recoveryCodes) throw new Error("invalid");
      setReplacementCodes(result.recoveryCodes);
      if (result.status) setStatus(result.status);
      setActionPassword("");
      setActionCode("");
      setNotice("New recovery codes were created. Every older recovery code is now invalid.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function turnOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction("disable");
    try {
      const result = await request({
        action: "disable",
        password: actionPassword,
        code: actionCode,
      });
      if (!result.redirectPath) throw new Error("invalid");
      window.location.replace(result.redirectPath);
    } catch (caught) {
      showError(caught);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${status.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {status.enabled ? <ShieldCheck size={23} /> : <ShieldOff size={23} />}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Personal account protection</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Two-factor authentication</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Optional for every account. When enabled, your password is followed by a private authenticator or one-time recovery code.
              </p>
            </div>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${status.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {status.enabled ? "Enabled" : "Off"}
          </span>
        </div>

        {!status.configured ? (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <TriangleAlert className="mt-0.5 shrink-0" size={18} />
            <p>The platform encryption key is not configured, so nobody can enable 2FA yet. Existing password logins remain unchanged.</p>
          </div>
        ) : null}
        {error ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">{error}</p> : null}
        {notice ? <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{notice}</p> : null}
      </section>

      {!status.enabled && status.configured && !setup ? (
        <form onSubmit={beginSetup} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-semibold text-slate-950">Turn on authenticator security</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Confirm your current password first. Enabling remains your personal choice and can be reversed later.</p>
          <label className="mt-5 block max-w-lg">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Current password</span>
            <input
              type="password"
              value={setupPassword}
              onChange={(event) => setSetupPassword(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
              autoComplete="current-password"
              required
              disabled={busy !== null}
            />
          </label>
          <button type="submit" disabled={busy !== null} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60">
            {busy === "begin" ? <LoaderCircle className="animate-spin" size={17} /> : <KeyRound size={17} />}
            Start optional setup
          </button>
        </form>
      ) : null}

      {!status.enabled && setup ? (
        <section className="space-y-5 rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Connect your authenticator</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Add a new time-based account in any compatible authenticator app. Enter the setup key manually or open the authenticator link on a supported device.</p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">Manual setup key</p>
            <code className="mt-2 block break-all text-lg font-bold tracking-[0.14em]">{setup.secret}</code>
            <a href={setup.otpauthUri} className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-white/15 px-3 text-xs font-bold text-white transition hover:bg-white/10">Open authenticator link</a>
          </div>
          <RecoveryCodes codes={setup.recoveryCodes} title="Save these recovery codes before confirming" />
          <form onSubmit={confirmSetup} className="rounded-2xl border border-slate-200 p-4">
            <label className="block max-w-sm">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Current six-digit code</span>
              <input
                value={setupCode}
                onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-center text-lg font-bold tracking-[0.2em] outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
                placeholder="123456"
                required
                disabled={busy !== null}
              />
            </label>
            <p className="mt-3 text-xs leading-5 text-slate-500">After enabling, every current session is signed out so the next login proves the new protection works.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={busy !== null} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-60">
                {busy === "confirm" ? <LoaderCircle className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
                Confirm and enable
              </button>
              <button type="button" onClick={cancelSetup} disabled={busy !== null} className="min-h-12 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Cancel setup</button>
            </div>
          </form>
        </section>
      ) : null}

      {status.enabled ? (
        <>
          {replacementCodes.length > 0 ? <RecoveryCodes codes={replacementCodes} title="Your new recovery codes" /> : null}
          <section className="grid gap-5 xl:grid-cols-2">
            <form onSubmit={regenerateCodes} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2"><RefreshCw size={19} /><h3 className="text-lg font-semibold">Replace recovery codes</h3></div>
              <p className="mt-2 text-sm leading-6 text-slate-600">You currently have {status.recoveryCodesRemaining} unused code{status.recoveryCodesRemaining === 1 ? "" : "s"}. Creating a new set invalidates every old code.</p>
              <SecurityConfirmationFields
                password={actionPassword}
                code={actionCode}
                onPassword={setActionPassword}
                onCode={setActionCode}
                disabled={busy !== null}
              />
              <button type="submit" disabled={busy !== null} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white disabled:opacity-60">
                {busy === "regenerate" ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCw size={17} />}
                Create new codes
              </button>
            </form>

            <form onSubmit={turnOff} className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2 text-red-900"><ShieldOff size={19} /><h3 className="text-lg font-semibold">Turn off two-factor authentication</h3></div>
              <p className="mt-2 text-sm leading-6 text-red-800">This remains your choice. Disabling requires both factors and signs this account out from every device.</p>
              <SecurityConfirmationFields
                password={actionPassword}
                code={actionCode}
                onPassword={setActionPassword}
                onCode={setActionCode}
                disabled={busy !== null}
                danger
              />
              <button type="submit" disabled={busy !== null} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60">
                {busy === "disable" ? <LoaderCircle className="animate-spin" size={17} /> : <ShieldOff size={17} />}
                Disable and sign out everywhere
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SecurityConfirmationFields({
  password,
  code,
  onPassword,
  onCode,
  disabled,
  danger = false,
}: {
  password: string;
  code: string;
  onPassword: (value: string) => void;
  onCode: (value: string) => void;
  disabled: boolean;
  danger?: boolean;
}) {
  const borderClass = danger
    ? "border-red-300 bg-white focus:border-red-700 focus:ring-red-100"
    : "border-slate-300 bg-white focus:border-slate-950 focus:ring-slate-200";
  const labelClass = danger ? "text-red-700" : "text-slate-500";

  return (
    <div className="mt-4 space-y-3">
      <label className="block">
        <span className={`mb-2 block text-xs font-bold uppercase tracking-[0.12em] ${labelClass}`}>Current password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          className={`min-h-12 w-full rounded-xl border px-4 outline-none focus:ring-4 ${borderClass}`}
          autoComplete="current-password"
          required
          disabled={disabled}
        />
      </label>
      <label className="block">
        <span className={`mb-2 block text-xs font-bold uppercase tracking-[0.12em] ${labelClass}`}>Authenticator or recovery code</span>
        <input
          value={code}
          onChange={(event) => onCode(event.target.value)}
          className={`min-h-12 w-full rounded-xl border px-4 outline-none focus:ring-4 ${borderClass}`}
          autoComplete="one-time-code"
          required
          disabled={disabled}
        />
      </label>
    </div>
  );
}
