"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";

const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(160).optional(),
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

export async function createCustomerAction(formData: FormData) {
  const session = await requireRole(permissions.customersWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const parsed = customerInput(formData);
  if (!parsed.success) redirect("/dashboard/customers?error=invalid");

  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined;
  const duplicate = phone || parsed.data.email
    ? await prisma.customer.findFirst({
        where: { shopId: session.shopId, OR: [...(phone ? [{ phone }] : []), ...(parsed.data.email ? [{ email: parsed.data.email }] : [])] },
        select: { id: true },
      })
    : null;
  if (duplicate) redirect(`/dashboard/customers?error=duplicate&selected=${duplicate.id}`);

  const customer = await prisma.customer.create({
    data: { shopId: session.shopId, ...parsed.data, phone },
  });
  await audit({ shopId: session.shopId, userId: session.id, action: "customer.created", entityType: "Customer", entityId: customer.id });
  revalidatePath("/dashboard/customers");
  redirect(`/dashboard/customers?selected=${customer.id}`);
}

export async function updateCustomerAction(formData: FormData) {
  const session = await requireRole(permissions.customersWrite);
  if (!session.shopId) redirect("/dashboard?error=missing-shop");
  const customerId = String(formData.get("customerId") ?? "");
  const parsed = customerInput(formData);
  if (!customerId || !parsed.success) redirect("/dashboard/customers?error=invalid");

  const current = await prisma.customer.findFirst({ where: { id: customerId, shopId: session.shopId } });
  if (!current) redirect("/dashboard/customers?error=invalid");
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : undefined;
  const duplicate = phone || parsed.data.email
    ? await prisma.customer.findFirst({
        where: { id: { not: current.id }, shopId: session.shopId, OR: [...(phone ? [{ phone }] : []), ...(parsed.data.email ? [{ email: parsed.data.email }] : [])] },
        select: { id: true },
      })
    : null;
  if (duplicate) redirect(`/dashboard/customers?error=duplicate&selected=${duplicate.id}`);

  await prisma.customer.update({ where: { id: current.id }, data: { ...parsed.data, phone } });
  await audit({ shopId: session.shopId, userId: session.id, action: "customer.updated", entityType: "Customer", entityId: current.id });
  revalidatePath("/dashboard/customers");
  redirect(`/dashboard/customers?selected=${current.id}`);
}
