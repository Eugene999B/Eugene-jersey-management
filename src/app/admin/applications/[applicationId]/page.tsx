import { BillingCycle, BusinessApplicationStatus, BusinessApplicationType, Role } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  approveShopBusinessApplicationAction,
  approveSupplierBusinessApplicationAction,
  rejectBusinessApplicationAction,
  requestBusinessApplicationChangesAction,
  startBusinessApplicationReviewAction,
} from "@/app/admin/applications/actions";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { currency, shortDate, titleCase } from "@/lib/format";
import { formatGhanaLocation } from "@/lib/ghana-locations";
import { sortSubscriptionPlans } from "@/lib/subscription-plans";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ applicationId: string }>;
  searchParams?: Promise<{ error?: string; reviewing?: string; updated?: string; approved?: string; shopId?: string; supplierId?: string }>;
};

function slugSuggestion(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "new-shop";
}

function loginSuggestion(type: BusinessApplicationType, name: string) {
  const prefix = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, 3).join("-").slice(0, 24) || type;
  return `${type === BusinessApplicationType.SHOP ? "SHOP" : "SUP"}-${prefix}`.slice(0, 40);
}

function isReviewable(status: BusinessApplicationStatus) {
  return status === BusinessApplicationStatus.SUBMITTED || status === BusinessApplicationStatus.UNDER_REVIEW || status === BusinessApplicationStatus.CHANGES_REQUESTED;
}

function statusTone(status: BusinessApplicationStatus): "green" | "red" | "orange" | "blue" | "neutral" {
  if (status === BusinessApplicationStatus.APPROVED) return "green";
  if (status === BusinessApplicationStatus.REJECTED) return "red";
  if (status === BusinessApplicationStatus.CHANGES_REQUESTED) return "orange";
  if (status === BusinessApplicationStatus.WITHDRAWN) return "neutral";
  return "blue";
}

