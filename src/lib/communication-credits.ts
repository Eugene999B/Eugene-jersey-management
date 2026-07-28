import {
  CommunicationCreditChannel,
  CommunicationCreditLedgerType,
  CommunicationCreditPurchaseStatus,
  NotificationChannel,
  Prisma,
  type CommunicationCreditPackage,
} from "@prisma/client";
import { z } from "zod";
import { platformDb } from "@/lib/platform-db";
import { amountToSubunit, type PaystackTransactionData } from "@/lib/payments";

export const communicationCreditPackageSnapshotSchema = z.object({
  code: z.string().min(3).max(60),
  channel: z.nativeEnum(CommunicationCreditChannel),
  name: z.string().min(2).max(80),
  description: z.string().max(500),
  currency: z.string().length(3),
  price: z.string().nullable(),
  creditUnits: z.number().int().positive().nullable(),
  bonusUnits: z.number().int().min(0),
  isConfigured: z.boolean(),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  version: z.number().int().positive(),
});

export type CommunicationCreditPackageSnapshot = z.infer<typeof communicationCreditPackageSnapshotSchema>;

export function communicationCreditPackageSnapshot(
  creditPackage: CommunicationCreditPackage,
): CommunicationCreditPackageSnapshot {
  return {
    code: creditPackage.code,
    channel: creditPackage.channel,
    name: creditPackage.name,
    description: creditPackage.description ?? "",
    currency: creditPackage.currency,
    price: creditPackage.price?.toFixed(2) ?? null,
    creditUnits: creditPackage.creditUnits,
    bonusUnits: creditPackage.bonusUnits,
    isConfigured: creditPackage.isConfigured,
    isPublic: creditPackage.isPublic,
    isActive: creditPackage.isActive,
    version: creditPackage.version,
  };
}

export function communicationCreditSnapshotAsJson(
  snapshot: CommunicationCreditPackageSnapshot,
): Prisma.InputJsonObject {
  return snapshot as unknown as Prisma.InputJsonObject;
}

export function parseCommunicationCreditPackageSnapshot(value: Prisma.JsonValue) {
  return communicationCreditPackageSnapshotSchema.safeParse(value);
}

export function creditChannelForNotification(channel: NotificationChannel) {
  if (channel === NotificationChannel.SMS) return CommunicationCreditChannel.SMS;
  if (channel === NotificationChannel.WHATSAPP) return CommunicationCreditChannel.WHATSAPP;
  return null;
}

export function packageTotalUnits(input: Pick<CommunicationCreditPackageSnapshot, "creditUnits" | "bonusUnits">) {
  return input.creditUnits === null ? null : input.creditUnits + input.bonusUnits;
}

export function packageUnitPrice(input: Pick<CommunicationCreditPackageSnapshot, "price" | "creditUnits" | "bonusUnits">) {
  const units = packageTotalUnits(input);
  if (!units || input.price === null) return null;
  return Number((Number(input.price) / units).toFixed(4));
}

export async function ensureShopCommunicationWallets(shopId: string) {
  await platformDb.shopCommunicationWallet.createMany({
    data: [
      { shopId, channel: CommunicationCreditChannel.SMS },
      { shopId, channel: CommunicationCreditChannel.WHATSAPP },
    ],
    skipDuplicates: true,
  });
  return platformDb.shopCommunicationWallet.findMany({
    where: { shopId },
    orderBy: { channel: "asc" },
  });
}

