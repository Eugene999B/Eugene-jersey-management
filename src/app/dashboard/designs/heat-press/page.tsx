import { ArrowLeft, Layers3, Scissors, ShieldCheck, Usb } from "lucide-react";
import { HeatPressWorkflowConsole } from "@/components/design/heat-press-workflow-console";
import { Badge } from "@/components/ui/badge";
import { FeedbackState } from "@/components/ui/feedback-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { heatPressRecipeFromBrief } from "@/lib/heat-press-workflow";
import { permissions } from "@/lib/rbac";
import { getTenantContext } from "@/lib/tenant";

const linkClass = "inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8d1c5] bg-white px-4 text-sm font-semibold text-slate-800";

function dateTime(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function HeatPressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(permissions.designs);
  const { shop } = await getTenantContext();
  if (!shop) return null;
  const query = await searchParams;
  const requestedBrief = typeof query.brief === "string" ? query.brief : null;
  const requestedDesign = typeof query.design === "string" ? query.design : null;

  const reviewedBriefs = await prisma.designProductionBrief.findMany({
    where: { shopId: shop.id, status: "REVIEWED" },
    select: {
      id: true,
      designJobId: true,
      garmentSize: true,
      materialSnapshot: true,
      garmentSnapshot: true,
      placementSnapshot: true,
      reviewedAt: true,
    },
    orderBy: { reviewedAt: "desc" },
    take: 100,
  });

  if (!reviewedBriefs.length) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Printing and production" title="Heat press" description="Execute the manual pressing process from a reviewed garment-production snapshot." actions={<a className={linkClass} href="/dashboard/designs/workflow"><ArrowLeft size={16} /> Guided production</a>} />
        <FeedbackState state="warning" title="No reviewed production job is ready for pressing" description="Save Design Studio artwork and approve its garment, exact size, placement and material in Guided production first." action={<a className={linkClass} href="/dashboard/designs/workflow"><Scissors size={16} /> Open Guided production</a>} />
      </div>
    );
  }

  const selectedBrief = reviewedBriefs.find((brief) => brief.id === requestedBrief)
    ?? reviewedBriefs.find((brief) => brief.designJobId === requestedDesign)
    ?? reviewedBriefs[0];

  const [design, runs] = await Promise.all([
    prisma.designJob.findFirst({
      where: { id: selectedBrief.designJobId, shopId: shop.id },
      select: {
        id: true,
        title: true,
        customer: { select: { name: true } },
        order: { select: { id: true, receiptNumber: true } },
      },
    }),
    prisma.heatPressRun.findMany({
      where: { shopId: shop.id, designProductionBriefId: selectedBrief.id },
      orderBy: { attemptNumber: "desc" },
      take: 20,
    }),
  ]);

  if (!design) {
    return <FeedbackState state="error" title="Reviewed production artwork is unavailable" description="The production brief exists, but its saved Design Studio job could not be found in this shop." />;
  }

  const run = runs[0] ?? null;
  const [events, evidence] = run ? await Promise.all([
    prisma.heatPressEvent.findMany({ where: { shopId: shop.id, heatPressRunId: run.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.heatPressEvidence.findMany({ where: { shopId: shop.id, heatPressRunId: run.id }, select: { id: true, mimeType: true, byteLength: true, sha256: true, uploadedById: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]) : [[], []];

  const userIds = [...new Set([
    ...events.map((event) => event.createdById),
    ...evidence.map((item) => item.uploadedById),
  ])];
  const users = userIds.length ? await prisma.user.findMany({ where: { shopId: shop.id, id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const userNames = new Map(users.map((user) => [user.id, user.name]));
  const recipe = heatPressRecipeFromBrief(selectedBrief);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Printing and production"
        title="Heat press"
        description="Guide, time, inspect and record the real manual heat-press process from the approved garment/material snapshot."
        actions={<><a className={linkClass} href={`/dashboard/designs/workflow?design=${encodeURIComponent(selectedBrief.designJobId)}`}><ArrowLeft size={16} /> Production review</a><a className={linkClass} href={`/dashboard/designs/production?design=${encodeURIComponent(selectedBrief.designJobId)}`}><Usb size={16} /> Cutter operations</a><a className={linkClass} href="/dashboard/designs/materials"><Layers3 size={16} /> Materials & recipes</a><Badge tone="blue"><ShieldCheck size={14} /> Manual operator control</Badge></>}
      />

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="grid flex-1 gap-1.5 text-sm font-semibold text-slate-700">Reviewed production job<select className="field max-w-2xl" defaultValue={selectedBrief.id} onChange={undefined}>{reviewedBriefs.map((brief) => <option key={brief.id} value={brief.id}>{brief.id === selectedBrief.id ? `${design.title} — reviewed ${dateTime(brief.reviewedAt)}` : `Reviewed job ${brief.designJobId.slice(0, 10)}… — ${dateTime(brief.reviewedAt)}`}</option>)}</select></label>
          <div className="flex flex-wrap gap-2">{reviewedBriefs.slice(0, 8).map((brief, index) => <a key={brief.id} href={`/dashboard/designs/heat-press?brief=${encodeURIComponent(brief.id)}`} className={`inline-flex min-h-10 items-center rounded-xl border px-3 text-sm font-semibold ${brief.id === selectedBrief.id ? "border-[var(--shop-primary)] bg-[color:var(--shop-primary)]/10 text-[var(--shop-primary)]" : "border-[#ded8cd] bg-white"}`}>{brief.id === selectedBrief.id ? "Current" : `Job ${index + 1}`}</a>)}</div>
        </div>
      </section>

      <HeatPressWorkflowConsole
        briefId={selectedBrief.id}
        designTitle={design.title}
        customerName={design.customer?.name ?? null}
        orderHref={design.order ? `/dashboard/orders/${encodeURIComponent(design.order.id)}` : null}
        recipe={recipe}
        run={run ? {
          id: run.id,
          attemptNumber: run.attemptNumber,
          status: run.status,
          timerMode: run.timerMode,
          timerStartedAt: run.timerStartedAt?.toISOString() ?? null,
          timerElapsedMs: run.timerElapsedMs,
          firstPressElapsedMs: run.firstPressElapsedMs,
          repressElapsedMs: run.repressElapsedMs,
          firstPressCompletedAt: run.firstPressCompletedAt?.toISOString() ?? null,
          peelCompletedAt: run.peelCompletedAt?.toISOString() ?? null,
          repressCompletedAt: run.repressCompletedAt?.toISOString() ?? null,
          qualityChecklist: run.qualityChecklist,
          qualityPassedAt: run.qualityPassedAt?.toISOString() ?? null,
          reworkReason: run.reworkReason,
          pressTemperatureC: run.pressTemperatureC,
          pressDurationSeconds: run.pressDurationSeconds,
          pressure: run.pressure,
          peelType: run.peelType,
          repressSeconds: run.repressSeconds,
          updatedAt: run.updatedAt.toISOString(),
        } : null}
        events={events.map((event) => ({
          id: event.id,
          type: event.type,
          timerMode: event.timerMode,
          elapsedMs: event.elapsedMs,
          note: event.note,
          createdAt: event.createdAt.toISOString(),
          createdByName: userNames.get(event.createdById) ?? "Shop operator",
        }))}
        evidence={evidence.map((item) => ({
          id: item.id,
          mimeType: item.mimeType,
          byteLength: item.byteLength,
          sha256: item.sha256,
          createdAt: item.createdAt.toISOString(),
          uploadedByName: userNames.get(item.uploadedById) ?? "Shop operator",
          url: `/api/heat-press-evidence/${encodeURIComponent(item.id)}`,
        }))}
      />

      {runs.length > 1 ? <section className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-4 sm:p-5"><h2 className="font-bold">Previous attempts</h2><p className="mt-1 text-sm text-slate-500">Rework never overwrites the failed attempt.</p></div><div className="divide-y divide-[#ded8cd]">{runs.slice(1).map((previous) => <div key={previous.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[120px_180px_1fr]"><strong>Attempt {previous.attemptNumber}</strong><Badge tone={previous.status === "PASSED" ? "green" : previous.status === "REWORK_REQUIRED" ? "red" : "slate"}>{previous.status.toLowerCase().replaceAll("_", " ")}</Badge><span className="text-slate-600">{previous.reworkReason ?? `Updated ${dateTime(previous.updatedAt)}`}</span></div>)}</div></section> : null}
    </div>
  );
}
