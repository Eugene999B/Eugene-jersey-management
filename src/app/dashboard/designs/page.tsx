import { Palette, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DesignStudio } from "@/components/design/design-studio";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { shortDate, titleCase } from "@/lib/format";

export default async function DesignsPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const recentJobs = await prisma.designJob.findMany({
    where: { shopId: shop.id },
    include: { customer: true, order: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Design studio</h1>
          <p className="mt-2 text-sm text-slate-500">Create jersey mockups, export production SVGs, and connect designs to orders.</p>
        </div>
        <Badge tone="blue"><WandSparkles size={14} /> Machine-ready foundation</Badge>
      </div>

      <DesignStudio />

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5">
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-[var(--shop-primary)]" />
            <h2 className="text-lg font-semibold">Recent design jobs</h2>
          </div>
        </div>
        <div className="divide-y divide-[#ded8cd] bg-white">
          {recentJobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold">{job.title}</p>
                <p className="text-slate-500">{job.customer?.name ?? "No customer"} - {job.machineProfile ?? "Generic SVG"}</p>
              </div>
              <div className="flex items-center gap-2">
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
