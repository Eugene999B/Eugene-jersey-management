import { ArrowLeft, Layers3, Scissors, ShieldCheck, Usb } from "lucide-react";
import { GuidedProductionWorkflow } from "@/components/design/guided-production-workflow";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productionSetupRecord, readProductionLibrary } from "@/lib/production-specs";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";

const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8d1c5] bg-white px-4 text-sm font-semibold text-slate-800";

export default async function GuidedDesignProductionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(permissions.designs);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const query = await searchParams;
  const requestedDesignId = typeof query.design === "string" ? query.design : undefined;
  const library = readProductionLibrary(shop.productionSetup);

  const [designs, briefs] = await Promise.all([
    prisma.designJob.findMany({
      where: { shopId: shop.id },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        canvasJson: true,
        customer: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.designProductionBrief.findMany({
      where: { shopId: shop.id },
      select: {
        id: true,
        designJobId: true,
        garmentId: true,
        garmentSize: true,
        placementId: true,
        materialId: true,
        status: true,
        reviewedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const activeMaterials = library.materials.filter((item) => item.isActive);
  const activeGarments = library.garments.filter((item) => item.isActive);
  const activePlacements = library.placements.filter((item) => item.isActive);
  const missingLibrary = !activeMaterials.length || !activeGarments.length || !activePlacements.length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Printing and production"
        title="Guided production"
        description="Turn saved Design Studio artwork into a real garment job by choosing the exact garment, size, placement and material, checking physical dimensions, approving the production snapshot, then continuing to the controlled cutter queue."
        actions={<><a href="/dashboard/designs" className={linkClass}><ArrowLeft size={16} /> Design Studio</a><a href="/dashboard/designs/materials" className={linkClass}><Layers3 size={16} /> Materials & recipes</a><a href="/dashboard/designs/production" className={linkClass}><Usb size={16} /> Cutter operations</a><Badge tone="blue"><ShieldCheck size={14} /> Explicit production choices</Badge></>}
      />

      <FeedbackState
        state="info"
        title="One human workflow from artwork to the machine"
        description="Design Studio remains the precise artwork editor. This guided layer adds the physical garment context, fit checks and immutable reviewed recipe before the existing direct-cutter safety workflow."
      />

      {missingLibrary ? (
        <FeedbackState
          state="warning"
          title="Complete the production library first"
          description="At least one active material recipe, garment profile and placement template is required before a production review can be approved."
          action={<a href="/dashboard/designs/materials" className={linkClass}><Scissors size={16} /> Configure production library</a>}
        />
      ) : null}

      <GuidedProductionWorkflow
        designs={designs.flatMap((design) => {
          if (!design.canvasJson || typeof design.canvasJson !== "object" || Array.isArray(design.canvasJson)) return [];
          return [{
            id: design.id,
            title: design.title,
            customer: design.customer?.name ?? null,
            updatedAt: design.updatedAt.toISOString(),
            canvas: productionSetupRecord(design.canvasJson),
          }];
        })}
        materials={activeMaterials}
        garments={activeGarments}
        placements={activePlacements}
        initialBriefs={briefs.map((brief) => ({
          id: brief.id,
          designJobId: brief.designJobId,
          garmentId: brief.garmentId,
          garmentSize: brief.garmentSize,
          placementId: brief.placementId,
          materialId: brief.materialId,
          status: brief.status,
          reviewedAt: brief.reviewedAt?.toISOString() ?? null,
        }))}
        initialDesignId={requestedDesignId}
      />
    </div>
  );
}
