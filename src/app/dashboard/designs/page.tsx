import { Palette, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DesignStudioAdvanced } from "@/components/design/production-studio-advanced";
import { ensureShopMachineProfiles } from "@/lib/design-machine-profile-server";
import { prisma } from "@/lib/db";
import { shortDate, titleCase } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";

export default async function DesignsPage() {
  const session = await requireRole(permissions.designs);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [recentJobs, machineProfiles] = await Promise.all([
    prisma.designJob.findMany({
      where: { shopId: shop.id },
      include: { customer: true, order: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    ensureShopMachineProfiles(shop.id),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Design Studio</h1>
          <p className="mt-2 text-sm text-slate-500">Create layered artwork on the real production material, preserve immutable shop versions, and produce vector-only cut files through this shop&apos;s own machine profiles.</p>
        </div>
        <Badge tone="blue"><ShieldCheck size={14} /> Shop-scoped production workflow</Badge>
      </div>

      <div className="mobile-design-studio">
        <DesignStudioAdvanced
          recoveryScope={`${shop.id}:${session.id}`}
          initialMachineProfiles={machineProfiles}
          canManageMachineProfiles={session.role === "OWNER" || session.role === "MANAGER"}
          savedDesigns={recentJobs.map((job) => ({
            id: job.id,
            title: job.title,
            updatedAt: job.updatedAt.toISOString(),
            canvas: job.canvasJson && typeof job.canvasJson === "object" && !Array.isArray(job.canvasJson)
              ? job.canvasJson as Record<string, unknown>
              : {},
          }))}
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-lg font-semibold">Recent design jobs</h2>
          </div>
        </div>
        <div className="divide-y divide-[#ded8cd] bg-white">
          {recentJobs.map((job) => (
            <div key={job.id} className="grid gap-3 p-4 text-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">{job.title}</p>
                <p className="break-words text-slate-500">{job.customer?.name ?? "No customer"} - {job.machineProfile ?? "Generic SVG cutter"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{titleCase(job.status)}</Badge>
                <span className="text-slate-500">{shortDate(job.updatedAt)}</span>
              </div>
            </div>
          ))}
          {!recentJobs.length ? <p className="p-5 text-sm text-slate-500">No saved design jobs yet. Use the studio above to prepare production artwork.</p> : null}
        </div>
      </section>
    </div>
  );
}
