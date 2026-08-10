import "server-only";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountKind, Role } from "@prisma/client";
import {
  accountSessionMetadataFromHeaders,
  createAccountSession,
  isAccountSessionActive,
} from "@/lib/account-sessions";
import { prisma } from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { strongPasswordSchema } from "@/lib/password-policy";
import { hasRole, type AuthenticatedSessionUser, type SessionUser } from "@/lib/rbac";
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
  const requestHeaders = await headers();
  const accountSession = await createAccountSession({
    accountKind: AccountKind.USER,
    accountId: user.id,
    authVersion: user.sessionVersion,
    ttlSeconds: SESSION_TTL_SECONDS,
    metadata: accountSessionMetadataFromHeaders(requestHeaders),
  });
  const cookieStore = await cookies();
  const token = await signSession({ ...user, sessionId: accountSession.id });
  cookieStore.set(SESSION_COOKIE, token, persistentSessionCookieOptions(SESSION_TTL_SECONDS));
  return accountSession.id;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<AuthenticatedSessionUser | null> {
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
  const activeSession = await isAccountSessionActive({
    accountKind: AccountKind.USER,
    accountId: user.id,
    authVersion: user.sessionVersion,
    sessionId: tokenSession.sessionId,
  });
  if (!activeSession) return null;

  const session: AuthenticatedSessionUser = {
    id: user.id,
    shopId: user.shopId,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
    sessionId: tokenSession.sessionId,
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
      businessType: true,
      enabledModules: true,
      taxRate: true,
      receiptHeader: true,
      receiptFooter: true,
      defaultDepositPercent: true,
      productionSetup: true,
      onboardingCurrentStep: true,
      onboardingCompletedSteps: true,
      onboardingStartedAt: true,
      onboardingCompletedAt: true,
      isActive: true,
      city: true,
      credentialAddress: true,
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
