import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { strongPasswordSchema } from "@/lib/password-policy";
import { hasRole, type SessionUser } from "@/lib/rbac";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySessionToken } from "@/lib/session-token";
import { persistentSessionCookieOptions } from "@/lib/session-cookie";
import { bindTenantRequestContext } from "@/lib/tenant-context";

export async function hashPassword(password: string) {
  const parsed = strongPasswordSchema.safeParse(password);
  if (!parsed.success) throw new Error("PASSWORD_POLICY_VIOLATION");
  return bcrypt.hash(parsed.data, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  const token = await signSession(user);
  cookieStore.set(SESSION_COOKIE, token, persistentSessionCookieOptions(SESSION_TTL_SECONDS));
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  bindTenantRequestContext(null);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenSession = await verifySessionToken(token);
  if (!tokenSession) return null;

  const user = await platformDb.user.findUnique({
    where: { id: tokenSession.id },
    select: {
      id: true,
      shopId: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      sessionVersion: true,
      shop: { select: { isActive: true } },
    },
  });

  if (!user?.isActive || user.sessionVersion !== tokenSession.sessionVersion) return null;
  if (user.shopId && !user.shop?.isActive) return null;

  const session = {
    id: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
  bindTenantRequestContext(session.shopId);
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(allowedRoles: Role[]) {
  const session = await requireSession();
  if (!hasRole(session, allowedRoles)) {
    if (session.role === Role.SUPER_ADMIN) redirect("/admin?error=permission");
    if (session.role === Role.SUPPLIER) redirect("/supplier?error=permission");
    redirect("/dashboard?error=permission");
  }
  return session;
}

export async function requireActiveShop(session: SessionUser) {
  if (!session.shopId) return null;
  const shop = await prisma.shop.findUnique({
    where: { id: session.shopId },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      planTier: true,
      isActive: true,
      currency: true,
      storefrontEnabled: true,
      publicOrderingEnabled: true,
      cashOrderHoldMinutes: true,
      billingCycle: true,
      subscriptionStatus: true,
      monthlyPrice: true,
      yearlyPrice: true,
      subscriptionRenewalAt: true,
      networkCode: true,
      staffLoginId: true,
      verificationStatus: true,
    },
  });

  if (!shop || !shop.isActive) {
    await clearSessionCookie();
    redirect(`/login?error=${shop ? "shop-suspended" : "shop-not-found"}`);
  }

  return shop;
}
