import "server-only";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasRole, type SessionUser } from "@/lib/rbac";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySessionToken } from "@/lib/session-token";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  const token = await signSession(user);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenSession = await verifySessionToken(token);
  if (!tokenSession) return null;

  const user = await prisma.user.findUnique({
    where: { id: tokenSession.id },
    select: {
      id: true,
      shopId: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      sessionVersion: true,
    },
  });

  if (!user?.isActive || user.sessionVersion !== tokenSession.sessionVersion) return null;
  return {
    id: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(allowedRoles: Role[]) {
  const session = await requireSession();
  if (!hasRole(session, allowedRoles)) redirect("/dashboard?error=permission");
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
    },
  });

  if (!shop) {
    await clearSessionCookie();
    redirect("/login?error=shop-not-found");
  }

  return shop;
}
