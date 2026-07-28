import "server-only";

import { CommunicationCreditPurchaseStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import {
  communicationCreditPackageSnapshot,
  communicationCreditSnapshotAsJson,
  packageTotalUnits,
} from "@/lib/communication-credits";
import { platformDb } from "@/lib/platform-db";

export class CommunicationCreditPurchaseError extends Error {
  constructor(public readonly code: "PACKAGE_UNAVAILABLE" | "PACKAGE_INVALID" | "PURCHASE_NOT_FOUND") {
    super(code);
    this.name = "CommunicationCreditPurchaseError";
  }
}

export async function createPendingCommunicationCreditPurchase(input: {
  shopId: string;
  packageId: string;
  initiatedById: string;
}) {
  const creditPackage = await platformDb.communicationCreditPackage.findUnique({ where: { id: input.packageId } });
  if (!creditPackage || !creditPackage.isConfigured || !creditPackage.isPublic || !creditPackage.isActive) {
    throw new CommunicationCreditPurchaseError("PACKAGE_UNAVAILABLE");
  }
  const snapshot = communicationCreditPackageSnapshot(creditPackage);
  const totalUnits = packageTotalUnits(snapshot);
  if (snapshot.price === null || snapshot.creditUnits === null || totalUnits === null || totalUnits <= 0) {
    throw new CommunicationCreditPurchaseError("PACKAGE_INVALID");
  }

  return platformDb.communicationCreditPurchase.create({
    data: {
      shopId: input.shopId,
      packageId: creditPackage.id,
      packageVersion: creditPackage.version,
      channel: creditPackage.channel,
      creditUnits: snapshot.creditUnits,
      bonusUnits: snapshot.bonusUnits,
      totalUnits,
      amount: snapshot.price,
      currency: snapshot.currency,
      status: CommunicationCreditPurchaseStatus.PENDING,
      providerReference: `EJM-CRED-${nanoid(20).toUpperCase()}`,
      packageSnapshot: communicationCreditSnapshotAsJson(snapshot),
      initiatedById: input.initiatedById,
    },
  });
}

export async function failCommunicationCreditPurchase(input: {
  purchaseId: string;
  reason: string;
}) {
  return platformDb.communicationCreditPurchase.updateMany({
    where: { id: input.purchaseId, status: CommunicationCreditPurchaseStatus.PENDING },
    data: {
      status: CommunicationCreditPurchaseStatus.FAILED,
      failedAt: new Date(),
      gatewayResponse: input.reason,
    },
  });
}

export async function communicationCreditPurchaseByReference(reference: string) {
  return platformDb.communicationCreditPurchase.findUnique({ where: { providerReference: reference } });
}