export default async function BusinessApplicationDetailPage({ params, searchParams }: Props) {
  const { applicationId } = await params;
  const query = (await searchParams) ?? {};
  await requirePlatformPermission("shops");
  const application = await platformDb.businessApplication.findUnique({ where: { id: applicationId } });
  if (!application) notFound();

  const [reviewers, shops, plans, approvedShop, approvedSupplier, applicationLocation] = await Promise.all([
    platformDb.user.findMany({ where: { role: Role.SUPER_ADMIN, shopId: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    platformDb.shop.findMany({ where: { isActive: true }, select: { id: true, name: true, city: true }, orderBy: { name: "asc" }, take: 500 }),
    platformDb.subscriptionPlan.findMany({ where: { isConfigured: true, isActive: true }, orderBy: { tier: "asc" } }),
    application.approvedShopId ? platformDb.shop.findUnique({ where: { id: application.approvedShopId }, select: { id: true, name: true, slug: true, staffLoginId: true, verificationStatus: true } }) : null,
    application.approvedSupplierId ? platformDb.supplier.findUnique({ where: { id: application.approvedSupplierId }, select: { id: true, name: true, shopId: true, portalUser: { select: { adminLoginId: true, email: true } } } }) : null,
    platformDb.businessApplicationLocation.findUnique({ where: { applicationId: application.id } }),
  ]);
  const reviewerNames = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name]));
  const shopNames = new Map(shops.map((shop) => [shop.id, shop.name]));
  const sortedPlans = sortSubscriptionPlans(plans);
  const requestedShop = application.requestedShopId ? shopNames.get(application.requestedShopId) : null;
  const expectedUpdatedAt = application.updatedAt.toISOString();
  const reviewable = isReviewable(application.status);
  const structuredLocationLabel = applicationLocation
    ? formatGhanaLocation({
        region: applicationLocation.region,
        district: applicationLocation.district,
        town: applicationLocation.town,
        area: applicationLocation.area,
      })
    : [application.city, application.region].filter(Boolean).join(", ") || "Not supplied";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><Link className="text-sm font-semibold text-slate-500 hover:text-slate-950" href="/admin/applications">Back to applications</Link><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{application.reference}</p><h1 className="mt-2 text-3xl font-semibold">{application.businessName}</h1><div className="mt-3 flex flex-wrap gap-2"><Badge tone={statusTone(application.status)}>{titleCase(application.status)}</Badge><Badge>{titleCase(application.type)}</Badge>{application.assignedReviewerId ? <Badge tone="blue">Reviewer: {reviewerNames.get(application.assignedReviewerId) ?? "Former administrator"}</Badge> : <Badge tone="orange">Unassigned</Badge>}</div></div>{application.requestedShopId ? <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold" href={`/admin/investigate/shops/${application.requestedShopId}`}>Investigate requested shop</Link> : null}</div>

      {query.reviewing ? <Notice tone="green">The application is now under review and assigned to you.</Notice> : null}
      {query.updated ? <Notice tone="green">The application decision was saved and the public status was updated.</Notice> : null}
      {query.approved === "shop" ? <Notice tone="green">The shop and owner account were created. Deliver the temporary credential out of band, then complete shop verification and payment routing separately.</Notice> : null}
      {query.approved === "supplier" ? <Notice tone="green">The supplier and portal account were created under the approved shop relationship. Deliver the temporary credential out of band.</Notice> : null}
      {query.error ? <Notice tone="amber">The action was not applied. Check the status, selected plan or shop, unique Login ID, email and temporary credential. The application may also have changed since this page loaded.</Notice> : null}

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <article className="panel p-5"><h2 className="text-xl font-semibold">Applicant information</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[
            ["Business name", application.businessName], ["Legal name", application.legalBusinessName ?? "Not supplied"], ["Registration", application.businessRegistrationNumber ?? "Not supplied"], ["Tax ID", application.taxIdentificationNumber ?? "Not supplied"], ["Contact", application.contactName], ["Email", application.email], ["Phone", application.phone], ["Business location", structuredLocationLabel], ["Country", applicationLocation?.country ?? application.country], ["Categories", application.categories ?? "Not supplied"], ["Requested shop", requestedShop ?? (application.type === BusinessApplicationType.SHOP ? "New tenant workspace" : "Unavailable")],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>)}</div>{applicationLocation ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"><h3 className="font-semibold text-emerald-950">Structured Ghana location</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[
            ["Region", applicationLocation.region],
            ["District", applicationLocation.district],
            ["Town / community", applicationLocation.town],
            ["Suburb / area", applicationLocation.area ?? "Not supplied"],
            ["GhanaPost GPS", applicationLocation.digitalAddress ?? "Not supplied"],
            ["Street / building", applicationLocation.streetAddress ?? "Not supplied"],
            ["Landmark", applicationLocation.landmark ?? "Not supplied"],
            ["Coordinates", applicationLocation.latitude !== null && applicationLocation.longitude !== null ? `${applicationLocation.latitude}, ${applicationLocation.longitude}` : "Not supplied"],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>)}</div></div> : application.address ? <TextBlock label="Legacy business address" value={application.address} /> : null}{application.requestedServices ? <TextBlock label="Requested services" value={application.requestedServices} /> : null}{application.applicantNotes ? <TextBlock label="Applicant notes" value={application.applicantNotes} /> : null}<p className="mt-4 text-xs text-slate-500">Consent recorded {shortDate(application.consentedAt)} · submitted {shortDate(application.submittedAt)}</p></article>

          {(application.reviewNotes || application.decisionReason) ? <article className="panel p-5"><h2 className="text-xl font-semibold">Review record</h2>{application.reviewNotes ? <TextBlock label="Internal review notes" value={application.reviewNotes} /> : null}{application.decisionReason ? <TextBlock label="Applicant-facing decision message" value={application.decisionReason} /> : null}</article> : null}

          {approvedShop ? <article className="panel p-5"><h2 className="text-xl font-semibold">Approved shop record</h2><p className="mt-3 font-semibold">{approvedShop.name}</p><p className="mt-1 text-sm text-slate-500">/{approvedShop.slug} · Login ID {approvedShop.staffLoginId ?? "not assigned"} · {titleCase(approvedShop.verificationStatus)}</p><div className="mt-4 flex flex-wrap gap-3"><Link className="text-sm font-semibold text-[#0f766e] hover:underline" href={`/admin/shops/${approvedShop.id}`}>Open shop controls</Link><Link className="text-sm font-semibold text-slate-600 hover:underline" href={`/admin/investigate/shops/${approvedShop.id}`}>Open investigation profile</Link></div></article> : null}
          {approvedSupplier ? <article className="panel p-5"><h2 className="text-xl font-semibold">Approved supplier record</h2><p className="mt-3 font-semibold">{approvedSupplier.name}</p><p className="mt-1 text-sm text-slate-500">Login ID {approvedSupplier.portalUser?.adminLoginId ?? "not assigned"} · {approvedSupplier.portalUser?.email ?? application.email}</p><Link className="mt-4 inline-flex text-sm font-semibold text-[#0f766e] hover:underline" href={`/admin/investigate/shops/${approvedSupplier.shopId}`}>Open related shop</Link></article> : null}
        </div>

        <div className="space-y-5">
          {reviewable ? <form action={startBusinessApplicationReviewAction} className="panel p-5"><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} /><h2 className="text-xl font-semibold">Review ownership</h2><p className="mt-2 text-sm leading-6 text-slate-500">Assign this application to yourself and mark it under review before making a decision.</p><Button className="mt-4">Start or resume review</Button></form> : null}

          {reviewable && application.type === BusinessApplicationType.SHOP ? <form action={approveShopBusinessApplicationAction} className="panel p-5"><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} /><h2 className="text-xl font-semibold">Approve and create shop</h2><p className="mt-2 text-sm leading-6 text-slate-500">Creates a private pending-verification shop, owner account, plan contract, payment configuration and zero communication wallets. The approved application location is copied into the new shop automatically.</p><div className="mt-4 grid gap-4">
            <Field label="Shop slug"><input className="field" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={slugSuggestion(application.businessName)} /></Field>
            <Field label="Owner Login ID"><input className="field uppercase" name="staffLoginId" required minLength={4} maxLength={40} defaultValue={loginSuggestion(application.type, application.businessName)} /></Field>
            <Field label="Subscription plan"><select className="field" name="planId" required defaultValue=""><option value="" disabled>Select a configured plan</option>{sortedPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · monthly {currency(plan.monthlyPrice?.toString() ?? "0")} · yearly {currency(plan.yearlyPrice?.toString() ?? "0")}</option>)}</select></Field>
            <Field label="Billing cycle"><select className="field" name="billingCycle" defaultValue={BillingCycle.MONTHLY}>{Object.values(BillingCycle).map((cycle) => <option key={cycle} value={cycle}>{titleCase(cycle)}</option>)}</select></Field>
            <Field label="Temporary password"><input className="field" type="password" name="temporaryPassword" required minLength={12} autoComplete="new-password" /></Field>
            <Field label="Applicant-facing approval message"><textarea className="field min-h-24 resize-y" name="decisionReason" required minLength={5} maxLength={3000} defaultValue="Your shop application was approved. Eugene Jersey Management will deliver your temporary Login ID and password through a separate secure channel." /></Field>
            <Field label="Internal review notes"><textarea className="field min-h-24 resize-y" name="reviewNotes" maxLength={5000} /></Field>
          </div><Button className="mt-4">Approve and create shop</Button></form> : null}

          {reviewable && application.type === BusinessApplicationType.SUPPLIER ? <form action={approveSupplierBusinessApplicationAction} className="panel p-5"><input type="hidden" name="applicationId" value={application.id} /><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} /><input type="hidden" name="applicationEmail" value={application.email} /><h2 className="text-xl font-semibold">Approve supplier relationship</h2><p className="mt-2 text-sm leading-6 text-slate-500">Creates one supplier and portal account under one exact active shop. It does not grant access to other tenants.</p><div className="mt-4 grid gap-4">
            <Field label="Approved shop"><select className="field" name="approvedShopId" required defaultValue={application.requestedShopId ?? ""}>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}{shop.city ? ` · ${shop.city}` : ""}</option>)}</select></Field>
            <Field label="Supplier Login ID"><input className="field uppercase" name="supplierLoginId" required minLength={4} maxLength={40} defaultValue={loginSuggestion(application.type, application.businessName)} /></Field>
            <Field label="Temporary password"><input className="field" type="password" name="temporaryPassword" required minLength={12} autoComplete="new-password" /></Field>
            <Field label="Payment terms"><input className="field" name="paymentTerms" maxLength={500} /></Field>
            <Field label="Lead time in days"><input className="field" name="leadTimeDays" type="number" min={0} max={365} defaultValue={7} /></Field>
            <Field label="Applicant-facing approval message"><textarea className="field min-h-24 resize-y" name="decisionReason" required minLength={5} maxLength={3000} defaultValue="Your supplier application was approved for the selected shop. Eugene Jersey Management will deliver your temporary portal credentials through a separate secure channel." /></Field>
            <Field label="Internal review notes"><textarea className="field min-h-24 resize-y" name="reviewNotes" maxLength={5000} /></Field>
          </div><Button className="mt-4">Approve supplier relationship</Button></form> : null}

          {reviewable ? <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><DecisionForm title="Request changes" submitLabel="Save changes request" action={requestBusinessApplicationChangesAction} applicationId={application.id} expectedUpdatedAt={expectedUpdatedAt} defaultMessage="Please provide the missing or corrected business information described in this message before the review continues." /><DecisionForm title="Reject application" submitLabel="Reject application" action={rejectBusinessApplicationAction} applicationId={application.id} expectedUpdatedAt={expectedUpdatedAt} defaultMessage="This application was not approved based on the submitted business information and current platform requirements." danger /></div> : null}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>{children}</label>;
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return <div className="mt-4 rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{value}</p></div>;
}

function Notice({ tone, children }: { tone: "green" | "amber"; children: React.ReactNode }) {
  return <div className={`rounded-xl border p-4 text-sm font-semibold ${tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{children}</div>;
}

function DecisionForm({ title, submitLabel, action, applicationId, expectedUpdatedAt, defaultMessage, danger = false }: { title: string; submitLabel: string; action: (formData: FormData) => Promise<void>; applicationId: string; expectedUpdatedAt: string; defaultMessage: string; danger?: boolean }) {
  return <form action={action} className="panel p-5"><input type="hidden" name="applicationId" value={applicationId} /><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} /><h2 className="text-xl font-semibold">{title}</h2><Field label="Applicant-facing message"><textarea className="field mt-4 min-h-28 resize-y" name="decisionReason" required minLength={5} maxLength={3000} defaultValue={defaultMessage} /></Field><Field label="Internal review notes"><textarea className="field min-h-24 resize-y" name="reviewNotes" maxLength={5000} /></Field><button type="submit" className={`mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${danger ? "border border-red-200 bg-white text-red-700" : "bg-slate-950 text-white"}`}>{submitLabel}</button></form>;
}
