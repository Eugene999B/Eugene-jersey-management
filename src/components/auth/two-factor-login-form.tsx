"use client";

import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

type VerificationResult = {
  ok: boolean;
  error?: string;
  redirectPath?: string;
};

const errorCopy: Record<string, string> = {
  invalid: "That authenticator or recovery code is not correct.",
  expired: "This security check expired. Return to login and enter your password again.",
  rate: "Too many verification attempts. Return to login and try again later.",
  origin: "The security request was rejected. Refresh the page and try again.",
};

export function TwoFactorLoginForm() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");

    const body = new FormData();
    body.set("code", code.trim());

    try {
      const response = await fetch("/api/auth/two-factor", {
        method: "POST",
        body,
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => null) as VerificationResult | null;
      if (!response.ok || !result?.ok || !result.redirectPath) {
        setCode("");
        setMessage(errorCopy[result?.error ?? "invalid"] ?? errorCopy.invalid);
        setSubmitting(false);
        return;
      }

      const target = new URL(result.redirectPath, window.location.origin);
      if (target.origin !== window.location.origin) {
        setMessage("The workspace destination was not valid. Return to login and try again.");
        setSubmitting(false);
        return;
      }
      window.location.replace(`${target.pathname}${target.search}${target.hash}`);
    } catch {
      setMessage("The verification request could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.065] p-4 shadow-[0_28px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300"><ShieldCheck size={22} /></span>
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Optional two-factor security</p><h2 className="mt-1 text-xl font-black text-white">Confirm it is you</h2><p className="mt-1 text-sm leading-6 text-slate-400">Enter the current six-digit code from your authenticator app. A saved recovery code also works once.</p></div>
      </div>

      <form onSubmit={submit} className="mt-5">
        <label className="block">
          <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Authenticator or recovery code</span>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="min-h-13 w-full rounded-2xl border border-white/10 bg-black/25 px-4 pl-11 text-center text-lg font-bold tracking-[0.18em] text-white outline-none transition placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-600 focus:border-cyan-300/70 focus:bg-black/35 focus:ring-4 focus:ring-cyan-300/10"
              inputMode="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="123456 or XXXX-XXXX"
              minLength={6}
              maxLength={32}
              disabled={submitting}
              required
              autoFocus
            />
          </div>
        </label>
        {message ? <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100" role="alert" aria-live="polite">{message}</p> : null}
        <button type="submit" disabled={submitting} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 text-sm font-black text-[#031018] shadow-[0_14px_35px_rgba(103,232,249,0.2)] transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-300/20 disabled:cursor-wait disabled:opacity-70">
          {submitting ? <><LoaderCircle className="animate-spin" size={18} /> Verifying…</> : <>Complete sign in <ArrowRight size={18} /></>}
        </button>
      </form>

      <form action="/logout" method="post" className="mt-3">
        <button type="submit" className="min-h-11 w-full rounded-2xl border border-white/10 text-xs font-bold text-slate-400 transition hover:border-white/25 hover:text-white">Cancel and return to login</button>
      </form>
    </div>
  );
}
