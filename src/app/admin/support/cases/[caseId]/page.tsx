import { NotificationStatus, PaymentStatus, Role, SupportCasePriority, SupportCaseStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, FileText, ShieldAlert, Store, UserRoundCog } from "lucide-react";
import { addSupportCaseNoteAction, updateSupportCaseAction } from "@/app/admin/support/case-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<{ created?: string; updated?: string; error?: string }>;
};

function statusTone(status: SupportCaseStatus): "green" | "orange" | "blue" | "neutral" {
  if (status === SupportCaseStatus.RESOLVED) return "green";
  if (status === SupportCaseStatus.CLOSED) return "neutral";
  if ([SupportCaseStatus.WAITING_ON_PROVIDER, SupportCaseStatus.WAITING_ON_SHOP].includes(status)) return "orange";
  return "blue";
}

export default async function SupportCaseDetailPage({ params, searchParams }: Props) {
  const { caseId } = await params;
  const query = (await searchParams) ?? {};
  await requirePlatformPermission("support");
  const supportCase = await platformDb.supportCase.findUnique({ where: { id: caseId }, include: { notes: { orderBy: { createdAt: "desc" } } } });
  if (!supportCase) notFound();

  const authorIds = [...new Set([supportCase.openedById, supportCase.assignedToId, ...supportCase.notes.map((note) => note.authorId)].filter((value): value is string => Boolean(value)))];
  const [admins, people, shop, supplier] = await Promise.all([
    platformDb.user.findMany({ where: { role: Role.SUPER_ADMIN, shopId: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    platformDb.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } }),
    supportCase.shopId
      ? platformDb.shop.findUnique({
          where: { id: supportCase.shopId },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            verificationStatus: true,
            subscriptionStatus: true,
            planTier: true,
            storefrontEnabled: true,
            publicOrderingEnabled: true,
            _count: { select: { users: true, products: true, orders: true, debts: true } },
          },
        })
      : null,
    supportCase.supplierId ? platformDb.supplier.findUnique({ where: { id: supportCase.supplierId }, select: { id: true, name: true, email: true, phone: true, isActive: true, shopId: true } }) : null,
  ]);
  const peopleNames = new Map(people.map((person) => [person.id, person.name]));

  const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failedMessages, failedPayments, delayedOrders, recentAudit] = supportCase.shopId
    ? await Promise.all([
        platformDb.customerMessage.count({ where: { shopId: supportCase.shopId, status: NotificationStatus.FAILED } }),
        platformDb.payment.count({ where: { status: PaymentStatus.FAILED, order: { shopId: supportCase.shopId } } }),
        platformDb.order.count({ where: { shopId: supportCase.shopId, status: { in: ["PENDING", "IN_PRODUCTION"] }, createdAt: { lte: staleDate } } }),
        platformDb.auditLog.findMany({ where: { shopId: supportCase.shopId }, select: { id: true, action: true, entityType: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
      ])
    : [0, 0, 0, []];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Link className="text-sm font-semibold text-slate-500 hover:text-slate-950" href="/admin/support/cases">Back to case register</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{supportCase.reference}</p><h1 className="mt-2 text-3xl font-semibold">{supportCase.title}</h1><div className="mt-3 flex flex-wrap gap-2"><Badge tone={statusTone(supportCase.status)}>{titleCase(supportCase.status)}</Badge><Badge tone={supportCase.priority === "URGENT" ? "red" : supportCase.priority === "HIGH" ? "orange" : "blue"}>{titleCase(supportCase.priority)}</Badge><Badge>{titleCase(supportCase.category)}</Badge></div></div>
        {supportCase.shopId ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold" href={`/admin/investigate/shops/${supportCase.shopId}`}><Store size={17} /> Investigate shop</Link> : null}
      </div>

      {query.created ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">The support case was created and added to the audit trail.</div> : null}
      {query.updated ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">The case workflow was updated.</div> : null}
      {query.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">The requested update was not applied. The case may have changed, the transition may be invalid, or required information is missing.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Opened" value={shortDate(supportCase.createdAt)} icon={<Clock3 size={20} />} />
        <StatCard label="Assigned" value={supportCase.assignedToId ? peopleNames.get(supportCase.assignedToId) ?? "Former administrator" : "Unassigned"} icon={<UserRoundCog size={20} />} />
        <StatCard label="Case notes" value={String(supportCase.notes.length)} icon={<FileText size={20} />} />
        <StatCard label="Shop alerts" value={String(failedMessages + failedPayments + delayedOrders)} icon={<ShieldAlert size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <article className="panel p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Initial summary</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{supportCase.summary}</p>{supportCase.linkedEntityType ? <p className="mt-4 rounded-xl bg-white p-3 text-sm"><strong>Linked record:</strong> {supportCase.linkedEntityType} · <span className="break-all font-mono text-xs">{supportCase.linkedEntityId}</span></p> : null}</article>

          <div className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Append-only investigation notes</h2><p className="mt-1 text-sm text-slate-500">Corrections are recorded as new notes; existing notes are not edited or deleted.</p></div>
            <form action={addSupportCaseNoteAction} className="border-b border-[#ded8cd] bg-white p-5"><input type="hidden" name="caseId" value={supportCase.id} /><textarea className="field min-h-28 resize-y" name="body" required minLength={2} maxLength={5000} placeholder="Add evidence, action taken, communication or correction" /><label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" name="isInternal" value="true" defaultChecked /> Internal administrator note</label><Button className="mt-4">Add case note</Button></form>
            <div className="divide-y divide-[#ded8cd] bg-white">{supportCase.notes.map((note) => <article key={note.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{peopleNames.get(note.authorId) ?? "Former administrator"}</p><div className="flex items-center gap-2"><Badge tone={note.isInternal ? "neutral" : "blue"}>{note.isInternal ? "Internal" : "Shareable"}</Badge><span className="text-xs text-slate-500">{shortDate(note.createdAt)}</span></div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{note.body}</p></article>)}{!supportCase.notes.length ? <p className="p-5 text-sm text-slate-500">No investigation notes yet.</p> : null}</div>
          </div>
        </div>

        <div className="space-y-5">
          <form action={updateSupportCaseAction} className="panel p-5"><input type="hidden" name="caseId" value={supportCase.id} /><input type="hidden" name="expectedUpdatedAt" value={supportCase.updatedAt.toISOString()} /><h2 className="text-xl font-semibold">Case workflow</h2><div className="mt-4 grid gap-4">
            <label><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Assigned administrator</span><select className="field" name="assignedToId" defaultValue={supportCase.assignedToId ?? ""}><option value="">Unassigned</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select></label>
            <label><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Priority</span><select className="field" name="priority" defaultValue={supportCase.priority}>{Object.values(SupportCasePriority).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
            <label><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Status</span><select className="field" name="status" defaultValue={supportCase.status}>{Object.values(SupportCaseStatus).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>
            <label><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Resolution</span><textarea className="field min-h-28 resize-y" name="resolution" maxLength={5000} defaultValue={supportCase.resolution ?? ""} placeholder="Required when resolving or closing the case" /></label>
          </div><Button className="mt-4">Save workflow update</Button></form>

          {shop ? <article className="panel p-5"><div className="flex items-center gap-2"><Store size={18} /><h2 className="text-xl font-semibold">{shop.name}</h2></div><p className="mt-1 text-sm text-slate-500">/{shop.slug}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{[["Workspace", shop.isActive ? "Active" : "Suspended"], ["Verification", titleCase(shop.verificationStatus)], ["Subscription", `${shop.planTier} · ${titleCase(shop.subscriptionStatus)}`], ["Storefront", shop.storefrontEnabled ? (shop.publicOrderingEnabled ? "Online + ordering" : "Browse-only") : "Offline"], ["Users", String(shop._count.users)], ["Orders", String(shop._count.orders)], ["Products", String(shop._count.products)], ["Debts", String(shop._count.debts)]].map(([label, value]) => <div key={label} className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div></article> : null}

          {supplier ? <article className="panel p-5"><h2 className="text-xl font-semibold">Supplier subject</h2><p className="mt-3 font-semibold">{supplier.name}</p><p className="mt-1 text-sm text-slate-500">{supplier.email ?? "No email"} · {supplier.phone ?? "No phone"} · {supplier.isActive ? "Active" : "Inactive"}</p></article> : null}

          {supportCase.shopId ? <article className="panel p-5"><h2 className="text-xl font-semibold">Read-only operational evidence</h2><div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase text-slate-500">Failed messages</p><p className="mt-1 text-xl font-semibold">{failedMessages}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase text-slate-500">Failed payments</p><p className="mt-1 text-xl font-semibold">{failedPayments}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs font-bold uppercase text-slate-500">Delayed orders</p><p className="mt-1 text-xl font-semibold">{delayedOrders}</p></div></div><div className="mt-4 divide-y divide-[#ded8cd] rounded-xl bg-white">{recentAudit.map((entry) => <div key={entry.id} className="p-3 text-sm"><p className="font-semibold">{entry.action}</p><p className="mt-1 text-xs text-slate-500">{entry.entityType} · {shortDate(entry.createdAt)}</p></div>)}{!recentAudit.length ? <p className="p-3 text-sm text-slate-500">No recent audited activity.</p> : null}</div></article> : null}
        </div>
      </section>
    </div>
  );
}
