"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BillingCycle, OrderStatus, PlanTier, ReturnRequestStatus, Role, ShopVerificationStatus, SubscriptionStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const platformPermissionValues = ["shops", "billing", "support", "workers", "broadcast", "activity", "settings"] as const;
type PlatformPermission = (typeof platformPermissionValues)[number];

function parseAdminPermissions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PlatformPermission => platformPermissionValues.includes(String(item) as PlatformPermission));
}

async function requirePlatformPermission(permission: PlatformPermission) {
  const session = await requireRole(permissions.superAdmin);
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { adminPermissions: true },
  });
  const adminPermissions = parseAdminPermissions(user?.adminPermissions);

  if (adminPermissions.length > 0 && !adminPermissions.includes(permission)) {
    redirect("/admin?error=permission");
  }

  return session;
}

const createShopSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email().transform((value) => value.toLowerCase()),
  ownerPhone: z.string().optional(),
  staffLoginId: z.string().optional(),
  planTier: z.nativeEnum(PlanTier),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
  monthlyPrice: z.coerce.number().min(0).optional(),
  yearlyPrice: z.coerce.number().min(0).optional(),
  legalBusinessName: z.string().optional(),
  businessRegistrationNumber: z.string().optional(),
  taxIdentificationNumber: z.string().optional(),
  ownerGovernmentId: z.string().optional(),
  credentialContactName: z.string().optional(),
  credentialPhone: z.string().optional(),
  credentialEmail: z.string().email().optional(),
  credentialAddress: z.string().optional(),
  credentialDocumentUrl: z.string().url().optional(),
});

function shopNetworkCode(slug: string) {
  const prefix = slug
    .split("-")
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();

  return `${prefix || "SHOP"}-${nanoid(5).toUpperCase()}`;
}

function shopStaffLoginId(slug: string, provided?: string) {
  const clean = provided?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (clean && clean.length >= 4) return clean;
  const prefix = slug
    .split("-")
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();

  return `${prefix || "SHOP"}-STAFF-${nanoid(4).toUpperCase()}`;
}

export async function createShopAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const parsed = createShopSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPhone: formData.get("ownerPhone") || undefined,
    staffLoginId: formData.get("staffLoginId") || undefined,
    planTier: formData.get("planTier"),
    billingCycle: formData.get("billingCycle") || BillingCycle.MONTHLY,
    monthlyPrice: formData.get("monthlyPrice") || undefined,
    yearlyPrice: formData.get("yearlyPrice") || undefined,
    legalBusinessName: formData.get("legalBusinessName") || undefined,
    businessRegistrationNumber: formData.get("businessRegistrationNumber") || undefined,
    taxIdentificationNumber: formData.get("taxIdentificationNumber") || undefined,
    ownerGovernmentId: formData.get("ownerGovernmentId") || undefined,
    credentialContactName: formData.get("credentialContactName") || undefined,
    credentialPhone: formData.get("credentialPhone") || undefined,
    credentialEmail: formData.get("credentialEmail") || undefined,
    credentialAddress: formData.get("credentialAddress") || undefined,
    credentialDocumentUrl: formData.get("credentialDocumentUrl") || undefined,
  });

  if (!parsed.success) redirect("/admin/shops/new?error=invalid");

  const temporaryPassword = `Launch${Math.floor(100000 + Math.random() * 899999)}!`;
  const passwordHash = await hashPassword(temporaryPassword);

  const shop = await prisma.$transaction(async (tx) => {
    const createdShop = await tx.shop.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        networkCode: shopNetworkCode(parsed.data.slug),
        staffLoginId: shopStaffLoginId(parsed.data.slug, parsed.data.staffLoginId),
        verificationStatus: ShopVerificationStatus.PENDING,
        planTier: parsed.data.planTier,
        billingCycle: parsed.data.billingCycle,
        monthlyPrice: parsed.data.monthlyPrice,
        yearlyPrice: parsed.data.yearlyPrice,
        subscriptionStatus: SubscriptionStatus.TRIAL,
        subscriptionRenewalAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        legalBusinessName: parsed.data.legalBusinessName,
        businessRegistrationNumber: parsed.data.businessRegistrationNumber,
        taxIdentificationNumber: parsed.data.taxIdentificationNumber,
        ownerGovernmentId: parsed.data.ownerGovernmentId,
        credentialContactName: parsed.data.credentialContactName || parsed.data.ownerName,
        credentialPhone: parsed.data.credentialPhone || parsed.data.ownerPhone,
        credentialEmail: parsed.data.credentialEmail || parsed.data.ownerEmail,
        credentialAddress: parsed.data.credentialAddress,
        credentialDocumentUrl: parsed.data.credentialDocumentUrl,
        paymentConfig: { create: {} },
      },
    });

    await tx.user.create({
      data: {
        shopId: createdShop.id,
        email: parsed.data.ownerEmail,
        name: parsed.data.ownerName,
        role: Role.OWNER,
        passwordHash,
        phone: parsed.data.ownerPhone || parsed.data.credentialPhone,
      },
    });

    return createdShop;
  });

  console.log(`Initial owner password for ${parsed.data.ownerEmail}: ${temporaryPassword}`);
  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "admin.shop_created",
    entityType: "Shop",
    entityId: shop.id,
    metadata: { ownerEmail: parsed.data.ownerEmail, planTier: parsed.data.planTier },
  });

  revalidatePath("/admin");
  redirect(`/admin/shops/${shop.id}`);
}

