import { Prisma } from "@prisma/client";
import { platformDb } from "../src/lib/platform-db";
import { deriveCommercialSubscriptionState } from "../src/lib/subscription-hardening";
import { parseSubscriptionPlanSnapshot } from "../src/lib/subscription-plans";

async function run() {
  const now = new Date();
  const contracts = await platformDb.shopSubscriptionContract.findMany({
    select: {
      id: true,
      shopId: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      renewalAt: true,
      graceEndsAt: true,
      termsSnapshot: true,
    },
  });

  let changed = 0;
  let invalidSnapshots = 0;

  for (const contract of contracts) {
    const parsed = parseSubscriptionPlanSnapshot(contract.termsSnapshot);
    if (!parsed.success) {
      invalidSnapshots += 1;
      console.warn(`Skipped contract ${contract.id}: invalid terms snapshot.`);
      continue;
    }

    const state = deriveCommercialSubscriptionState({
      shopId: contract.shopId,
      hasContract: true,
      snapshot: parsed.data,
      dates: {
        subscriptionStatus: contract.subscriptionStatus,
        trialEndsAt: contract.trialEndsAt,
        renewalAt: contract.renewalAt,
        graceEndsAt: contract.graceEndsAt,
      },
      now,
    });

    const statusChanged = state.effectiveStatus !== contract.subscriptionStatus;
    const graceChanged = state.graceEndsAt?.getTime() !== contract.graceEndsAt?.getTime();
    if (!statusChanged && !graceChanged) continue;

    await platformDb.$transaction(async (tx) => {
      await tx.shopSubscriptionContract.update({
        where: { id: contract.id },
        data: {
          subscriptionStatus: state.effectiveStatus,
          graceEndsAt: state.graceEndsAt,
        },
      });
      await tx.shop.update({
        where: { id: contract.shopId },
        data: { subscriptionStatus: state.effectiveStatus },
      });
      await tx.auditLog.create({
        data: {
          shopId: contract.shopId,
          action: "system.subscription_lifecycle_updated",
          entityType: "ShopSubscriptionContract",
          entityId: contract.id,
          metadata: {
            previousStatus: contract.subscriptionStatus,
            nextStatus: state.effectiveStatus,
            renewalAt: contract.renewalAt?.toISOString() ?? null,
            graceEndsAt: state.graceEndsAt?.toISOString() ?? null,
            processedAt: now.toISOString(),
          } as Prisma.InputJsonObject,
        },
      });
    });
    changed += 1;
  }

  console.log(JSON.stringify({ processed: contracts.length, changed, invalidSnapshots, processedAt: now.toISOString() }));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await platformDb.$disconnect();
  });
