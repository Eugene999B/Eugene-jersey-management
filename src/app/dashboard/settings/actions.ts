"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { permissions } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(2),
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  storefrontEnabled: z.boolean().default(false),
  publicOrderingEnabled: z.boolean().default(false),
  cashOrderHoldMinutes: z.coerce.number().int().min(15).max(10080),
  paystackPublicKey: z.string().optional(),
  paystackSubaccountCode: z.string().optional(),
  paystackTransactionCharge: z.coerce.number().int().min(0).optional(),
  paystackChargeBearer: z.enum(["account", "subaccount", "all-proportional", "all"]).optional(),
  settlementBank: z.string().optional(),
  settlementAccount: z.string().optional(),
  settlementAccountName: z.string().optional(),
  shopMomoNumber: z.string().optional(),
  shopMomoNetwork: z.string().optional(),
  momoProvider: z.string().optional(),
  allowCash: z.boolean().default(false),
  allowCard: z.boolean().default(false),
  allowMomo: z.boolean().default(false),
});

export async function updateShopSettingsAction(formData: FormData) {
  const session = await requireRole(permissions.settings);
  if (!session.shopId) redirect("/login");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl") || undefined,
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    storefrontEnabled: formData.get("storefrontEnabled") === "on",
    publicOrderingEnabled: formData.get("publicOrderingEnabled") === "on",
    cashOrderHoldMinutes: formData.get("cashOrderHoldMinutes") || 120,
    paystackPublicKey: formData.get("paystackPublicKey") || undefined,
    paystackSubaccountCode: formData.get("paystackSubaccountCode") || undefined,
    paystackTransactionCharge: formData.get("paystackTransactionCharge") || undefined,
    paystackChargeBearer: formData.get("paystackChargeBearer") || undefined,
    settlementBank: formData.get("settlementBank") || undefined,
    settlementAccount: formData.get("settlementAccount") || undefined,
    settlementAccountName: formData.get("settlementAccountName") || undefined,
    shopMomoNumber: formData.get("shopMomoNumber") || undefined,
    shopMomoNetwork: formData.get("shopMomoNetwork") || undefined,
    momoProvider: formData.get("momoProvider") || undefined,
    allowCash: formData.get("allowCash") === "on",
    allowCard: formData.get("allowCard") === "on",
    allowMomo: formData.get("allowMomo") === "on",
  });

  if (!parsed.success) redirect("/dashboard/settings?error=invalid");

  await prisma.shop.update({
    where: { id: session.shopId },
    data: {
      name: parsed.data.name,
      logoUrl: parsed.data.logoUrl,
      primaryColor: parsed.data.primaryColor,
      secondaryColor: parsed.data.secondaryColor,
      storefrontEnabled: parsed.data.storefrontEnabled,
      publicOrderingEnabled: parsed.data.publicOrderingEnabled,
      cashOrderHoldMinutes: parsed.data.cashOrderHoldMinutes,
      paymentConfig: {
        upsert: {
          create: {
            paystackPublicKey: parsed.data.paystackPublicKey,
            paystackSubaccountCode: parsed.data.paystackSubaccountCode,
            paystackTransactionCharge: parsed.data.paystackTransactionCharge,
            paystackChargeBearer: parsed.data.paystackChargeBearer,
            settlementBank: parsed.data.settlementBank,
            settlementAccount: parsed.data.settlementAccount,
            settlementAccountName: parsed.data.settlementAccountName,
            shopMomoNumber: parsed.data.shopMomoNumber,
            shopMomoNetwork: parsed.data.shopMomoNetwork,
            momoProvider: parsed.data.momoProvider,
            allowCash: parsed.data.allowCash,
            allowCard: parsed.data.allowCard,
            allowMomo: parsed.data.allowMomo,
          },
          update: {
            paystackPublicKey: parsed.data.paystackPublicKey,
            paystackSubaccountCode: parsed.data.paystackSubaccountCode,
            paystackTransactionCharge: parsed.data.paystackTransactionCharge,
            paystackChargeBearer: parsed.data.paystackChargeBearer,
            settlementBank: parsed.data.settlementBank,
            settlementAccount: parsed.data.settlementAccount,
            settlementAccountName: parsed.data.settlementAccountName,
            shopMomoNumber: parsed.data.shopMomoNumber,
            shopMomoNetwork: parsed.data.shopMomoNetwork,
            momoProvider: parsed.data.momoProvider,
            allowCash: parsed.data.allowCash,
            allowCard: parsed.data.allowCard,
            allowMomo: parsed.data.allowMomo,
          },
        },
      },
    },
  });

  await audit({
    shopId: session.shopId,
    userId: session.id,
    action: "settings.shop_updated",
    entityType: "Shop",
    entityId: session.shopId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}
