"use server";

import {
  BillingCycle,
  BusinessApplicationStatus,
  BusinessApplicationType,
  CommunicationCreditChannel,
  Prisma,
  Role,
  ShopVerificationStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { strongPasswordSchema } from "@/lib/password-policy";
import { platformDb } from "@/lib/platform-db";
import { requirePlatformPermission } from "@/lib/platform-admin";
import { resolvePlanPrice, snapshotAsJson, subscriptionDates, subscriptionPlanSnapshot } from "@/lib/subscription-plans";

const applicationIdSchema = z.object({
  applicationId: z.string().min(1).max(100),
  expectedUpdatedAt: z.coerce.date(),
});

const decisionSchema = applicationIdSchema.extend({
  decisionReason: z.string().trim().min(5).max(3000),
  reviewNotes: z.preprocess((value) => String(value ?? "").trim() || undefined, z.string().max(5000).optional()),
});

const shopApprovalSchema = decisionSchema.extend({
  planId: z.string().min(1).max(100),
  billingCycle: z.nativeEnum(BillingCycle),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  staffLoginId: z.string().trim().min(4).max(40).transform((value) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "")),
  temporaryPassword: strongPasswordSchema,
});

const supplierApprovalSchema = decisionSchema.extend({
  approvedShopId: z.string().min(1).max(100),
  supplierLoginId: z.string().trim().min(4).max(40).transform((value) => value.toUpperCase().replace(/[^A-Z0-9-]/g, "")),
  temporaryPassword: strongPasswordSchema,
  paymentTerms: z.preprocess((value) => String(value ?? "").trim() || undefined, z.string().max(500).optional()),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(7),
});

function applicationDetailPath(id: string, query?: string) {
  return `/admin/applications/${id}${query ? `?${query}` : ""}`;
}

function isReviewable(status: BusinessApplicationStatus) {
  return status === BusinessApplicationStatus.SUBMITTED
    || status === BusinessApplicationStatus.UNDER_REVIEW
    || status === BusinessApplicationStatus.CHANGES_REQUESTED;
}

function shopNetworkCode(slug: string) {
  const prefix = slug.split("-").map((part) => part[0]).join("").slice(0, 4).toUpperCase();
  return `${prefix || "SHOP"}-${nanoid(5).toUpperCase()}`;
}

