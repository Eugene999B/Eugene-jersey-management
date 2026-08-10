import "server-only";

import { AccountKind } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import {
  accountSessionMetadataFromHeaders,
  createAccountSession,
  isAccountSessionActive,
} from "@/lib/account-sessions";
import { prisma } from "@/lib/db";
import { persistentSessionCookieOptions } from "@/lib/session-cookie";

export const BUYER_SESSION_COOKIE = "sports_shop_buyer";
export const BUYER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type BuyerSession = {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  sessionVersion: number;
  sessionId?: string;
};

export type AuthenticatedBuyerSession = BuyerSession & { sessionId: string };

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a long random value of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signBuyerSession(buyer: BuyerSession & { sessionId: string }) {
  return new SignJWT({
    id: buyer.id,
    phone: buyer.phone,
    email: buyer.email,
    name: buyer.name,
    sessionVersion: buyer.sessionVersion,
    sessionId: buyer.sessionId,
    type: "buyer",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(buyer.sessionId)
    .setIssuedAt()
    .setExpirationTime(`${BUYER_SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyBuyerSessionToken(token: string): Promise<AuthenticatedBuyerSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (
      payload.type !== "buyer"
      || !payload.id
      || !payload.phone
      || !payload.name
      || typeof payload.sessionVersion !== "number"
      || !payload.sessionId
    ) return null;
    return {
      id: String(payload.id),
      phone: String(payload.phone),
      email: payload.email ? String(payload.email) : null,
      name: String(payload.name),
      sessionVersion: payload.sessionVersion,
      sessionId: String(payload.sessionId),
    };
  } catch {
    return null;
  }
}

export async function getBuyerSession(): Promise<AuthenticatedBuyerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(BUYER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenSession = await verifyBuyerSessionToken(token);
  if (!tokenSession) return null;
  const buyer = await prisma.buyerAccount.findUnique({
    where: { id: tokenSession.id },
    select: { id: true, phone: true, email: true, name: true, isActive: true, updatedAt: true },
  });
  if (!buyer?.isActive || buyer.phone !== tokenSession.phone || buyer.updatedAt.getTime() !== tokenSession.sessionVersion) return null;
  const activeSession = await isAccountSessionActive({
    accountKind: AccountKind.BUYER,
    accountId: buyer.id,
    sessionId: tokenSession.sessionId,
  });
  if (!activeSession) return null;
  return {
    id: buyer.id,
    phone: buyer.phone,
    email: buyer.email,
    name: buyer.name,
    sessionVersion: buyer.updatedAt.getTime(),
    sessionId: tokenSession.sessionId,
  };
}

export async function setBuyerSessionCookie(buyer: Omit<BuyerSession, "sessionId">) {
  const requestHeaders = await headers();
  const accountSession = await createAccountSession({
    accountKind: AccountKind.BUYER,
    accountId: buyer.id,
    ttlSeconds: BUYER_SESSION_TTL_SECONDS,
    metadata: accountSessionMetadataFromHeaders(requestHeaders),
  });
  const cookieStore = await cookies();
  const token = await signBuyerSession({ ...buyer, sessionId: accountSession.id });
  cookieStore.set(BUYER_SESSION_COOKIE, token, persistentSessionCookieOptions(BUYER_SESSION_TTL_SECONDS));
  return accountSession.id;
}

export async function clearBuyerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(BUYER_SESSION_COOKIE);
}
