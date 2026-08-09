import { Boxes, Download, Layers3, Palette, ShieldCheck, Shirt, Usb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader
        eyebrow="Printing and production"
        title="Design Studio"
        description="Create layered production artwork in exact millimetres, preserve immutable shop versions, then use Guided production to attach the exact garment, size, placement and material before the physical cutter workflow."
        actions={<><a href="/dashboard/designs/workflow" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--shop-primary)] px-3 text-sm font-semibold text-white"><Shirt size={16} /> Guided production</a><a href="/dashboard/designs/production" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--shop-primary)] bg-white px-3 text-sm font-semibold text-[var(--shop-primary)]"><Usb size={16} /> Cutter operations</a><a href="/dashboard/designs/materials" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--shop-primary)] bg-white px-3 text-sm font-semibold text-[var(--shop-primary)]"><Layers3 size={16} /> Materials & press recipes</a><a href="/dashboard/production-stock" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--shop-primary)] bg-white px-3 text-sm font-semibold text-[var(--shop-primary)]"><Boxes size={16} /> Stock & costing</a><a href="/api/guides/design-studio" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--shop-primary)] bg-white px-3 text-sm font-semibold text-[var(--shop-primary)]"><Download size={16} /> Download quick guide</a><Badge tone="blue"><ShieldCheck size={14} /> Shop-scoped production workflow</Badge></>}
      />

      <FeedbackState
        state="info"
        title="Universal workflow coverage without unsafe protocol claims"
        description="Design Studio remains the exact millimetre artwork editor. Guided production adds explicit garment, size, placement and material checks before the existing machine-specific routes. Installed printers still use the computer print dialog, RIP/vendor workflows keep their documented route, and direct serial cutting remains limited to validated compatible HPGL profiles."
      />

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
                <a href={`/dashboard/designs/workflow?design=${encodeURIComponent(job.id)}`} className="inline-flex min-h-10 items-center rounded-xl border border-[#ded8cd] bg-white px-3 font-semibold">Prepare production</a>
                <Badge>{titleCase(job.status)}</Badge>
                <span className="text-slate-500">{shortDate(job.updatedAt)}</span>
              </div>
            </div>
          ))}
          {!recentJobs.length ? <div className="p-4 sm:p-5"><FeedbackState state="empty" title="No saved design jobs yet" description="Use the studio above to prepare and save production artwork." /></div> : null}
        </div>
      </section>
    </div>
  );
}
