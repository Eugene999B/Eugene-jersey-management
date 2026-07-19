import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { shortDate, titleCase } from "@/lib/format";

type Props = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopLegalDocumentPage({ params }: Props) {
  await requireRole(permissions.superAdmin);
  const { shopId } = await params;
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { verifiedBy: true },
  });

  if (!shop) notFound();

  return (
    <main className="min-h-screen bg-[#f6f4ef] p-4 print:bg-white">
      <section className="mx-auto max-w-4xl rounded-[8px] border border-[#ded8cd] bg-white p-8 print:border-slate-300">
        <div className="flex items-start justify-between gap-4 border-b border-[#ded8cd] pb-6">
          <div>
            <p className="text-sm font-semibold uppercase text-[#0f766e]">Seller authorization document</p>
            <h1 className="mt-2 text-3xl font-semibold">Certificate of Verified Sports Shop</h1>
          </div>
          <div className="rounded-[8px] bg-[#111827] p-4 text-white">
            <ShieldCheck size={32} />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ["Shop name", shop.name],
            ["Legal business name", shop.legalBusinessName],
            ["Public shop link", `/shop/${shop.slug}`],
            ["Network code", shop.networkCode],
            ["Staff login ID", shop.staffLoginId],
            ["Registration number", shop.businessRegistrationNumber],
            ["Tax ID", shop.taxIdentificationNumber],
            ["Owner government ID", shop.ownerGovernmentId],
            ["Credential phone", shop.credentialPhone],
            ["Credential email", shop.credentialEmail],
            ["Business address", shop.credentialAddress],
            ["Verification status", titleCase(shop.verificationStatus)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-[#ded8cd] p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
              <p className="mt-1 font-semibold">{value || "Not provided"}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[8px] bg-[#f6f4ef] p-5 text-sm leading-6 text-slate-700">
          This document records that the shop above has been captured in Eugene Jersey Management with business credential information.
          Public marketplace visibility is valid only when the verification status is Verified and the shop remains active.
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Verified by</p>
            <p className="mt-1 font-semibold">{shop.verifiedBy?.name ?? "Pending super-admin approval"}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Verification date</p>
            <p className="mt-1 font-semibold">{shop.verifiedAt ? shortDate(shop.verifiedAt) : "Pending"}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
