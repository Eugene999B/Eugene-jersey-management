import { Activity, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type ActivityPageProps = { searchParams?: Promise<{ q?: string; scope?: string }> };

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("activity");
  const logs = await prisma.auditLog.findMany({ include: { user: true, shop: true }, orderBy: { createdAt: "desc" }, take: 150 });
  const query = params.q?.trim().toLocaleLowerCase() ?? "";
  const scope = params.scope ?? "all";
  const visible = logs.filter((log) => {
    const haystack = `${log.action} ${log.entityType ?? ""} ${log.entityId ?? ""} ${log.user?.email ?? ""} ${log.shop?.name ?? ""}`.toLocaleLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesScope = scope === "all" || (scope === "platform" && !log.shopId) || (scope === "tenant" && Boolean(log.shopId)) || (scope === "security" && log.action.startsWith("auth."));
    return matchesQuery && matchesScope;
  });

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Audit and accountability</p><h1 className="mt-2 text-3xl font-semibold">Activity logs</h1><p className="mt-2 text-sm text-slate-600">Trace platform and tenant administrative actions without mixing them into operational pages.</p></div>
      <form className="panel grid gap-3 p-4 sm:grid-cols-[1fr_190px_auto]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="field pl-10" name="q" defaultValue={params.q ?? ""} placeholder="Search action, user, shop or entity" /></label><label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><select className="field pl-10" name="scope" defaultValue={scope}><option value="all">All activity</option><option value="platform">Platform only</option><option value="tenant">Tenant activity</option><option value="security">Authentication</option></select></label><button className="rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">Apply filters</button></form>
      <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-[#ded8cd] p-5"><div className="flex items-center gap-2"><Activity size={19} /><h2 className="text-xl font-semibold">Recorded events</h2></div><span className="text-sm font-semibold text-slate-500">{visible.length} shown</span></div><div className="divide-y divide-[#ded8cd] bg-white">{visible.map((log) => <article key={log.id} className="grid gap-3 p-4 text-sm lg:grid-cols-[minmax(0,1fr)_220px]"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{log.action}</p><Badge tone={log.shopId ? "blue" : "green"}>{log.shop?.name ?? "Platform"}</Badge></div><p className="mt-1 text-slate-500">{log.user?.email ?? "System"}{log.entityType ? ` · ${log.entityType}` : ""}{log.entityId ? ` · ${log.entityId}` : ""}</p></div><p className="text-slate-500 lg:text-right">{shortDate(log.createdAt)}</p></article>)}{!visible.length ? <p className="p-8 text-center text-sm text-slate-500">No activity matches the selected filters.</p> : null}</div></section>
    </div>
  );
}
