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

// Shop creation is implemented only in create-shop-action.ts so owner credentials
// never pass through URLs, logs, or an obsolete generated-password action.

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

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.shop.update({
      where: { id: shopId },
      data: { isActive: !shop.isActive },
    });
    await tx.user.updateMany({
      where: { shopId },
      data: { sessionVersion: { increment: 1 } },
    });
    return next;
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
  adminLoginId: z.string().optional(),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().optional(),
  staffTitle: z.string().optional(),
  department: z.string().optional(),
  emergencyContact: z.string().optional(),
  staffNotes: z.string().optional(),
  password: z.string().min(12).max(100),
  adminPermissions: z.array(z.enum(platformPermissionValues)).min(1),
});

function platformWorkerLoginId(name: string, provided?: string) {
  const clean = provided?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (clean && clean.length >= 5) return clean;

  const prefix = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();

  return `ADM-${prefix || "STAFF"}-${nanoid(4).toUpperCase()}`;
}

export async function createPlatformWorkerAction(formData: FormData) {
  const session = await requirePlatformPermission("workers");
  const parsed = platformWorkerSchema.safeParse({
    name: formData.get("name"),
    adminLoginId: formData.get("adminLoginId") || undefined,
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    staffTitle: formData.get("staffTitle") || undefined,
    department: formData.get("department") || undefined,
    emergencyContact: formData.get("emergencyContact") || undefined,
    staffNotes: formData.get("staffNotes") || undefined,
    password: formData.get("password"),
    adminPermissions: formData.getAll("adminPermissions").map(String),
  });

  if (!parsed.success) redirect("/admin?error=worker");

  const existingWorker = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existingWorker) redirect("/admin?error=worker-exists");

  const passwordHash = await hashPassword(parsed.data.password);
  const adminLoginId = platformWorkerLoginId(parsed.data.name, parsed.data.adminLoginId);
  const worker = await prisma.user.create({
    data: {
      name: parsed.data.name,
      adminLoginId,
      email: parsed.data.email,
      phone: parsed.data.phone,
      staffTitle: parsed.data.staffTitle,
      department: parsed.data.department,
      emergencyContact: parsed.data.emergencyContact,
      staffNotes: parsed.data.staffNotes,
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
    metadata: { email: worker.email, adminLoginId, adminPermissions: parsed.data.adminPermissions, department: parsed.data.department },
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
    data: { isActive: !worker.isActive, sessionVersion: { increment: 1 } },
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
