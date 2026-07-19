import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const BUYER_SESSION_COOKIE = "sports_shop_buyer";
export const BUYER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type BuyerSession = {
  id: string;
  phone: string;
  email: string | null;
  name: string;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("SESSION_SECRET must be set to a long random value.");
  }
  return new TextEncoder().encode(secret);
}

export async function signBuyerSession(buyer: BuyerSession) {
  return new SignJWT({
    id: buyer.id,
    phone: buyer.phone,
    email: buyer.email,
    name: buyer.name,
    type: "buyer",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${BUYER_SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyBuyerSessionToken(token: string): Promise<BuyerSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "buyer" || !payload.id || !payload.phone || !payload.name) return null;
    return {
      id: String(payload.id),
      phone: String(payload.phone),
      email: payload.email ? String(payload.email) : null,
      name: String(payload.name),
    };
  } catch {
    return null;
  }
}

export async function getBuyerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(BUYER_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyBuyerSessionToken(token);
}

export async function setBuyerSessionCookie(buyer: BuyerSession) {
  const cookieStore = await cookies();
  const token = await signBuyerSession(buyer);
  cookieStore.set(BUYER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: BUYER_SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearBuyerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(BUYER_SESSION_COOKIE);
}