export async function shopCommunicationCreditDashboard(shopId: string) {
  await ensureShopCommunicationWallets(shopId);
  const [wallets, packages, purchases, ledger] = await Promise.all([
    platformDb.shopCommunicationWallet.findMany({ where: { shopId }, orderBy: { channel: "asc" } }),
    platformDb.communicationCreditPackage.findMany({
      where: { isConfigured: true, isPublic: true, isActive: true },
      orderBy: [{ channel: "asc" }, { price: "asc" }],
    }),
    platformDb.communicationCreditPurchase.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    platformDb.communicationCreditLedgerEntry.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);
  return { wallets, packages, purchases, ledger };
}

export async function reserveCommunicationCredit(input: {
  shopId: string;
  channel: CommunicationCreditChannel;
  customerMessageId: string;
  createdById?: string | null;
  metadata?: Prisma.InputJsonObject;
}) {
  const reference = `message:${input.customerMessageId}:usage`;
  return platformDb.$transaction(async (tx) => {
    const existing = await tx.communicationCreditLedgerEntry.findUnique({ where: { reference } });
    if (existing) return { reserved: true, balanceAfter: existing.balanceAfter, duplicate: true };

    await tx.shopCommunicationWallet.upsert({
      where: { shopId_channel: { shopId: input.shopId, channel: input.channel } },
      create: { shopId: input.shopId, channel: input.channel },
      update: {},
    });
    const changed = await tx.shopCommunicationWallet.updateMany({
      where: { shopId: input.shopId, channel: input.channel, balance: { gte: 1 } },
      data: { balance: { decrement: 1 }, lifetimeUsed: { increment: 1 } },
    });
    if (changed.count !== 1) return { reserved: false, balanceAfter: 0, duplicate: false };

    const wallet = await tx.shopCommunicationWallet.findUniqueOrThrow({
      where: { shopId_channel: { shopId: input.shopId, channel: input.channel } },
    });
    await tx.communicationCreditLedgerEntry.create({
      data: {
        shopId: input.shopId,
        channel: input.channel,
        type: CommunicationCreditLedgerType.USAGE,
        delta: -1,
        balanceAfter: wallet.balance,
        reference,
        customerMessageId: input.customerMessageId,
        reason: `Reserved one ${input.channel} credit for an outbound customer message.`,
        createdById: input.createdById ?? null,
        metadata: input.metadata ?? {},
      },
    });
    return { reserved: true, balanceAfter: wallet.balance, duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function refundCommunicationCredit(input: {
  shopId: string;
  channel: CommunicationCreditChannel;
  customerMessageId: string;
  reason: string;
  metadata?: Prisma.InputJsonObject;
}) {
  const usageReference = `message:${input.customerMessageId}:usage`;
  const refundReference = `message:${input.customerMessageId}:refund`;
  return platformDb.$transaction(async (tx) => {
    const [usage, existingRefund] = await Promise.all([
      tx.communicationCreditLedgerEntry.findUnique({ where: { reference: usageReference } }),
      tx.communicationCreditLedgerEntry.findUnique({ where: { reference: refundReference } }),
    ]);
    if (!usage || existingRefund) return { refunded: false, duplicate: Boolean(existingRefund) };

    const wallet = await tx.shopCommunicationWallet.update({
      where: { shopId_channel: { shopId: input.shopId, channel: input.channel } },
      data: { balance: { increment: 1 }, lifetimeRefunded: { increment: 1 } },
    });
    await tx.communicationCreditLedgerEntry.create({
      data: {
        shopId: input.shopId,
        channel: input.channel,
        type: CommunicationCreditLedgerType.REFUND,
        delta: 1,
        balanceAfter: wallet.balance,
        reference: refundReference,
        customerMessageId: input.customerMessageId,
        reason: input.reason,
        metadata: input.metadata ?? {},
      },
    });
    return { refunded: true, duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function settleCommunicationCreditPurchase(data: PaystackTransactionData) {
  const reference = data.reference;
  if (!reference) return { status: "ignored" as const, reason: "missing-reference" };

  return platformDb.$transaction(async (tx) => {
    const purchase = await tx.communicationCreditPurchase.findUnique({ where: { providerReference: reference } });
    if (!purchase) return { status: "ignored" as const, reason: "credit-purchase-not-found" };
    if (purchase.status === CommunicationCreditPurchaseStatus.SUCCESS && purchase.verifiedAt) {
      return { status: "processed" as const, reason: "already-verified", purchase };
    }

    const fail = async (reason: string, message: string) => {
      await tx.communicationCreditPurchase.updateMany({
        where: { id: purchase.id, status: { not: CommunicationCreditPurchaseStatus.SUCCESS } },
        data: {
          status: CommunicationCreditPurchaseStatus.FAILED,
          failedAt: new Date(),
          gatewayResponse: message,
          providerChannel: data.channel,
        },
      });
      return { status: "failed" as const, reason, purchase };
    };

    if (data.status !== "success") {
      return fail(data.status ?? "not-success", data.gateway_response ?? data.status ?? "Payment not successful");
    }
    const expectedAmount = amountToSubunit(Number(purchase.amount));
    if (typeof data.amount !== "number") return fail("missing-amount", "Verified provider response did not include an amount.");
    if (data.amount !== expectedAmount) return fail("amount-mismatch", `Amount mismatch: expected ${expectedAmount}, got ${data.amount}`);
    if (!data.currency) return fail("missing-currency", "Verified provider response did not include a currency.");
    if (data.currency.toUpperCase() !== purchase.currency.toUpperCase()) {
      return fail("currency-mismatch", `Currency mismatch: expected ${purchase.currency}, got ${data.currency}`);
    }

    const claimed = await tx.communicationCreditPurchase.updateMany({
      where: { id: purchase.id, status: { not: CommunicationCreditPurchaseStatus.SUCCESS } },
      data: {
        status: CommunicationCreditPurchaseStatus.SUCCESS,
        verifiedAt: new Date(),
        failedAt: null,
        gatewayResponse: data.gateway_response ?? "Successful",
        providerChannel: data.channel,
      },
    });
    if (claimed.count !== 1) {
      const current = await tx.communicationCreditPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
      return { status: "processed" as const, reason: "already-verified", purchase: current };
    }

    await tx.shopCommunicationWallet.upsert({
      where: { shopId_channel: { shopId: purchase.shopId, channel: purchase.channel } },
      create: { shopId: purchase.shopId, channel: purchase.channel },
      update: {},
    });
    const wallet = await tx.shopCommunicationWallet.update({
      where: { shopId_channel: { shopId: purchase.shopId, channel: purchase.channel } },
      data: {
        balance: { increment: purchase.totalUnits },
        lifetimePurchased: { increment: purchase.totalUnits },
      },
    });
    await tx.communicationCreditLedgerEntry.create({
      data: {
        shopId: purchase.shopId,
        channel: purchase.channel,
        type: CommunicationCreditLedgerType.PURCHASE,
        delta: purchase.totalUnits,
        balanceAfter: wallet.balance,
        reference: `purchase:${purchase.id}`,
        purchaseId: purchase.id,
        reason: `Verified ${purchase.channel} credit package purchase.`,
        createdById: purchase.initiatedById,
        metadata: { providerReference: purchase.providerReference, packageId: purchase.packageId, packageVersion: purchase.packageVersion },
      },
    });
    const updated = await tx.communicationCreditPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    return { status: "processed" as const, reason: "verified", purchase: updated };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}