async function updateApplicationDecision(input: {
  applicationId: string;
  expectedUpdatedAt: Date;
  status: BusinessApplicationStatus;
  decisionReason: string;
  reviewNotes?: string;
  reviewerId: string;
  auditAction: string;
}) {
  return platformDb.$transaction(async (tx) => {
    const application = await tx.businessApplication.findUnique({ where: { id: input.applicationId } });
    if (!application || !isReviewable(application.status)) throw new Error("APPLICATION_NOT_REVIEWABLE");
    const changed = await tx.businessApplication.updateMany({
      where: { id: application.id, updatedAt: input.expectedUpdatedAt, status: application.status },
      data: {
        status: input.status,
        assignedReviewerId: input.reviewerId,
        reviewNotes: input.reviewNotes ?? application.reviewNotes,
        decisionReason: input.decisionReason,
        reviewedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw new Error("APPLICATION_CHANGED");
    await tx.auditLog.create({
      data: {
        userId: input.reviewerId,
        action: input.auditAction,
        entityType: "BusinessApplication",
        entityId: application.id,
        metadata: { reference: application.reference, fromStatus: application.status, toStatus: input.status },
      },
    });
    return application;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function startBusinessApplicationReviewAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const parsed = applicationIdSchema.safeParse({ applicationId: formData.get("applicationId"), expectedUpdatedAt: formData.get("expectedUpdatedAt") });
  if (!parsed.success) redirect("/admin/applications?error=invalid");

  try {
    await platformDb.$transaction(async (tx) => {
      const application = await tx.businessApplication.findUnique({ where: { id: parsed.data.applicationId } });
      if (!application || !isReviewable(application.status)) throw new Error("APPLICATION_NOT_REVIEWABLE");
      const changed = await tx.businessApplication.updateMany({
        where: { id: application.id, updatedAt: parsed.data.expectedUpdatedAt, status: application.status },
        data: { status: BusinessApplicationStatus.UNDER_REVIEW, assignedReviewerId: session.id },
      });
      if (changed.count !== 1) throw new Error("APPLICATION_CHANGED");
      await tx.auditLog.create({ data: { userId: session.id, action: "admin.business_application_review_started", entityType: "BusinessApplication", entityId: application.id, metadata: { reference: application.reference, type: application.type } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(applicationDetailPath(parsed.data.applicationId, "error=changed"));
  }
  revalidatePath("/admin/applications");
  revalidatePath(applicationDetailPath(parsed.data.applicationId));
  redirect(applicationDetailPath(parsed.data.applicationId, "reviewing=true"));
}

export async function requestBusinessApplicationChangesAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const parsed = decisionSchema.safeParse({ applicationId: formData.get("applicationId"), expectedUpdatedAt: formData.get("expectedUpdatedAt"), decisionReason: formData.get("decisionReason"), reviewNotes: formData.get("reviewNotes") });
  if (!parsed.success) redirect(applicationDetailPath(String(formData.get("applicationId") ?? ""), "error=invalid"));
  try {
    await updateApplicationDecision({ ...parsed.data, status: BusinessApplicationStatus.CHANGES_REQUESTED, reviewerId: session.id, auditAction: "admin.business_application_changes_requested" });
  } catch {
    redirect(applicationDetailPath(parsed.data.applicationId, "error=changed"));
  }
  revalidatePath("/admin/applications");
  redirect(applicationDetailPath(parsed.data.applicationId, "updated=true"));
}

export async function rejectBusinessApplicationAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const parsed = decisionSchema.safeParse({ applicationId: formData.get("applicationId"), expectedUpdatedAt: formData.get("expectedUpdatedAt"), decisionReason: formData.get("decisionReason"), reviewNotes: formData.get("reviewNotes") });
  if (!parsed.success) redirect(applicationDetailPath(String(formData.get("applicationId") ?? ""), "error=invalid"));
  try {
    await updateApplicationDecision({ ...parsed.data, status: BusinessApplicationStatus.REJECTED, reviewerId: session.id, auditAction: "admin.business_application_rejected" });
  } catch {
    redirect(applicationDetailPath(parsed.data.applicationId, "error=changed"));
  }
  revalidatePath("/admin/applications");
  redirect(applicationDetailPath(parsed.data.applicationId, "updated=true"));
}

export async function approveShopBusinessApplicationAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const parsed = shopApprovalSchema.safeParse({
    applicationId: formData.get("applicationId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    decisionReason: formData.get("decisionReason"),
    reviewNotes: formData.get("reviewNotes"),
    planId: formData.get("planId"),
    billingCycle: formData.get("billingCycle"),
    slug: formData.get("slug"),
    staffLoginId: formData.get("staffLoginId"),
    temporaryPassword: formData.get("temporaryPassword"),
  });
  if (!parsed.success) redirect(applicationDetailPath(String(formData.get("applicationId") ?? ""), "error=approval"));

  const [application, plan] = await Promise.all([
    platformDb.businessApplication.findUnique({ where: { id: parsed.data.applicationId } }),
    platformDb.subscriptionPlan.findUnique({ where: { id: parsed.data.planId } }),
  ]);
  if (!application || application.type !== BusinessApplicationType.SHOP || !isReviewable(application.status)) redirect(applicationDetailPath(parsed.data.applicationId, "error=state"));
  if (!plan || !plan.isConfigured || !plan.isActive || resolvePlanPrice(plan, parsed.data.billingCycle) === null) redirect(applicationDetailPath(parsed.data.applicationId, "error=plan"));

  const [existingEmail, existingSlug, existingShopLogin, existingUserLogin] = await Promise.all([
    platformDb.user.findUnique({ where: { email: application.email }, select: { id: true } }),
    platformDb.shop.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } }),
    platformDb.shop.findUnique({ where: { staffLoginId: parsed.data.staffLoginId }, select: { id: true } }),
    platformDb.user.findUnique({ where: { adminLoginId: parsed.data.staffLoginId }, select: { id: true } }),
  ]);
  if (existingEmail || existingSlug || existingShopLogin || existingUserLogin) redirect(applicationDetailPath(application.id, "error=conflict"));

  const passwordHash = await hashPassword(parsed.data.temporaryPassword);
  const dates = subscriptionDates({ status: SubscriptionStatus.TRIAL, trialDays: plan.trialDays, gracePeriodDays: plan.gracePeriodDays });
  const planSnapshot = subscriptionPlanSnapshot(plan);
  let approvedShopId = "";

  try {
    await platformDb.$transaction(async (tx) => {
      const current = await tx.businessApplication.findUnique({ where: { id: application.id } });
      if (!current || current.type !== BusinessApplicationType.SHOP || !isReviewable(current.status)) throw new Error("APPLICATION_NOT_REVIEWABLE");
      const shop = await tx.shop.create({
        data: {
          name: current.businessName,
          slug: parsed.data.slug,
          networkCode: shopNetworkCode(parsed.data.slug),
          staffLoginId: parsed.data.staffLoginId,
          city: current.city,
          country: current.country,
          verificationStatus: ShopVerificationStatus.PENDING,
          storefrontEnabled: false,
          publicOrderingEnabled: false,
          planTier: plan.tier,
          billingCycle: parsed.data.billingCycle,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          subscriptionRenewalAt: dates.renewalAt,
          legalBusinessName: current.legalBusinessName ?? current.businessName,
          businessRegistrationNumber: current.businessRegistrationNumber,
          taxIdentificationNumber: current.taxIdentificationNumber,
          credentialContactName: current.contactName,
          credentialPhone: current.phone,
          credentialEmail: current.email,
          credentialAddress: current.address,
          paymentConfig: { create: {} },
        },
      });
      const owner = await tx.user.create({ data: { shopId: shop.id, adminLoginId: parsed.data.staffLoginId, email: current.email, name: current.contactName, phone: current.phone, role: Role.OWNER, passwordHash, isActive: true } });
      await tx.shopSubscriptionContract.create({
        data: {
          shopId: shop.id,
          planId: plan.id,
          planVersion: plan.version,
          billingCycle: parsed.data.billingCycle,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          trialEndsAt: dates.trialEndsAt,
          renewalAt: dates.renewalAt,
          termsSnapshot: snapshotAsJson(planSnapshot),
          assignedById: session.id,
          assignmentReason: `Approved business application ${current.reference}.`,
        },
      });
      await tx.shopCommunicationWallet.createMany({ data: [{ shopId: shop.id, channel: CommunicationCreditChannel.SMS }, { shopId: shop.id, channel: CommunicationCreditChannel.WHATSAPP }] });
      const changed = await tx.businessApplication.updateMany({
        where: { id: current.id, updatedAt: parsed.data.expectedUpdatedAt, status: current.status },
        data: {
          status: BusinessApplicationStatus.APPROVED,
          assignedReviewerId: session.id,
          reviewNotes: parsed.data.reviewNotes,
          decisionReason: parsed.data.decisionReason,
          approvedShopId: shop.id,
          approvedOwnerUserId: owner.id,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new Error("APPLICATION_CHANGED");
      await tx.auditLog.create({ data: { shopId: shop.id, userId: session.id, action: "admin.shop_application_approved", entityType: "BusinessApplication", entityId: current.id, metadata: { reference: current.reference, shopId: shop.id, ownerUserId: owner.id, planId: plan.id, planVersion: plan.version, billingCycle: parsed.data.billingCycle, loginId: parsed.data.staffLoginId, credentialDelivery: "out-of-band" } } });
      approvedShopId = shop.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(applicationDetailPath(application.id, "error=approval-changed"));
  }

  revalidatePath("/admin/applications");
  revalidatePath("/admin/shops");
  revalidatePath("/admin/billing");
  redirect(applicationDetailPath(application.id, `approved=shop&shopId=${approvedShopId}`));
}

export async function approveSupplierBusinessApplicationAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const parsed = supplierApprovalSchema.safeParse({
    applicationId: formData.get("applicationId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    decisionReason: formData.get("decisionReason"),
    reviewNotes: formData.get("reviewNotes"),
    approvedShopId: formData.get("approvedShopId"),
    supplierLoginId: formData.get("supplierLoginId"),
    temporaryPassword: formData.get("temporaryPassword"),
    paymentTerms: formData.get("paymentTerms"),
    leadTimeDays: formData.get("leadTimeDays") || 7,
  });
  if (!parsed.success) redirect(applicationDetailPath(String(formData.get("applicationId") ?? ""), "error=approval"));

  const [application, shop, existingEmail, existingLogin] = await Promise.all([
    platformDb.businessApplication.findUnique({ where: { id: parsed.data.applicationId } }),
    platformDb.shop.findFirst({ where: { id: parsed.data.approvedShopId, isActive: true }, select: { id: true } }),
    platformDb.user.findUnique({ where: { email: String(formData.get("applicationEmail") ?? "").toLowerCase() }, select: { id: true } }),
    platformDb.user.findUnique({ where: { adminLoginId: parsed.data.supplierLoginId }, select: { id: true } }),
  ]);
  if (!application || application.type !== BusinessApplicationType.SUPPLIER || !isReviewable(application.status)) redirect(applicationDetailPath(parsed.data.applicationId, "error=state"));
  if (!shop) redirect(applicationDetailPath(application.id, "error=shop"));
  if (application.requestedShopId && application.requestedShopId !== shop.id) redirect(applicationDetailPath(application.id, "error=shop-scope"));
  if (existingEmail || existingLogin || await platformDb.user.findUnique({ where: { email: application.email }, select: { id: true } })) redirect(applicationDetailPath(application.id, "error=conflict"));

  const passwordHash = await hashPassword(parsed.data.temporaryPassword);
  let approvedSupplierId = "";
  try {
    await platformDb.$transaction(async (tx) => {
      const current = await tx.businessApplication.findUnique({ where: { id: application.id } });
      if (!current || current.type !== BusinessApplicationType.SUPPLIER || !isReviewable(current.status)) throw new Error("APPLICATION_NOT_REVIEWABLE");
      const portalUser = await tx.user.create({ data: { shopId: shop.id, adminLoginId: parsed.data.supplierLoginId, email: current.email, name: current.contactName, phone: current.phone, role: Role.SUPPLIER, passwordHash, isActive: true } });
      const supplier = await tx.supplier.create({ data: { shopId: shop.id, portalUserId: portalUser.id, name: current.businessName, contactName: current.contactName, email: current.email, phone: current.phone, categories: current.categories, paymentTerms: parsed.data.paymentTerms, leadTimeDays: parsed.data.leadTimeDays, rating: 5, isActive: true } });
      const changed = await tx.businessApplication.updateMany({
        where: { id: current.id, updatedAt: parsed.data.expectedUpdatedAt, status: current.status },
        data: {
          status: BusinessApplicationStatus.APPROVED,
          assignedReviewerId: session.id,
          reviewNotes: parsed.data.reviewNotes,
          decisionReason: parsed.data.decisionReason,
          approvedShopId: shop.id,
          approvedSupplierId: supplier.id,
          reviewedAt: new Date(),
        },
      });
      if (changed.count !== 1) throw new Error("APPLICATION_CHANGED");
      await tx.auditLog.create({ data: { shopId: shop.id, userId: session.id, action: "admin.supplier_application_approved", entityType: "BusinessApplication", entityId: current.id, metadata: { reference: current.reference, shopId: shop.id, supplierId: supplier.id, portalUserId: portalUser.id, loginId: parsed.data.supplierLoginId, credentialDelivery: "out-of-band" } } });
      approvedSupplierId = supplier.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    redirect(applicationDetailPath(application.id, "error=approval-changed"));
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/investigate/shops/${shop.id}`);
  redirect(applicationDetailPath(application.id, `approved=supplier&supplierId=${approvedSupplierId}`));
}
