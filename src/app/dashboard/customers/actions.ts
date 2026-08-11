"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(160).transform((value) => value.toLowerCase()).optional(),
  group: z.string().trim().min(2).max(50).default("Retail"),
  notes: z.string().trim().max(800).optional(),
});

function customerInput(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    group: formData.get("group") || "Retail",
    notes: formData.get("notes") || undefined,
  });
}

function duplicateWhere(shopId: string, phone?: string, email?: string, excludeId?: string) {
  return {
    ...(excludeId ? { id: { not: excludeId } } : {}),
    shopId,
    OR: [
      ...(phone ? [{ phone }] : []),
      ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
    ],
  };
}

export async function createCustomerAction(formData: FormData) {
  const session = await requireRole(permissions.customersWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = customerInput(formData);
  if (!parsed.success) redirect("/dashboard/customers?error=invalid");

  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const duplicate = phone || parsed.data.email
        ? await tx.customer.findFirst({ where: duplicateWhere(session.shopId!, phone, parsed.data.email), select: { id: true } })
        : null;
      if (duplicate) return { duplicateId: duplicate.id, customer: null };
      const customer = await tx.customer.create({ data: { shopId: session.shopId!, ...parsed.data, phone } });
      return { duplicateId: null, customer };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.duplicateId) redirect(`/dashboard/customers?error=duplicate&selected=${result.duplicateId}`);
    if (!result.customer) redirect("/dashboard/customers?error=invalid");
    await audit({ shopId: session.shopId, userId: session.id, action: "customer.created", entityType: "Customer", entityId: result.customer.id });
    revalidatePath("/dashboard/customers");
    redirect(`/dashboard/customers?selected=${result.customer.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      redirect("/dashboard/customers?error=customer-changed");
    }
    throw error;
  }
}

export async function updateCustomerAction(formData: FormData) {
  const session = await requireRole(permissions.customersWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const customerId = String(formData.get("customerId") ?? "");
  const parsed = customerInput(formData);
  if (!customerId || !parsed.success) redirect("/dashboard/customers?error=invalid");

  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.customer.findFirst({ where: { id: customerId, shopId: session.shopId! } });
      if (!current) return { missing: true as const, duplicateId: null, customer: null };
      const duplicate = phone || parsed.data.email
        ? await tx.customer.findFirst({ where: duplicateWhere(session.shopId!, phone, parsed.data.email, current.id), select: { id: true } })
        : null;
      if (duplicate) return { missing: false as const, duplicateId: duplicate.id, customer: null };
      const customer = await tx.customer.update({ where: { id: current.id }, data: { ...parsed.data, phone } });
      return { missing: false as const, duplicateId: null, customer };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.missing) redirect("/dashboard/customers?error=invalid");
    if (result.duplicateId) redirect(`/dashboard/customers?error=duplicate&selected=${result.duplicateId}`);
    if (!result.customer) redirect("/dashboard/customers?error=invalid");
    await audit({ shopId: session.shopId, userId: session.id, action: "customer.updated", entityType: "Customer", entityId: result.customer.id });
    revalidatePath("/dashboard/customers");
    redirect(`/dashboard/customers?selected=${result.customer.id}`);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      redirect("/dashboard/customers?error=customer-changed");
    }
    throw error;
  }
}
