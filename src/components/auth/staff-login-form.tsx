"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type StaffLoginFormProps = {
  nextPath?: string;
};

type LoginResult = {
  ok: boolean;
  error?: string;
  redirectPath?: string;
};

const errorCopy: Record<string, string> = {
  invalid: "The Login ID or password is not correct.",
  rate: "Too many sign-in attempts. Wait a few minutes before trying again.",
};

export function StaffLoginForm({ nextPath = "" }: StaffLoginFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const clearCredentials = () => {
      setIdentifier("");
      setPassword("");
      setShowPassword(false);
    };
    clearCredentials();
    const handlePageShow = () => clearCredentials();
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage("");
    const body = new FormData();
    body.set("loginId", identifier.trim());
    body.set("password", password);
    body.set("next", nextPath);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        body,
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-EJM-Login": "fetch",
        },
      });
      const result = await response.json().catch(() => null) as LoginResult | null;

      setPassword("");
      if (!response.ok || !result?.ok || !result.redirectPath) {
        setIdentifier("");
        setMessage(errorCopy[result?.error ?? "invalid"] ?? errorCopy.invalid);
        setSubmitting(false);
        return;
      }

      const target = new URL(result.redirectPath, window.location.origin);
      if (target.origin !== window.location.origin) {
        setIdentifier("");
        setMessage("The workspace destination was not valid. Refresh and try again.");
        setSubmitting(false);
        return;
      }

      setIdentifier("");
      window.location.replace(`${target.pathname}${target.search}${target.hash}`);
    } catch {
      setIdentifier("");
      setPassword("");
      setMessage("The login request could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submitLogin}
      autoComplete="off"
      data-form-type="other"
      className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_30px_90px_rgba(5,16,34,0.16)] backdrop-blur-xl sm:p-7"
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Login ID or work email</span>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="min-h-13 w-full rounded-2xl border border-slate-200 bg-white px-4 pl-11 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              placeholder="Enter your private access ID"
              disabled={submitting}
              required
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500"><span>Password</span><Link href="/forgot-password" className="normal-case tracking-normal text-cyan-700 hover:text-cyan-900">Forgot password?</Link></span>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="min-h-13 w-full rounded-2xl border border-slate-200 bg-white px-12 pl-11 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              placeholder="Enter password"
              disabled={submitting}
              required
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} disabled={submitting} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </label>
      </div>
      {message ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert" aria-live="polite">{message}</p> : null}
      <button type="submit" disabled={submitting} className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#07111f] px-5 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-[#10243e] focus:outline-none focus:ring-4 focus:ring-cyan-200 disabled:cursor-wait disabled:opacity-70">
        {submitting ? <><LoaderCircle className="animate-spin" size={18} /> Signing in securely…</> : <>Enter workspace <ArrowRight size={18} /></>}
      </button>
      <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">Credentials are not stored by the application or placed in the page URL.</p>
    </form>
  );
}
