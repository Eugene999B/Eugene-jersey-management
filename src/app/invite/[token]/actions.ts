"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { strongPasswordSchema } from "@/lib/password-policy";
import { hashToken } from "@/lib/tokens";
import {
  acceptStaffInviteWithinPlan,
  SubscriptionEntitlementError,
  SubscriptionLimitError,
} from "@/lib/subscription-entitlements";

const schema = z.object({
  token: z.string().min(20),
  name: z.string().trim().min(2).max(120),
  password: strongPasswordSchema,
});

export async function acceptInviteAction(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid-invite");

  const outcome = await acceptStaffInviteWithinPlan({
    tokenHash: hashToken(parsed.data.token),
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
  })
    .then((result) => ({ result, error: null as string | null }))
    .catch((error) => ({
      result: null,
      error: error instanceof SubscriptionLimitError
        ? "plan-staff-limit"
        : error instanceof SubscriptionEntitlementError
          ? "invalid-invite"
          : "invalid-invite",
    }));
  if (!outcome.result) redirect(`/login?error=${outcome.error}`);

  await audit({
    shopId: outcome.result.invite.shopId,
    userId: outcome.result.user.id,
    action: "staff.invite_accepted",
    entityType: "User",
    entityId: outcome.result.user.id,
  });
  redirect("/login");
}
