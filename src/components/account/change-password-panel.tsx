"use client";

import { useState, useTransition } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const errorCopy: Record<string, string> = {
  invalid: "Use at least 12 characters with at least one letter and one number, and make sure both new-password fields match.",
  "current-password": "The current password is incorrect.",
  "same-password": "Choose a new password that is different from the current password.",
  rate: "Too many attempts. Wait a few minutes and try again.",
  unauthorized: "Your session has expired. Sign in again.",
  origin: "This security request was blocked. Refresh the page and try again.",
};

export function ChangePasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        message?: string;
        redirectPath?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setMessage(payload?.detail || errorCopy[payload?.error ?? ""] || "The password could not be changed.");
        return;
      }

      setMessage(payload.message ?? "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => window.location.assign(payload.redirectPath ?? "/login?passwordChanged=1"), 700);
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><KeyRound size={21} /></span>
        <div>
          <h2 className="text-xl font-semibold">Change password</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Use this for your own account. After a successful change, all existing sessions are revoked and you sign in again with the new password.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Current password
            <input className="field mt-1" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            New password
            <input className="field mt-1" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={isPending} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Confirm new password
            <input className="field mt-1" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isPending} />
          </label>
          <Button type="button" onClick={submit} disabled={isPending || !currentPassword || !newPassword || !confirmPassword}>
            <ShieldCheck size={17} /> {isPending ? "Changing password..." : "Change password"}
          </Button>
          {message ? <p role="status" className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{message}</p> : null}
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p className="font-semibold text-slate-900">Password rules</p>
          <p className="mt-2">Use at least 12 characters with at least one letter and one number.</p>
          <p className="mt-2">Do not reuse the company email password, Paystack password, Railway password or another employee&apos;s password.</p>
          <p className="mt-2">A password change signs out every phone and computer using this account.</p>
        </div>
      </div>
    </section>
  );
}
