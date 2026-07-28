import { BusinessApplicationStatus, BusinessApplicationType, Prisma, Role } from "@prisma/client";
import Link from "next/link";
import { ClipboardCheck, Store, Truck, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ q?: string; type?: string; status?: string; assigned?: string; error?: string }> };

function statusTone(status: BusinessApplicationStatus): "green" | "red" | "orange" | "blue" | "neutral" {
  if (status === BusinessApplicationStatus.APPROVED) return "green";
  if (status === BusinessApplicationStatus.REJECTED) return "red";
  if (status === BusinessApplicationStatus.CHANGES_REQUESTED) return "orange";
  if (status === BusinessApplicationStatus.WITHDRAWN) return "neutral";
  return "blue";
}

export default async function BusinessApplicationsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("shops");
  const query = params.q?.trim() ?? "";
  const type = Object.values(BusinessApplicationType).includes(params.type as BusinessApplicationType) ? (params.type as BusinessApplicationType) : undefined;
  const status = Object.values(BusinessApplicationStatus).includes(params.status as BusinessApplicationStatus) ? (params.status as BusinessApplicationStatus) : undefined;
  const assigned = params.assigned?.trim() || undefined;
  const text = { contains: query, mode: Prisma.QueryMode.insensitive };
  const where: Prisma.BusinessApplicationWhereInput = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(assigned === "unassigned" ? { assignedReviewerId: null } : assigned ? { assignedReviewerId: assigned } : {}),
    ...(query ? { OR: [{ reference: text }, { businessName: text }, { legalBusinessName: text }, { contactName: text }, { email: text }, { phone: text }, { businessRegistrationNumber: text }] } : {}),
  };

  const [applications, admins, shops] = await Promise.all([
    platformDb.businessApplication.findMany({ where, orderBy: [{ status: "asc" }, { submittedAt: "desc" }], take: 200 }),
    platformDb.user.findMany({ where: { role: Role.SUPER_ADMIN, shopId: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    platformDb.shop.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const adminNames = new Map(admins.map((admin) => [admin.id, admin.name]));
  const shopNames = new Map(shops.map((shop) => [shop.id, shop.name]));
  const pendingCount = applications.filter((item) => item.status === BusinessApplicationStatus.SUBMITTED).length;
  const reviewCount = applications.filter((item) => item.status === BusinessApplicationStatus.UNDER_REVIEW).length;
  const changesCount = applications.filter((item) => item.status === BusinessApplicationStatus.CHANGES_REQUESTED).length;
  const unassignedCount = applications.filter((item) => !item.assignedReviewerId && [BusinessApplicationStatus.SUBMITTED, BusinessApplicationStatus.UNDER_REVIEW].includes(item.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Business onboarding</p><h1 className="mt-2 text-3xl font-semibold">Applications</h1><p className="mt-2 text-sm text-slate-600">Review public shop and supplier applications before creating any tenant or portal access.</p></div><Link href="/apply" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold">Open public application page</Link></div>
      {params.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">The application queue could not complete that action.</div> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="New submissions" value={String(pendingCount)} icon={<ClipboardCheck size={20} />} /><StatCard label="Under review" value={String(reviewCount)} icon={<UserRoundCheck size={20} />} /><StatCard label="Changes requested" value={String(changesCount)} /><StatCard label="Unassigned" value={String(unassignedCount)} /></section>

      <section className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><form className="grid gap-2 lg:grid-cols-[1fr_150px_190px_210px_auto]"><input className="field" name="q" defaultValue={query} placeholder="Reference, business, contact, email or phone" /><select className="field" name="type" defaultValue={type ?? ""}><option value="">All types</option>{Object.values(BusinessApplicationType).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select><select className="field" name="status" defaultValue={status ?? ""}><option value="">All statuses</option>{Object.values(BusinessApplicationStatus).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select><select className="field" name="assigned" defaultValue={assigned ?? ""}><option value="">Any reviewer</option><option value="unassigned">Unassigned</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select><button type="submit" className="rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Apply</button></form></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Application</th><th className="p-4">Type</th><th className="p-4">Contact</th><th className="p-4">Requested relationship</th><th className="p-4">Status</th><th className="p-4">Reviewer</th><th className="p-4">Submitted</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">{applications.map((application) => <tr key={application.id}><td className="p-4"><Link className="font-semibold text-slate-950 hover:underline" href={`/admin/applications/${application.id}`}>{application.reference}</Link><p className="mt-1 max-w-[280px] truncate text-slate-600">{application.businessName}</p><p className="mt-1 text-xs text-slate-400">{application.businessRegistrationNumber ?? "No registration number"}</p></td><td className="p-4"><span className="inline-flex items-center gap-2 font-semibold">{application.type === BusinessApplicationType.SHOP ? <Store size={16} /> : <Truck size={16} />}{titleCase(application.type)}</span></td><td className="p-4"><p className="font-semibold">{application.contactName}</p><p className="mt-1 text-xs text-slate-500">{application.email}</p><p className="text-xs text-slate-500">{application.phone}</p></td><td className="p-4">{application.type === BusinessApplicationType.SUPPLIER ? shopNames.get(application.requestedShopId ?? "") ?? "Requested shop unavailable" : "New tenant workspace"}</td><td className="p-4"><Badge tone={statusTone(application.status)}>{titleCase(application.status)}</Badge></td><td className="p-4">{application.assignedReviewerId ? adminNames.get(application.assignedReviewerId) ?? "Former administrator" : <span className="text-slate-500">Unassigned</span>}</td><td className="p-4 text-slate-500">{shortDate(application.submittedAt)}</td></tr>)}{!applications.length ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">No applications match these filters.</td></tr> : null}</tbody></table></div>
      </section>
    </div>
  );
}
