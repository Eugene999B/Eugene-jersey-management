import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck, Store } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { shortDate, titleCase } from "@/lib/format";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopIdCardPage({ params }: Props) {
  await requireRole(permissions.superAdmin);
  const { shopId } = await params;
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) notFound();

  return (
    <main className="min-h-screen bg-[#f6f4ef] p-4 print:bg-white">
      <section className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-[8px] border border-[#ded8cd] bg-white">
          <div className="bg-[#111827] p-5 text-white">
            <div className="flex items-center justify-between gap-3">
              <Image src={shop.logoUrl || "/brand/accra-pro.svg"} alt={shop.name} width={54} height={54} className="rounded-[8px]" />
              <BadgeCheck size={34} className="text-emerald-300" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase text-white/60">Verified seller ID</p>
            <h1 className="mt-1 text-2xl font-semibold">{shop.name}</h1>
            <p className="mt-1 text-sm text-white/65">/{shop.slug}</p>
          </div>
          <div className="grid gap-3 p-5 text-sm">
            <div className="rounded-[8px] bg-[#f6f4ef] px-3 py-2">
              Status: <span className="font-semibold">{titleCase(shop.verificationStatus)}</span>
            </div>
            <div className="rounded-[8px] bg-[#f6f4ef] px-3 py-2">
              Network: <span className="font-semibold">{shop.networkCode ?? "Not assigned"}</span>
            </div>
            <div className="rounded-[8px] bg-[#f6f4ef] px-3 py-2">
              Staff ID: <span className="font-semibold">{shop.staffLoginId ?? "Not assigned"}</span>
            </div>
            <div className="rounded-[8px] bg-[#f6f4ef] px-3 py-2">
              Issued: <span className="font-semibold">{shop.verifiedAt ? shortDate(shop.verifiedAt) : "Pending"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[8px] border border-[#ded8cd] bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Store size={18} className="text-[#0f766e]" />
            <h2 className="font-semibold">Seller information</h2>
          </div>
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold">Legal name:</span> {shop.legalBusinessName || "Not provided"}</p>
            <p><span className="font-semibold">Registration:</span> {shop.businessRegistrationNumber || "Not provided"}</p>
            <p><span className="font-semibold">Phone:</span> {shop.credentialPhone || "Not provided"}</p>
            <p><span className="font-semibold">Address:</span> {shop.credentialAddress || "Not provided"}</p>
          </div>
          <div className="mt-6 rounded-[8px] bg-[#f6f4ef] p-4 text-sm leading-6 text-slate-600">
            This seller ID is valid only while the shop is active and verified on Eugene Jersey Management.
          </div>
        </div>
      </section>
    </main>
  );
}
