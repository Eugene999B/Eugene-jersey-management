import "dotenv/config";
import assert from "node:assert/strict";
import { AccountKind, PasswordRecoveryChannel } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import { createTenantDb, TenantDatabaseAccessError } from "@/lib/tenant-db";

async function expectRejects(action: () => Promise<unknown>, message: string) {
  await assert.rejects(action, (error) => error instanceof TenantDatabaseAccessError, message);
}

async function main() {
  if (process.env.TENANT_ISOLATION_TESTING !== "true" || process.env.NODE_ENV === "production") {
    throw new Error("Release 28 isolation verification is allowed only with TENANT_ISOLATION_TESTING=true outside production.");
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const shop = await platformDb.shop.create({
    data: { name: "Release 28 isolation shop", slug: `release28-isolation-${suffix}` },
  });
  const buyer = await platformDb.buyerAccount.create({
    data: { name: "Release 28 recovery buyer", phone: `+233${String(Date.now()).slice(-9)}` },
  });
  const challenge = await platformDb.passwordRecoveryChallenge.create({
    data: {
      publicTokenHash: `${suffix.replace(/[^a-z0-9]/gi, "")}0`.padEnd(64, "0").slice(0, 64),
      accountKind: AccountKind.BUYER,
      accountId: buyer.id,
      channel: PasswordRecoveryChannel.SMS,
      destination: buyer.phone,
      codeHash: "0".repeat(64),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const providerEvent = await platformDb.emailProviderEvent.create({
    data: {
      provider: "resend",
      eventId: `release28-${suffix}`,
      eventType: "email.delivered",
      providerReference: `email-${suffix}`,
      occurredAt: new Date(),
      payload: { type: "email.delivered" },
    },
  });

  try {
    const tenant = createTenantDb(shop.id);
    await expectRejects(
      () => tenant.passwordRecoveryChallenge.findMany(),
      "Tenant client accessed password recovery challenges.",
    );
    await expectRejects(
      () => tenant.emailProviderEvent.findMany(),
      "Tenant client accessed email provider events.",
    );
    await expectRejects(
      () => tenant.$transaction(async (transaction) => transaction.passwordRecoveryChallenge.findMany()),
      "Interactive tenant transaction accessed password recovery challenges.",
    );
    await expectRejects(
      () => tenant.$transaction(async (transaction) => transaction.emailProviderEvent.findMany()),
      "Interactive tenant transaction accessed email provider events.",
    );
    console.log("Release 28 password recovery and provider-event isolation passed for normal and interactive tenant clients.");
  } finally {
    await platformDb.emailProviderEvent.deleteMany({ where: { id: providerEvent.id } });
    await platformDb.passwordRecoveryChallenge.deleteMany({ where: { id: challenge.id } });
    await platformDb.buyerAccount.deleteMany({ where: { id: buyer.id } });
    await platformDb.shop.deleteMany({ where: { id: shop.id } });
    await platformDb.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});