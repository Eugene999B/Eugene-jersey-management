"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import type { FormEvent } from "react";

type StaffLoginFormProps = {
  nextPath?: string;
  defaultLoginId?: string;
};

export function StaffLoginForm({ nextPath = "", defaultLoginId = "" }: StaffLoginFormProps) {
  function submitToVisibleOrigin(event: FormEvent<HTMLFormElement>) {
    // Railway and custom domains can sit behind more than one proxy hostname.
    // Force the credential POST to the origin visible in the browser so CSP,
    // cookies and the protected workspace all stay on the same host.
    event.currentTarget.action = new URL("/api/auth/login", window.location.origin).toString();
  }

  return (
    <form
      action="/api/auth/login"
      method="post"
      onSubmit={submitToVisibleOrigin}
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
            required
          />
        </div>
      </label>
      <button type="submit" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b1f3a] px-5 text-sm font-semibold text-white transition hover:bg-[#153a69] focus:outline-none focus:ring-4 focus:ring-[#f4b942]/35">
        Open workspace <ArrowRight size={17} />
      </button>
      <p className="mt-2 text-center text-[10px] leading-4 text-slate-500 sm:mt-3 sm:text-xs">Protected by account and network rate limits.</p>
    </form>
  );
}
