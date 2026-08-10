import "server-only";

import { AccountKind } from "@prisma/client";
import { platformDb } from "@/lib/platform-db";

const LAST_SEEN_TOUCH_INTERVAL_MS = 15 * 60 * 1000;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_IP_LENGTH = 128;

export type SessionHeaderSource = {
  get(name: string): string | null;
};

export type AccountSessionIdentity = {
  accountKind: AccountKind;
  accountId: string;
};

export type AccountSessionMetadata = {
  userAgent: string | null;
  ipAddress: string | null;
};

function cleanHeader(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

async function currentAccountAuthVersion(identity: AccountSessionIdentity) {
  if (identity.accountKind === AccountKind.USER) {
    const user = await platformDb.user.findUnique({
      where: { id: identity.accountId },
      select: { sessionVersion: true },
    });
    return user ? String(user.sessionVersion) : null;
  }

  const buyer = await platformDb.buyerAccount.findUnique({
    where: { id: identity.accountId },
    select: { updatedAt: true },
  });
  return buyer ? String(buyer.updatedAt.getTime()) : null;
}

export function accountSessionMetadataFromHeaders(headers: SessionHeaderSource): AccountSessionMetadata {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    userAgent: cleanHeader(headers.get("user-agent"), MAX_USER_AGENT_LENGTH),
    ipAddress: cleanHeader(forwardedFor || headers.get("x-real-ip"), MAX_IP_LENGTH),
  };
}

export async function createAccountSession(input: AccountSessionIdentity & {
  authVersion: string | number;
  ttlSeconds: number;
  metadata?: Partial<AccountSessionMetadata> | null;
}) {
  const ttlSeconds = Math.max(60, Math.floor(input.ttlSeconds));
  const now = new Date();
  return platformDb.accountSession.create({
    data: {
      accountKind: input.accountKind,
      accountId: input.accountId,
      authVersion: String(input.authVersion),
      userAgent: cleanHeader(input.metadata?.userAgent, MAX_USER_AGENT_LENGTH),
      ipAddress: cleanHeader(input.metadata?.ipAddress, MAX_IP_LENGTH),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    },
  });
}

export async function isAccountSessionActive(input: AccountSessionIdentity & {
  authVersion: string | number;
  sessionId: string;
}) {
  const now = new Date();
  const authVersion = String(input.authVersion);
  const session = await platformDb.accountSession.findFirst({
    where: {
      id: input.sessionId,
      accountKind: input.accountKind,
      accountId: input.accountId,
      authVersion,
    },
    select: {
      id: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= now) return false;

  if (session.lastSeenAt.getTime() <= now.getTime() - LAST_SEEN_TOUCH_INTERVAL_MS) {
    await platformDb.accountSession.updateMany({
      where: {
        id: session.id,
        accountKind: input.accountKind,
        accountId: input.accountId,
        authVersion,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { lte: new Date(now.getTime() - LAST_SEEN_TOUCH_INTERVAL_MS) },
      },
      data: { lastSeenAt: now },
    });
  }

  return true;
}

export async function listAccountSessions(identity: AccountSessionIdentity) {
  const currentAuthVersion = await currentAccountAuthVersion(identity);
  if (currentAuthVersion) {
    await platformDb.accountSession.updateMany({
      where: {
        accountKind: identity.accountKind,
        accountId: identity.accountId,
        authVersion: { not: currentAuthVersion },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: "account-security-version-changed",
      },
    });
  }

  return platformDb.accountSession.findMany({
    where: {
      accountKind: identity.accountKind,
      accountId: identity.accountId,
    },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
      revokedReason: true,
    },
  });
}

export async function revokeAccountSession(input: AccountSessionIdentity & {
  sessionId: string;
  reason?: string;
}) {
  const now = new Date();
  return platformDb.accountSession.updateMany({
    where: {
      id: input.sessionId,
      accountKind: input.accountKind,
      accountId: input.accountId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      revokedReason: input.reason?.trim().slice(0, 120) || "user-revoked",
    },
  });
}

export async function revokeOtherAccountSessions(input: AccountSessionIdentity & {
  currentSessionId: string;
  reason?: string;
}) {
  const now = new Date();
  return platformDb.accountSession.updateMany({
    where: {
      accountKind: input.accountKind,
      accountId: input.accountId,
      id: { not: input.currentSessionId },
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      revokedAt: now,
      revokedReason: input.reason?.trim().slice(0, 120) || "user-revoked-others",
    },
  });
}

export async function revokeAllAccountSessions(input: AccountSessionIdentity & { reason?: string }) {
  const now = new Date();
  return platformDb.accountSession.updateMany({
    where: {
      accountKind: input.accountKind,
      accountId: input.accountId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      revokedReason: input.reason?.trim().slice(0, 120) || "security-change",
    },
  });
}

export function describeAccountSession(userAgent: string | null) {
  if (!userAgent) return { browser: "Unknown browser", device: "Unknown device" };
  const browser = /Edg\//i.test(userAgent)
    ? "Microsoft Edge"
    : /Firefox\//i.test(userAgent)
      ? "Firefox"
      : /Chrome\//i.test(userAgent)
        ? "Chrome"
        : /Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)
          ? "Safari"
          : "Other browser";
  const device = /iPhone|iPad|iPod/i.test(userAgent)
    ? "Apple mobile device"
    : /Android/i.test(userAgent)
      ? "Android device"
      : /Windows/i.test(userAgent)
        ? "Windows computer"
        : /Macintosh|Mac OS X/i.test(userAgent)
          ? "Mac"
          : /Linux/i.test(userAgent)
            ? "Linux computer"
            : "Unknown device";
  return { browser, device };
}