export async function verifyShopCredentialsAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) redirect("/admin");

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      verificationStatus: ShopVerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      verifiedById: session.id,
      isActive: true,
      storefrontEnabled: true,
    },
  });

  await audit({
    shopId,
    userId: session.id,
    action: "admin.shop_credentials_verified",
    entityType: "Shop",
    entityId: shopId,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shop.id}`);
}

export async function rejectShopCredentialsAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const shopId = String(formData.get("shopId") ?? "");
  if (!shopId) redirect("/admin");

  const shop = await prisma.shop.update({
    where: { id: shopId },
    data: {
      verificationStatus: ShopVerificationStatus.REJECTED,
      verifiedAt: null,
      verifiedById: null,
      storefrontEnabled: false,
    },
  });

  await audit({
    shopId,
    userId: session.id,
    action: "admin.shop_credentials_rejected",
    entityType: "Shop",
    entityId: shopId,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shop.id}`);
}

export async function toggleShopAction(formData: FormData) {
  const session = await requirePlatformPermission("shops");
  const shopId = String(formData.get("shopId") ?? "");
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });

  const updated = await prisma.shop.update({
    where: { id: shopId },
    data: { isActive: !shop.isActive },
  });

  await audit({
    shopId,
    userId: session.id,
    action: updated.isActive ? "admin.shop_reactivated" : "admin.shop_suspended",
    entityType: "Shop",
    entityId: shopId,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shopId}`);
}

const announcementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
});

const subscriptionSchema = z.object({
  shopId: z.string().min(1),
  planTier: z.nativeEnum(PlanTier),
  billingCycle: z.nativeEnum(BillingCycle),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus),
  monthlyPrice: z.coerce.number().min(0).optional(),
  yearlyPrice: z.coerce.number().min(0).optional(),
  subscriptionRenewalAt: z.coerce.date().optional(),
});

export async function updateShopSubscriptionAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = subscriptionSchema.safeParse({
    shopId: formData.get("shopId"),
    planTier: formData.get("planTier"),
    billingCycle: formData.get("billingCycle"),
    subscriptionStatus: formData.get("subscriptionStatus"),
    monthlyPrice: formData.get("monthlyPrice") || undefined,
    yearlyPrice: formData.get("yearlyPrice") || undefined,
    subscriptionRenewalAt: formData.get("subscriptionRenewalAt") || undefined,
  });

  if (!parsed.success) redirect("/admin?error=subscription");

  const shop = await prisma.shop.update({
    where: { id: parsed.data.shopId },
    data: {
      planTier: parsed.data.planTier,
      billingCycle: parsed.data.billingCycle,
      subscriptionStatus: parsed.data.subscriptionStatus,
      monthlyPrice: parsed.data.monthlyPrice,
      yearlyPrice: parsed.data.yearlyPrice,
      subscriptionRenewalAt: parsed.data.subscriptionRenewalAt,
    },
  });

  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "admin.subscription_updated",
    entityType: "Shop",
    entityId: shop.id,
    metadata: {
      planTier: shop.planTier,
      billingCycle: shop.billingCycle,
      subscriptionStatus: shop.subscriptionStatus,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shop.id}`);
}

export async function createGlobalAnnouncementAction(formData: FormData) {
  const session = await requirePlatformPermission("broadcast");
  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) redirect("/admin?error=announcement");

  const announcement = await prisma.announcement.create({
    data: {
      ...parsed.data,
      isGlobal: true,
    },
  });

  await audit({
    userId: session.id,
    action: "admin.global_announcement_created",
    entityType: "Announcement",
    entityId: announcement.id,
  });

  revalidatePath("/admin");
}

const platformWorkerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().optional(),
  password: z.string().min(6),
  adminPermissions: z.array(z.enum(platformPermissionValues)).min(1),
});

export async function createPlatformWorkerAction(formData: FormData) {
  const session = await requirePlatformPermission("workers");
  const parsed = platformWorkerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    adminPermissions: formData.getAll("adminPermissions").map(String),
  });

  if (!parsed.success) redirect("/admin?error=worker");

  const passwordHash = await hashPassword(parsed.data.password);
  const worker = await prisma.user.upsert({
    where: { email: parsed.data.email },
    update: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      passwordHash,
      role: Role.SUPER_ADMIN,
      shopId: null,
      adminPermissions: parsed.data.adminPermissions,
      isActive: true,
      failedLoginCount: 0,
      lockUntil: null,
    },
    create: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      passwordHash,
      role: Role.SUPER_ADMIN,
      adminPermissions: parsed.data.adminPermissions,
      isActive: true,
    },
  });

  await audit({
    userId: session.id,
    action: "admin.platform_worker_saved",
    entityType: "User",
    entityId: worker.id,
    metadata: { email: worker.email, adminPermissions: parsed.data.adminPermissions },
  });

  revalidatePath("/admin");
}

export async function togglePlatformWorkerAction(formData: FormData) {
  const session = await requirePlatformPermission("workers");
  const userId = String(formData.get("userId") ?? "");
  if (!userId || userId === session.id) redirect("/admin?error=worker");

  const worker = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (worker.role !== Role.SUPER_ADMIN || worker.shopId) redirect("/admin?error=worker");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !worker.isActive },
  });

  await audit({
    userId: session.id,
    action: updated.isActive ? "admin.platform_worker_reactivated" : "admin.platform_worker_suspended",
    entityType: "User",
    entityId: userId,
    metadata: { email: updated.email },
  });

  revalidatePath("/admin");
}

const returnIssueSchema = z.object({
  returnRequestId: z.string().min(1),
  status: z.nativeEnum(ReturnRequestStatus),
  resolution: z.string().optional(),
});

export async function updateReturnIssueAction(formData: FormData) {
  const session = await requirePlatformPermission("support");
  const parsed = returnIssueSchema.safeParse({
    returnRequestId: formData.get("returnRequestId"),
    status: formData.get("status"),
    resolution: formData.get("resolution") || undefined,
  });

  if (!parsed.success) redirect("/admin?error=issue");

  const returnRequest = await prisma.returnRequest.update({
    where: { id: parsed.data.returnRequestId },
    data: {
      status: parsed.data.status,
      resolution: parsed.data.resolution,
      resolvedAt: ["APPROVED", "REJECTED", "REFUNDED", "EXCHANGED", "CANCELLED"].includes(parsed.data.status) ? new Date() : undefined,
    },
  });

  await audit({
    shopId: returnRequest.shopId,
    userId: session.id,
    action: "admin.return_issue_updated",
    entityType: "ReturnRequest",
    entityId: returnRequest.id,
    metadata: { status: returnRequest.status, resolution: returnRequest.resolution },
  });

  revalidatePath("/admin");
}

const orderIssueSchema = z.object({
  orderId: z.string().min(1),
  status: z.nativeEnum(OrderStatus),
  notes: z.string().optional(),
});

export async function adminUpdateOrderStatusAction(formData: FormData) {
  const session = await requirePlatformPermission("support");
  const parsed = orderIssueSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) redirect("/admin?error=issue");

  const order = await prisma.order.update({
    where: { id: parsed.data.orderId },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes,
      cancellationReason: parsed.data.status === OrderStatus.CANCELLED ? parsed.data.notes : undefined,
    },
  });

  await audit({
    shopId: order.shopId,
    userId: session.id,
    action: "admin.order_issue_status_updated",
    entityType: "Order",
    entityId: order.id,
    metadata: { status: order.status, notes: parsed.data.notes },
  });

  revalidatePath("/admin");
}

export async function closeCustomerThreadAction(formData: FormData) {
  const session = await requirePlatformPermission("support");
  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) redirect("/admin?error=issue");

  const thread = await prisma.customerThread.update({
    where: { id: threadId },
    data: { status: "RESOLVED" },
  });

  await audit({
    shopId: thread.shopId,
    userId: session.id,
    action: "admin.customer_thread_resolved",
    entityType: "CustomerThread",
    entityId: thread.id,
  });

  revalidatePath("/admin");
}
