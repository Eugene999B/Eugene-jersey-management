"use server";

import { AccountKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  revokeAccountSession,
  revokeOtherAccountSessions,
} from "@/lib/account-sessions";
import { audit } from "@/lib/audit";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { clearBuyerSessionCookie, getBuyerSession } from "@/lib/buyer-session";

const sessionIdSchema = z.string().trim().min(8).max(160);

type SessionActor = {
  accountKind: AccountKind;
  accountId: string;
  currentSessionId: string;
  shopId: string | null;
  userId: string | null;
  entityType: "User" | "BuyerAccount";
  securityPath: string;
  loginPath: string;
};

async function sessionActor(): Promise<SessionActor | null> {
  const workforce = await getSession();
  if (workforce) {
    return {
      accountKind: AccountKind.USER,
      accountId: workforce.id,
      currentSessionId: workforce.sessionId,
      shopId: workforce.shopId,
      userId: workforce.id,
      entityType: "User",
      securityPath: "/account/security",
      loginPath: "/login?sessionEnded=1",
    };
  }

  const buyer = await getBuyerSession();
  if (!buyer) return null;
  return {
    accountKind: AccountKind.BUYER,
    accountId: buyer.id,
    currentSessionId: buyer.sessionId,
    shopId: null,
    userId: null,
    entityType: "BuyerAccount",
    securityPath: "/buyer/security",
    loginPath: "/buyer/login?sessionEnded=1&next=/buyer/security",
  };
}

export async function revokeAccountSessionAction(formData: FormData) {
  const actor = await sessionActor();
  if (!actor) redirect("/login");
  const parsed = sessionIdSchema.safeParse(formData.get("sessionId"));
  if (!parsed.success) redirect(`${actor.securityPath}?sessionError=invalid`);

  const targetSessionId = parsed.data;
  const result = await revokeAccountSession({
    accountKind: actor.accountKind,
    accountId: actor.accountId,
    sessionId: targetSessionId,
    reason: targetSessionId === actor.currentSessionId ? "user-signed-out-device" : "user-revoked-device",
  });

  if (result.count !== 1) redirect(`${actor.securityPath}?sessionError=not-found`);

  await audit({
    shopId: actor.shopId,
    userId: actor.userId,
    action: "auth.session_revoked",
    entityType: "AccountSession",
    entityId: targetSessionId,
    metadata: {
      accountKind: actor.accountKind,
      currentDevice: targetSessionId === actor.currentSessionId,
    },
  });

  if (targetSessionId === actor.currentSessionId) {
    if (actor.accountKind === AccountKind.USER) await clearSessionCookie();
    else await clearBuyerSessionCookie();
    redirect(actor.loginPath);
  }

  revalidatePath(actor.securityPath);
  redirect(`${actor.securityPath}?sessionsUpdated=1`);
}

export async function revokeOtherAccountSessionsAction() {
  const actor = await sessionActor();
  if (!actor) redirect("/login");

  const result = await revokeOtherAccountSessions({
    accountKind: actor.accountKind,
    accountId: actor.accountId,
    currentSessionId: actor.currentSessionId,
    reason: "user-revoked-other-devices",
  });

  await audit({
    shopId: actor.shopId,
    userId: actor.userId,
    action: "auth.other_sessions_revoked",
    entityType: actor.entityType,
    entityId: actor.accountId,
    metadata: { revokedCount: result.count },
  });

  revalidatePath(actor.securityPath);
  redirect(`${actor.securityPath}?sessionsUpdated=${result.count}`);
}
