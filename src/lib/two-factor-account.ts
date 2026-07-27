import "server-only";

import { AccountKind, Prisma } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import {
  createTwoFactorSetup,
  decryptTwoFactorSecret,
  findRecoveryCodeIndex,
  generateRecoveryCodes,
  hashRecoveryCodes,
  isTwoFactorConfigured,
  verifyTotpCode,
} from "@/lib/two-factor";

const SETUP_TTL_MINUTES = 10;

function stringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export type TwoFactorAccount = {
  accountKind: AccountKind;
  accountId: string;
};

export async function getTwoFactorStatus(account: TwoFactorAccount) {
  const record = await platformDb.accountTwoFactor.findUnique({
    where: { accountKind_accountId: account },
    select: {
      enabled: true,
      enabledAt: true,
      recoveryCodeHashes: true,
      pendingEncryptedSecret: true,
      pendingExpiresAt: true,
    },
  });
  const setupPending = Boolean(
    record?.pendingEncryptedSecret
    && record.pendingExpiresAt
    && record.pendingExpiresAt.getTime() > Date.now(),
  );

  return {
    configured: isTwoFactorConfigured(),
    enabled: record?.enabled === true,
    enabledAt: record?.enabledAt ?? null,
    recoveryCodesRemaining: stringArray(record?.recoveryCodeHashes).length,
    setupPending,
  };
}

export async function accountRequiresTwoFactor(account: TwoFactorAccount) {
  const record = await platformDb.accountTwoFactor.findUnique({
    where: { accountKind_accountId: account },
    select: { enabled: true, encryptedSecret: true },
  });
  if (!record?.enabled || !record.encryptedSecret) return false;
  if (!isTwoFactorConfigured()) throw new Error("TWO_FACTOR_NOT_CONFIGURED");
  return true;
}

export async function beginTwoFactorSetup(account: TwoFactorAccount, accountLabel: string) {
  if (!isTwoFactorConfigured()) throw new Error("TWO_FACTOR_NOT_CONFIGURED");
  const setup = createTwoFactorSetup(accountLabel);
  const pendingExpiresAt = new Date(Date.now() + SETUP_TTL_MINUTES * 60_000);

  await platformDb.accountTwoFactor.upsert({
    where: { accountKind_accountId: account },
    create: {
      ...account,
      pendingEncryptedSecret: setup.encryptedSecret,
      pendingRecoveryCodeHashes: setup.recoveryCodeHashes,
      pendingExpiresAt,
    },
    update: {
      pendingEncryptedSecret: setup.encryptedSecret,
      pendingRecoveryCodeHashes: setup.recoveryCodeHashes,
      pendingExpiresAt,
    },
  });

  return {
    secret: setup.secret,
    otpauthUri: setup.otpauthUri,
    recoveryCodes: setup.recoveryCodes,
    expiresAt: pendingExpiresAt,
  };
}

export async function confirmTwoFactorSetup(account: TwoFactorAccount, code: string) {
  if (!isTwoFactorConfigured()) return false;
  const record = await platformDb.accountTwoFactor.findUnique({
    where: { accountKind_accountId: account },
    select: { pendingEncryptedSecret: true, pendingRecoveryCodeHashes: true, pendingExpiresAt: true },
  });
  if (
    !record?.pendingEncryptedSecret
    || !record.pendingExpiresAt
    || record.pendingExpiresAt.getTime() <= Date.now()
  ) {
    await cancelTwoFactorSetup(account);
    return false;
  }

  const secret = decryptTwoFactorSecret(record.pendingEncryptedSecret);
  if (!verifyTotpCode(secret, code)) return false;

  await platformDb.accountTwoFactor.update({
    where: { accountKind_accountId: account },
    data: {
      enabled: true,
      encryptedSecret: record.pendingEncryptedSecret,
      recoveryCodeHashes: record.pendingRecoveryCodeHashes,
      pendingEncryptedSecret: null,
      pendingRecoveryCodeHashes: [],
      pendingExpiresAt: null,
      enabledAt: new Date(),
    },
  });
  return true;
}

export async function cancelTwoFactorSetup(account: TwoFactorAccount) {
  await platformDb.accountTwoFactor.updateMany({
    where: account,
    data: {
      pendingEncryptedSecret: null,
      pendingRecoveryCodeHashes: [],
      pendingExpiresAt: null,
    },
  });
}

export async function disableTwoFactor(account: TwoFactorAccount) {
  await platformDb.accountTwoFactor.updateMany({
    where: account,
    data: {
      enabled: false,
      encryptedSecret: null,
      recoveryCodeHashes: [],
      pendingEncryptedSecret: null,
      pendingRecoveryCodeHashes: [],
      pendingExpiresAt: null,
      enabledAt: null,
    },
  });
}

export async function regenerateRecoveryCodes(account: TwoFactorAccount) {
  if (!isTwoFactorConfigured()) throw new Error("TWO_FACTOR_NOT_CONFIGURED");
  const codes = generateRecoveryCodes();
  const updated = await platformDb.accountTwoFactor.updateMany({
    where: { ...account, enabled: true, encryptedSecret: { not: null } },
    data: { recoveryCodeHashes: hashRecoveryCodes(codes) },
  });
  if (updated.count !== 1) throw new Error("TWO_FACTOR_NOT_ENABLED");
  return codes;
}

export async function verifyTwoFactorLogin(account: TwoFactorAccount, candidate: string) {
  if (!isTwoFactorConfigured()) return false;

  try {
    return await platformDb.$transaction(async (transaction) => {
      const record = await transaction.accountTwoFactor.findUnique({
        where: { accountKind_accountId: account },
        select: { id: true, enabled: true, encryptedSecret: true, recoveryCodeHashes: true },
      });
      if (!record?.enabled || !record.encryptedSecret) return false;

      const secret = decryptTwoFactorSecret(record.encryptedSecret);
      if (verifyTotpCode(secret, candidate)) return true;

      const hashes = stringArray(record.recoveryCodeHashes);
      const recoveryIndex = findRecoveryCodeIndex(candidate, hashes);
      if (recoveryIndex < 0) return false;

      await transaction.accountTwoFactor.update({
        where: { id: record.id },
        data: { recoveryCodeHashes: hashes.filter((_, index) => index !== recoveryIndex) },
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return false;
  }
}
