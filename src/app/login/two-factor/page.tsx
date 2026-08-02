import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountKind } from "@prisma/client";
import { TwoFactorLoginForm } from "@/components/auth/two-factor-login-form";
import { platformDb } from "@/lib/platform-db";
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
  verifyTwoFactorChallenge,
} from "@/lib/two-factor-challenge";

export const metadata: Metadata = { title: "Security verification | ESM" };
export const dynamic = "force-dynamic";

export default async function TwoFactorLoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;
  const challenge = token ? await verifyTwoFactorChallenge(token) : null;
  if (!challenge) redirect("/login?error=invalid");

  let accountName = "this account";
  let accountType = "work account";

  if (challenge.accountKind === AccountKind.USER) {
    const user = await platformDb.user.findUnique({
      where: { id: challenge.accountId },
      select: { name: true, isActive: true, sessionVersion: true, shop: { select: { isActive: true } } },
    });
    if (!user?.isActive || user.sessionVersion !== challenge.sessionVersion || (user.shop && !user.shop.isActive)) {
      redirect("/login?error=invalid");
    }
    accountName = user.name;
  } else {
    const buyer = await platformDb.buyerAccount.findUnique({
      where: { id: challenge.accountId },
      select: { name: true, isActive: true, updatedAt: true },
    });
    if (!buyer?.isActive || buyer.updatedAt.getTime() !== challenge.sessionVersion) {
      redirect("/buyer/login?error=invalid");
    }
    accountName = buyer.name;
    accountType = "buyer account";
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#02050a] px-4 py-8 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.08] blur-[120px]" />
      <div className="relative z-10 w-full max-w-[520px]">
        <div className="mb-5 text-center">
          <Image src="/brand/esm-mark.svg" alt="Eugene Shop Management" width={48} height={48} className="mx-auto" priority />
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">ESM · Secure sign in</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">One more private check.</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/48">The password for <span className="font-bold text-white/75">{accountName}</span> was accepted. Optional two-factor authentication is enabled on this {accountType}.</p>
        </div>
        <TwoFactorLoginForm />
      </div>
    </main>
  );
}
