import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountKind } from "@prisma/client";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { ChangePasswordPanel } from "@/components/account/change-password-panel";
import { TwoFactorSecurityPanel } from "@/components/account/two-factor-security-panel";
import { getBuyerSession } from "@/lib/buyer-session";
import { getTwoFactorStatus } from "@/lib/two-factor-account";

export const metadata: Metadata = { title: "Buyer security | ESM" };
export const dynamic = "force-dynamic";

export default async function BuyerSecurityPage() {
  const buyer = await getBuyerSession();
  if (!buyer) redirect("/buyer/login?error=login-required&next=/buyer/security");

  const status = await getTwoFactorStatus({ accountKind: AccountKind.BUYER, accountId: buyer.id });

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-3xl bg-[#07111f] p-5 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-300/10 text-cyan-300"><LockKeyhole size={23} /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{buyer.name}</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Buyer account security</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Change your password and manage optional two-factor authentication. These settings protect ordering, messaging, pickup, delivery and account activity.</p></div>
            </div>
            <Link href="/shops" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-bold text-white transition hover:bg-white/10"><ArrowLeft size={17} />Back to marketplace</Link>
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
