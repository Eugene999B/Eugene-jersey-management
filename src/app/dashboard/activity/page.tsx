import { Activity, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { shortDate, titleCase } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";

export default async function ActivityPage() {
  await requireRole(permissions.activity);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const logs = await prisma.auditLog.findMany({
    where: { shopId: shop.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Activity logs</h1>
          <p className="mt-2 text-sm text-slate-500">Staff actions, security events, catalog edits, payments, and reminders.</p>
        </div>
        <Badge tone="green"><ShieldCheck size={14} /> Audited</Badge>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-lg font-semibold">Latest shop events</h2>
          </div>
        </div>
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
            <tr><th className="p-4">Action</th><th className="p-4">User</th><th className="p-4">Entity</th><th className="p-4">Date</th></tr>
          </thead>
          <tbody className="divide-y divide-[#ded8cd] bg-white">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="p-4 font-semibold">{log.action}</td>
                <td className="p-4">{log.user?.name ?? "System"}<p className="text-xs text-slate-500">{log.user?.email ?? ""}</p></td>
                <td className="p-4"><Badge>{titleCase(log.entityType)}</Badge></td>
                <td className="p-4 text-slate-500">{shortDate(log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length ? <p className="p-5 text-sm text-slate-500">No activity recorded yet.</p> : null}
      </section>
    </div>
  );
}
