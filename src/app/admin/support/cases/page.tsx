import { Prisma, Role, SupportCasePriority, SupportCaseStatus } from "@prisma/client";
import Link from "next/link";
import { FolderSearch, Plus, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ q?: string; status?: string; priority?: string; assigned?: string; error?: string }>;
};

function statusTone(status: SupportCaseStatus): "green" | "red" | "orange" | "blue" | "neutral" {
  if (status === SupportCaseStatus.RESOLVED) return "green";
  if (status === SupportCaseStatus.CLOSED) return "neutral";
  if (status === SupportCaseStatus.WAITING_ON_PROVIDER || status === SupportCaseStatus.WAITING_ON_SHOP) return "orange";
  return "blue";
}

function priorityTone(priority: SupportCasePriority): "red" | "orange" | "blue" | "neutral" {
  if (priority === SupportCasePriority.URGENT) return "red";
  if (priority === SupportCasePriority.HIGH) return "orange";
  if (priority === SupportCasePriority.NORMAL) return "blue";
  return "neutral";
}

export default async function SupportCasesPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("support");

  const query = params.q?.trim() ?? "";
  const status = Object.values(SupportCaseStatus).includes(params.status as SupportCaseStatus) ? (params.status as SupportCaseStatus) : undefined;
  const priority = Object.values(SupportCasePriority).includes(params.priority as SupportCasePriority) ? (params.priority as SupportCasePriority) : undefined;
  const assignedToId = params.assigned?.trim() || undefined;
  const where: Prisma.SupportCaseWhereInput = {
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assignedToId === "unassigned" ? { assignedToId: null } : assignedToId ? { assignedToId } : {}),
    ...(query
      ? {
          OR: [
            { reference: { contains: query, mode: "insensitive" } },
            { title: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
            { linkedEntityId: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [cases, shops, admins] = await Promise.all([
    platformDb.supportCase.findMany({ where, include: { _count: { select: { notes: true } } }, orderBy: [{ priority: "desc" }, { updatedAt: "desc" }], take: 150 }),
    platformDb.shop.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    platformDb.user.findMany({ where: { role: Role.SUPER_ADMIN, shopId: null, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const shopNames = new Map(shops.map((shop) => [shop.id, shop.name]));
  const adminNames = new Map(admins.map((admin) => [admin.id, admin.name]));
  const openCount = cases.filter((item) => ![SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED].includes(item.status)).length;
  const urgentCount = cases.filter((item) => item.priority === SupportCasePriority.URGENT && ![SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED].includes(item.status)).length;
  const unassignedCount = cases.filter((item) => !item.assignedToId && ![SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED].includes(item.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Investigation workflow</p><h1 className="mt-2 text-3xl font-semibold">Support cases</h1><p className="mt-2 text-sm text-slate-600">Track durable platform investigations, assignments, notes and resolutions.</p></div>
        <Link href="/admin/support/cases/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white"><Plus size={17} /> New case</Link>
      </div>
      {params.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">That case could not be opened or is no longer available.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Matching cases" value={String(cases.length)} icon={<FolderSearch size={20} />} />
        <StatCard label="Open workload" value={String(openCount)} />
        <StatCard label="Urgent" value={String(urgentCount)} />
        <StatCard label="Unassigned" value={String(unassignedCount)} icon={<UserRoundCheck size={20} />} />
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5">
          <form className="grid gap-2 md:grid-cols-[1fr_180px_170px_220px_auto]">
            <input className="field" name="q" defaultValue={query} placeholder="Reference, title, summary or linked ID" />
            <select className="field" name="status" defaultValue={status ?? ""}><option value="">All statuses</option>{Object.values(SupportCaseStatus).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select>
            <select className="field" name="priority" defaultValue={priority ?? ""}><option value="">All priorities</option>{Object.values(SupportCasePriority).map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select>
            <select className="field" name="assigned" defaultValue={assignedToId ?? ""}><option value="">Any assignment</option><option value="unassigned">Unassigned</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}</select>
            <button className="rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Apply</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Case</th><th className="p-4">Business</th><th className="p-4">Status</th><th className="p-4">Priority</th><th className="p-4">Assigned</th><th className="p-4">Notes</th><th className="p-4">Updated</th></tr></thead>
            <tbody className="divide-y divide-[#ded8cd] bg-white">
              {cases.map((item) => <tr key={item.id}>
                <td className="p-4"><Link className="font-semibold text-slate-950 hover:underline" href={`/admin/support/cases/${item.id}`}>{item.reference}</Link><p className="mt-1 max-w-[360px] truncate text-slate-600">{item.title}</p><p className="mt-1 text-xs text-slate-400">{titleCase(item.category)}</p></td>
                <td className="p-4">{item.shopId ? <Link className="font-semibold text-[#0f766e] hover:underline" href={`/admin/investigate/shops/${item.shopId}`}>{shopNames.get(item.shopId) ?? "Unknown shop"}</Link> : <span className="text-slate-500">Platform-wide</span>}</td>
                <td className="p-4"><Badge tone={statusTone(item.status)}>{titleCase(item.status)}</Badge></td>
                <td className="p-4"><Badge tone={priorityTone(item.priority)}>{titleCase(item.priority)}</Badge></td>
                <td className="p-4">{item.assignedToId ? adminNames.get(item.assignedToId) ?? "Former administrator" : <span className="text-slate-500">Unassigned</span>}</td>
                <td className="p-4">{item._count.notes}</td>
                <td className="p-4 text-slate-500">{shortDate(item.updatedAt)}</td>
              </tr>)}
              {!cases.length ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">No cases match the current filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
