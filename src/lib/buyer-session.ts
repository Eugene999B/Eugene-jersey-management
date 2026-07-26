import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
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
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a long random value of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signBuyerSession(buyer: BuyerSession) {
  return new SignJWT({
    id: buyer.id,
    phone: buyer.phone,
    email: buyer.email,
    name: buyer.name,
    sessionVersion: buyer.sessionVersion,
    type: "buyer",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${BUYER_SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyBuyerSessionToken(token: string): Promise<BuyerSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (payload.type !== "buyer" || !payload.id || !payload.phone || !payload.name || typeof payload.sessionVersion !== "number") return null;
    return {
      id: String(payload.id),
      phone: String(payload.phone),
      email: payload.email ? String(payload.email) : null,
      name: String(payload.name),
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}

export async function getBuyerSession() {
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
  return {
    id: buyer.id,
    phone: buyer.phone,
    email: buyer.email,
    name: buyer.name,
    sessionVersion: buyer.updatedAt.getTime(),
  };
}

export async function setBuyerSessionCookie(buyer: BuyerSession) {
  const cookieStore = await cookies();
  const token = await signBuyerSession(buyer);
  cookieStore.set(BUYER_SESSION_COOKIE, token, persistentSessionCookieOptions(BUYER_SESSION_TTL_SECONDS));
}

export async function clearBuyerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(BUYER_SESSION_COOKIE);
}
