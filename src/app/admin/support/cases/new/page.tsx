import { Role, SupportCaseCategory, SupportCasePriority } from "@prisma/client";
import Link from "next/link";
import { createSupportCaseAction } from "@/app/admin/support/case-actions";
import { Button } from "@/components/ui/button";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    shopId?: string;
    subjectUserId?: string;
    supplierId?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
    error?: string;
  }>;
};

export default async function NewSupportCasePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("support");
  const [shops, admins] = await Promise.all([
    platformDb.shop.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" }, take: 500 }),
    platformDb.user.findMany({ where: { role: Role.SUPER_ADMIN, shopId: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><Link className="text-sm font-semibold text-slate-500 hover:text-slate-950" href="/admin/support/cases">Back to case register</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">New investigation</p><h1 className="mt-2 text-3xl font-semibold">Open a support case</h1><p className="mt-2 text-sm text-slate-600">Create one durable record for the issue. Evidence and corrections should be added as case notes.</p></div>
      {params.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">The case details were incomplete or referred to records outside the selected shop.</div> : null}

      <form action={createSupportCaseAction} className="panel space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Shop or platform scope</span><select className="field" name="shopId" defaultValue={params.shopId ?? ""}><option value="">Platform-wide case</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name} / {shop.slug}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Category</span><select className="field" name="category" defaultValue={SupportCaseCategory.SHOP_OPERATIONS}>{Object.values(SupportCaseCategory).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Priority</span><select className="field" name="priority" defaultValue={SupportCasePriority.NORMAL}>{Object.values(SupportCasePriority).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Title</span><input className="field" name="title" required minLength={4} maxLength={160} placeholder="Clear description of the problem" /></label>
          <label className="block md:col-span-2"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Initial investigation summary</span><textarea className="field min-h-36 resize-y" name="summary" required minLength={10} maxLength={5000} placeholder="What happened, who reported it, what is affected and what has already been checked?" /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Assign to</span><select className="field" name="assignedToId" defaultValue=""><option value="">Leave unassigned</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Linked record type</span><input className="field" name="linkedEntityType" maxLength={80} defaultValue={params.linkedEntityType ?? ""} placeholder="Order, Payment, User..." /></label>
            <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Linked record ID</span><input className="field" name="linkedEntityId" maxLength={100} defaultValue={params.linkedEntityId ?? ""} placeholder="Exact record ID" /></label>
          </div>
        </div>
        <input type="hidden" name="subjectUserId" value={params.subjectUserId ?? ""} />
        <input type="hidden" name="supplierId" value={params.supplierId ?? ""} />
        <div className="rounded-xl bg-white p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-900">Safety rule:</strong> opening a case does not impersonate a shop user, change tenant data, issue a refund or expose provider credentials. Any operational change must use its existing audited action.</div>
        <Button>Open support case</Button>
      </form>
    </div>
  );
}
