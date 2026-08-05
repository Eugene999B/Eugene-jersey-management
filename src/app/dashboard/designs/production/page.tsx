import { ArrowLeft, ShieldCheck, Usb } from "lucide-react";
import { CutterOperationsConsole } from "@/components/design/cutter-operations-console";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { ensureShopMachineProfiles } from "@/lib/design-machine-profile-server";
import { prisma } from "@/lib/db";
import { listMachineProductionJobs } from "@/lib/machine-production-jobs";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";

export default async function CutterProductionPage() {
  await requireRole(permissions.designs);
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [designs, profiles, jobs] = await Promise.all([
    prisma.designJob.findMany({
      where: { shopId: shop.id },
      select: { id: true, title: true, updatedAt: true, canvasJson: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    ensureShopMachineProfiles(shop.id),
    listMachineProductionJobs(shop.id, 60),
  ]);

  const savedDesigns = designs.flatMap((design) => {
    if (!design.canvasJson || typeof design.canvasJson !== "object" || Array.isArray(design.canvasJson)) return [];
    return [{
      id: design.id,
      title: design.title,
      updatedAt: design.updatedAt.toISOString(),
      canvas: design.canvasJson as Record<string, unknown>,
    }];
  });
  const directProfiles = profiles.filter((profile) => profile.isActive && profile.outputFormat === "HPGL" && profile.connectionMode === "WEB_SERIAL");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Design Studio production"
        title="Cutter operations"
        description="Turn saved artwork into one controlled HPGL queue job, verify the photographed roll-fed cutter setup, connect the exact serial device, and retain every send attempt for recovery and audit."
        actions={<><LinkButton href="/dashboard/designs" variant="outline"><ArrowLeft size={16} /> Back to studio</LinkButton><Badge tone="blue"><ShieldCheck size={14} /> Saved artwork only</Badge></>}
      />

      <FeedbackState
        state="info"
        title="Direct machine communication with human safety gates"
        description="Compatible HPGL cutters connect directly through Chrome or Edge Web Serial. The operator must load and align material, set blade and origin, run the cutter-panel test cut, prepare a durable job, and confirm the final transmission. Printers and non-HPGL devices continue through their honest system, RIP or vendor-software routes."
      />

      {!savedDesigns.length || !directProfiles.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {!savedDesigns.length ? <FeedbackState state="empty" title="No saved artwork is ready" description="Open Design Studio, create the production artwork and save the project before entering machine operations." /> : null}
          {!directProfiles.length ? <FeedbackState state="warning" title="No direct HPGL cutter profile" description="An owner or manager must identify the cutter, choose HPGL and Direct browser serial connection, then record its bed, baud rate and USB identity when known." /> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
        <p className="flex items-center gap-2 font-bold"><Usb size={17} /> Computer and browser requirement</p>
        <p className="mt-1 leading-6">Use current Chrome or Edge on the Windows computer physically connected to the cutter. The browser always asks the operator to choose the port; the server never opens local hardware by itself.</p>
      </div>

      <CutterOperationsConsole
        designs={savedDesigns}
        machineProfiles={directProfiles}
        initialJobs={jobs.map((job) => ({
          id: job.id,
          designJobId: job.designJobId,
          designTitle: job.designTitle,
          machineProfileId: job.machineProfileId,
          machineName: job.machineName,
          manufacturer: job.manufacturer,
          model: job.model,
          createdByName: job.createdByName,
          jobName: job.jobName,
          material: job.material,
          materialWidthMm: job.materialWidthMm,
          sheetWidthMm: job.sheetWidthMm,
          sheetHeightMm: job.sheetHeightMm,
          mirror: job.mirror,
          origin: job.origin,
          payloadHash: job.payloadHash,
          pathCount: job.pathCount,
          byteLength: job.byteLength,
          status: job.status,
          attemptCount: job.attemptCount,
          lastError: job.lastError,
          sentAt: job.sentAt?.toISOString() ?? null,
          createdAt: job.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
