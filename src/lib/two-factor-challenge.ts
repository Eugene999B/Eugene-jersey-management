import "server-only";

import { randomUUID } from "node:crypto";
import { AccountKind } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";

export const TWO_FACTOR_CHALLENGE_COOKIE = "ejm_two_factor_challenge";
export const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 10 * 60;

export type TwoFactorChallenge = {
  accountKind: AccountKind;
  accountId: string;
  sessionVersion: number;
  redirectPath: string;
  challengeId: string;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to a long random value of at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function signTwoFactorChallenge(input: Omit<TwoFactorChallenge, "challengeId">) {
  return new SignJWT({ ...input, challengeId: randomUUID(), type: "two-factor-challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("ejm-two-factor")
    .setIssuedAt()
    .setExpirationTime(`${TWO_FACTOR_CHALLENGE_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyTwoFactorChallenge(token: string): Promise<TwoFactorChallenge | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
      audience: "ejm-two-factor",
    });
    if (
      payload.type !== "two-factor-challenge"
      || (payload.accountKind !== AccountKind.USER && payload.accountKind !== AccountKind.BUYER)
      || typeof payload.accountId !== "string"
      || typeof payload.sessionVersion !== "number"
      || typeof payload.redirectPath !== "string"
      || typeof payload.challengeId !== "string"
    ) return null;

    return {
      accountKind: payload.accountKind,
      accountId: payload.accountId,
      sessionVersion: payload.sessionVersion,
      redirectPath: payload.redirectPath,
      challengeId: payload.challengeId,
    };
  } catch {
    return null;
  }
}

export function twoFactorChallengeCookieOptions(secure = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    maxAge: TWO_FACTOR_CHALLENGE_TTL_SECONDS,
    expires: new Date(Date.now() + TWO_FACTOR_CHALLENGE_TTL_SECONDS * 1000),
    path: "/",
    priority: "high" as const,
  };
}
