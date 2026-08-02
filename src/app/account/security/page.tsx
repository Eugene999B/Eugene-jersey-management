import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { AccountKind, Role } from "@prisma/client";
import { ChangePasswordPanel } from "@/components/account/change-password-panel";
import { TwoFactorSecurityPanel } from "@/components/account/two-factor-security-panel";
import { requireSession } from "@/lib/auth";
import { getTwoFactorStatus } from "@/lib/two-factor-account";

export const metadata: Metadata = { title: "Account security | ESM" };
export const dynamic = "force-dynamic";

function workspacePath(role: Role) {
  if (role === Role.SUPER_ADMIN) return "/admin";
  if (role === Role.SUPPLIER) return "/supplier";
  return "/dashboard";
}

export default async function AccountSecurityPage() {
  const session = await requireSession();
  const status = await getTwoFactorStatus({ accountKind: AccountKind.USER, accountId: session.id });
  const backPath = workspacePath(session.role);

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300"><LockKeyhole size={23} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{session.name}</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Personal account security</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Change your own password and manage optional two-factor authentication. Shop owners and platform administrators cannot secretly change another person&apos;s security settings.</p></div></div>
            <Link href={backPath} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold text-white transition hover:bg-white/10"><ArrowLeft size={17} />Back to workspace</Link>
          </div>
        </header>
        <div className="space-y-5">
          <ChangePasswordPanel />
          <TwoFactorSecurityPanel
            initialStatus={{
              configured: status.configured,
              enabled: status.enabled,
              enabledAt: status.enabledAt?.toISOString() ?? null,
              recoveryCodesRemaining: status.recoveryCodesRemaining,
              setupPending: status.setupPending,
            }}
          />
        </div>
      </div>
    </main>
  );
}
