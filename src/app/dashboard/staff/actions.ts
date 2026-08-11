"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { strongPasswordSchema } from "@/lib/password-policy";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { createPlainToken, hashToken, minutesFromNow } from "@/lib/tokens";
import {
  canAssignStaffRole,
  canToggleStaffAccess,
  ownerAssignableStaffRoles,
} from "@/lib/staff-authority";
import {
  createStaffAccountWithinPlan,
  createStaffInviteWithinPlan,
  SubscriptionEntitlementError,
  SubscriptionLimitError,
  toggleStaffAccessWithinPlan,
} from "@/lib/subscription-entitlements";

const schema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.nativeEnum(Role).refine((role) => ownerAssignableStaffRoles.includes(role as (typeof ownerAssignableStaffRoles)[number])),
});

const staffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  password: strongPasswordSchema,
  role: z.nativeEnum(Role).refine((role) => ownerAssignableStaffRoles.includes(role as (typeof ownerAssignableStaffRoles)[number])),
});

function staffRedirect(error: string): never {
  redirect(`/dashboard/staff?error=${encodeURIComponent(error)}`);
}

function handleStaffWriteError(error: unknown): never {
  if (error instanceof SubscriptionLimitError) staffRedirect("plan-staff-limit");
  if (error instanceof SubscriptionEntitlementError && error.code === "EMAIL_EXISTS") staffRedirect("email-exists");
  staffRedirect("staff");
}

export async function createStaffAccountAction(formData: FormData) {
  const session = await requireRole(permissions.staff);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) staffRedirect("staff");
  if (!canAssignStaffRole(session.role, parsed.data.role)) staffRedirect("role-authority");

  const user = await createStaffAccountWithinPlan({
    shopId,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    role: parsed.data.role,
    passwordHash: await hashPassword(parsed.data.password),
  }).catch(handleStaffWriteError);

  await audit({
    shopId,
    userId: session.id,
    action: "staff.account_created",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });
  revalidatePath("/dashboard/staff");
}

export async function toggleStaffAccessAction(formData: FormData) {
  const session = await requireRole(permissions.staff);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId, shopId } });
  if (user.id === session.id) staffRedirect("self");
  if (!canToggleStaffAccess(session.role, user.role)) staffRedirect("role-authority");

  const updated = await toggleStaffAccessWithinPlan({ shopId, userId }).catch(handleStaffWriteError);
  await audit({
    shopId,
    userId: session.id,
    action: updated.isActive ? "staff.access_enabled" : "staff.access_disabled",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role },
  });
  revalidatePath("/dashboard/staff");
}

export async function createInviteAction(formData: FormData) {
  const session = await requireRole(permissions.staff);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const shopId = session.shopId;

  const parsed = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) staffRedirect("invite");
  if (!canAssignStaffRole(session.role, parsed.data.role)) staffRedirect("role-authority");

  const token = createPlainToken();
  const invite = await createStaffInviteWithinPlan({
    shopId,
    email: parsed.data.email,
    role: parsed.data.role,
    tokenHash: hashToken(token),
    expiresAt: minutesFromNow(60 * 24 * 7),
    createdById: session.id,
  }).catch(handleStaffWriteError);

  await audit({
    shopId,
    userId: session.id,
    action: "staff.invite_created",
    entityType: "InviteToken",
    entityId: invite.id,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });
  revalidatePath("/dashboard/staff");
  redirect(`/dashboard/staff?invite=${encodeURIComponent(token)}`);
}
