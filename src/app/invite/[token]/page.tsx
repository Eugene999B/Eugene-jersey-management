import Image from "next/image";
import { notFound } from "next/navigation";
import { acceptInviteAction } from "@/app/invite/[token]/actions";
import { prisma } from "@/lib/db";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { hashToken } from "@/lib/tokens";
import { roleLabels } from "@/lib/rbac";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const invite = await prisma.inviteToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { shop: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date() || !invite.shop.isActive) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-5">
      <div className="panel w-full max-w-md p-6">
        <div className="mb-5 flex items-center gap-3"><Image src={invite.shop.logoUrl || "/brand/ejm-mark.svg"} alt={invite.shop.name} width={48} height={48} className="rounded-[8px]" /><div><p className="text-xs font-semibold uppercase text-[#0f766e]">Secure staff invitation</p><p className="font-semibold">Eugene Jersey Management</p></div></div>
        <h1 className="mt-2 text-3xl font-semibold">Join {invite.shop.name}</h1>
        <p className="mt-3 text-sm text-slate-600">You were invited as {roleLabels[invite.role]}. Set your name and a password with at least {PASSWORD_MIN_LENGTH} characters, including a letter and number.</p>
        <form action={acceptInviteAction} className="mt-5 space-y-4">
          <input type="hidden" name="token" value={token} />
          <input className="field" name="name" placeholder="Your full name" autoComplete="name" required />
          <input className="field" name="password" type="password" minLength={PASSWORD_MIN_LENGTH} maxLength={100} placeholder={`Create password (${PASSWORD_MIN_LENGTH}+ characters)`} autoComplete="new-password" required />
          <button type="submit" className="w-full rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white">Activate account</button>
        </form>
      </div>
    </main>
  );
}
