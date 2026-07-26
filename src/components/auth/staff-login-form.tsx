"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";

type StaffLoginFormProps = {
  nextPath?: string;
  defaultLoginId?: string;
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

export function StaffLoginForm({ nextPath = "", defaultLoginId = "" }: StaffLoginFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "X-EJM-Login": "fetch",
        },
      });
      const result = await response.json().catch(() => null) as LoginResult | null;

      if (!response.ok || !result?.ok || !result.redirectPath) {
        setMessage(errorCopy[result?.error ?? "invalid"] ?? errorCopy.invalid);
        setSubmitting(false);
        return;
      }

      const target = new URL(result.redirectPath, window.location.origin);
      if (target.origin !== window.location.origin) {
        setMessage("The workspace destination was not valid. Refresh and try again.");
        setSubmitting(false);
        return;
      }
      window.location.replace(`${target.pathname}${target.search}${target.hash}`);
    } catch {
      setMessage("The login request could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submitLogin}
      className="rounded-2xl border border-[#d9d3c8] bg-white p-4 shadow-[0_18px_50px_rgba(11,31,58,0.10)] sm:p-6"
    >
      <input type="hidden" name="next" value={nextPath} />
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold sm:text-sm">Login ID or work email</span>
        <input
          className="field min-h-11 sm:min-h-12"
          name="loginId"
          autoComplete="username"
          defaultValue={defaultLoginId}
          placeholder="Your personal Login ID"
          disabled={submitting}
          required
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold sm:text-sm">
          <span>Password</span>
          <Link href="/forgot-password" className="text-[#b51220] hover:underline">Forgot password?</Link>
        </span>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            className="field min-h-11 pl-10 sm:min-h-12"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            disabled={submitting}
            required
          />
        </div>
      </label>
      {message ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800" role="alert" aria-live="polite">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b1f3a] px-5 text-sm font-semibold text-white transition hover:bg-[#153a69] focus:outline-none focus:ring-4 focus:ring-[#f4b942]/35 disabled:cursor-wait disabled:opacity-70"
      >
        {submitting ? <><LoaderCircle className="animate-spin" size={17} /> Signing in…</> : <>Open workspace <ArrowRight size={17} /></>}
      </button>
      <p className="mt-2 text-center text-[10px] leading-4 text-slate-500 sm:mt-3 sm:text-xs">Protected by account and network rate limits.</p>
    </form>
  );
}
