import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/rbac";

export const SESSION_COOKIE = "sports_shop_session";
// Keep staff signed in across normal shop usage and refresh this window on every
// authenticated dashboard request. Explicit logout still invalidates the cookie.
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("SESSION_SECRET must be set to a long random value.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({
    id: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.id || !payload.email || !payload.name || !payload.role) return null;

    return {
      id: String(payload.id),
      shopId: payload.shopId ? String(payload.shopId) : null,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
