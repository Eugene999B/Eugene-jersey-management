"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { createPlainToken, hashToken, minutesFromNow } from "@/lib/tokens";

const allowedStaffRoles = [Role.MANAGER, Role.CASHIER, Role.DESIGNER, Role.INVENTORY_CLERK, Role.ACCOUNTANT, Role.VIEWER] as const;

const schema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  role: z.nativeEnum(Role).refine((role) => allowedStaffRoles.includes(role as (typeof allowedStaffRoles)[number])),
});

const staffSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().optional(),
  password: z.string().min(8).max(100),
  role: z.nativeEnum(Role).refine((role) => allowedStaffRoles.includes(role as (typeof allowedStaffRoles)[number])),
});

export async function createStaffAccountAction(formData: FormData) {
  const session = await requireRole(permissions.staff);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard/staff?error=staff");

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) redirect("/dashboard/staff?error=email-exists");

  const user = await prisma.user.create({
    data: {
      shopId: session.shopId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
      isActive: true,
    },
  });

  await audit({
    shopId: session.shopId,
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

  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId, shopId: session.shopId } });
  if (user.id === session.id) redirect("/dashboard/staff?error=self");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive: !user.isActive, sessionVersion: { increment: 1 } },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: updated.isActive ? "staff.access_enabled" : "staff.access_disabled",
    entityType: "User",
    entityId: user.id,
  });

  revalidatePath("/dashboard/staff");
}

export async function createInviteAction(formData: FormData) {
  const session = await requireRole(permissions.staff);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");

  const parsed = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/dashboard/staff?error=invite");

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) redirect("/dashboard/staff?error=email-exists");

  const token = createPlainToken();
  const invite = await prisma.inviteToken.create({
    data: {
      shopId: session.shopId,
      email: parsed.data.email,
      role: parsed.data.role,
      tokenHash: hashToken(token),
      expiresAt: minutesFromNow(60 * 24 * 7),
      createdById: session.id,
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "staff.invite_created",
    entityType: "InviteToken",
    entityId: invite.id,
    metadata: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/dashboard/staff");
  redirect(`/dashboard/staff?invite=${encodeURIComponent(token)}`);
}
