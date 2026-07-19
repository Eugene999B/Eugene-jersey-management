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
  return verifySessionToken(token);
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
    },
  });

  if (!shop) {
    await clearSessionCookie();
    redirect("/login?error=shop-not-found");
  }

  return shop;
}
