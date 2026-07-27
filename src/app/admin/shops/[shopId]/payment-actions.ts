"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { checkShopPaystackSubaccount } from "@/lib/integration-health";
import { requirePlatformPermission } from "@/lib/platform-admin";

const routingSchema = z.object({
  shopId: z.string().min(1).max(100),
  paystackSubaccountCode: z.string().trim().regex(/^ACCT_[A-Za-z0-9]+$/).optional(),
  paystackTransactionCharge: z.coerce.number().int().min(0).max(100_000_000).optional(),
  paystackChargeBearer: z.enum(["account", "subaccount"]),
});

function accountLast4(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, "") ?? "";
  return normalized.length >= 4 ? normalized.slice(-4) : null;
}

export async function updateShopPaymentRoutingAction(formData: FormData) {
  const session = await requirePlatformPermission("billing");
  const parsed = routingSchema.safeParse({
    shopId: formData.get("shopId"),
    paystackSubaccountCode: formData.get("paystackSubaccountCode") || undefined,
    paystackTransactionCharge: formData.get("paystackTransactionCharge") || undefined,
    paystackChargeBearer: formData.get("paystackChargeBearer") || "subaccount",
  });
  if (!parsed.success) redirect(`/admin/shops/${String(formData.get("shopId") ?? "")}?payment=invalid`);

  const shop = await prisma.shop.findUnique({
    where: { id: parsed.data.shopId },
    include: { paymentConfig: true },
  });
  if (!shop) redirect("/admin/shops?error=not-found");

  let providerHealth: Awaited<ReturnType<typeof checkShopPaystackSubaccount>> | null = null;
  if (parsed.data.paystackSubaccountCode) {
    providerHealth = await checkShopPaystackSubaccount(parsed.data.paystackSubaccountCode);
    if (providerHealth.state === "unconfigured" || providerHealth.state === "unreachable") {
      redirect(`/admin/shops/${shop.id}?payment=provider-rejected`);
    }
  }

  await prisma.shopPaymentConfig.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      paystackSubaccountCode: parsed.data.paystackSubaccountCode,
      paystackTransactionCharge: parsed.data.paystackTransactionCharge,
      paystackChargeBearer: parsed.data.paystackChargeBearer,
      settlementBank: shop.paymentConfig?.settlementBank,
      settlementAccount: shop.paymentConfig?.settlementAccount,
      settlementAccountName: shop.paymentConfig?.settlementAccountName,
      shopMomoNumber: shop.paymentConfig?.shopMomoNumber,
      shopMomoNetwork: shop.paymentConfig?.shopMomoNetwork,
      momoProvider: shop.paymentConfig?.momoProvider,
      allowCash: shop.paymentConfig?.allowCash ?? true,
      allowCard: shop.paymentConfig?.allowCard ?? false,
      allowMomo: shop.paymentConfig?.allowMomo ?? true,
    },
    update: {
      paystackSubaccountCode: parsed.data.paystackSubaccountCode,
      paystackTransactionCharge: parsed.data.paystackTransactionCharge,
      paystackChargeBearer: parsed.data.paystackChargeBearer,
    },
  });

  await audit({
    shopId: shop.id,
    userId: session.id,
    action: "payments.shop_routing_updated",
    entityType: "ShopPaymentConfig",
    entityId: shop.paymentConfig?.id ?? shop.id,
    metadata: {
      subaccountAssigned: Boolean(parsed.data.paystackSubaccountCode),
      platformTransactionCharge: parsed.data.paystackTransactionCharge ?? null,
      chargeBearer: parsed.data.paystackChargeBearer,
      providerState: providerHealth?.state ?? "cleared",
      providerBusinessName: providerHealth?.metadata.businessName ?? null,
      providerSettlementBank: providerHealth?.metadata.settlementBank ?? null,
      providerSettlementAccountLast4: providerHealth?.metadata.settlementAccountMasked?.slice(-4)
        ?? accountLast4(shop.paymentConfig?.settlementAccount),
    },
  });

  revalidatePath(`/admin/shops/${shop.id}`);
  revalidatePath("/admin/integrations");
  revalidatePath("/dashboard/settings");
  redirect(`/admin/shops/${shop.id}?payment=updated`);
}
