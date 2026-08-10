import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import type { AuthenticatedSessionUser, SessionUser } from "@/lib/rbac";

export const SESSION_COOKIE = "sports_shop_session";
// Keep staff signed in across a normal work week. Database-backed sessionVersion
// checks revoke all tokens when a password, user, or tenant access state changes;
// the durable AccountSession id additionally supports one-device revocation.
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a long random value of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser & { sessionId: string }) {
  return new SignJWT({
    id: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
    sessionId: user.sessionId,
    type: "staff",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(user.sessionId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<AuthenticatedSessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (
      payload.type !== "staff"
      || !payload.id
      || !payload.email
      || !payload.name
      || !payload.role
      || typeof payload.sessionVersion !== "number"
      || !payload.sessionId
    ) return null;

    return {
      id: String(payload.id),
      shopId: payload.shopId ? String(payload.shopId) : null,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      sessionVersion: payload.sessionVersion,
      sessionId: String(payload.sessionId),
    };
  } catch {
    return null;
  }
}
