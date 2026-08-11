import "server-only";

import { Prisma } from "@prisma/client";

type ClaimRow = {
  key: string;
  shopId: string;
  debtId: string;
  paymentId: string | null;
};

export async function claimDebtPaymentSubmission(
  tx: Prisma.TransactionClient,
  input: { key: string; shopId: string; debtId: string },
) {
  const inserted = await tx.$queryRaw<ClaimRow[]>(Prisma.sql`
    INSERT INTO "DebtPaymentSubmission" ("key", "shopId", "debtId")
    VALUES (${input.key}, ${input.shopId}, ${input.debtId})
    ON CONFLICT ("key") DO NOTHING
    RETURNING "key", "shopId", "debtId", "paymentId"
  `);
  if (inserted[0]) return { duplicate: false as const, paymentId: null };

  const existing = await tx.$queryRaw<ClaimRow[]>(Prisma.sql`
    SELECT "key", "shopId", "debtId", "paymentId"
    FROM "DebtPaymentSubmission"
    WHERE "key" = ${input.key}
  `);
  const row = existing[0];
  if (!row || row.shopId !== input.shopId || row.debtId !== input.debtId) {
    throw new Error("COLLECTION_KEY_CONFLICT");
  }
  if (!row.paymentId) throw new Error("COLLECTION_STILL_PROCESSING");
  return { duplicate: true as const, paymentId: row.paymentId };
}

export async function completeDebtPaymentSubmission(
  tx: Prisma.TransactionClient,
  input: { key: string; shopId: string; debtId: string; paymentId: string },
) {
  const updated = await tx.$executeRaw(Prisma.sql`
    UPDATE "DebtPaymentSubmission"
    SET "paymentId" = ${input.paymentId}
    WHERE "key" = ${input.key}
      AND "shopId" = ${input.shopId}
      AND "debtId" = ${input.debtId}
      AND "paymentId" IS NULL
  `);
  if (updated !== 1) throw new Error("COLLECTION_KEY_CONFLICT");
}
