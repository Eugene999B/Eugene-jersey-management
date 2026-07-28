import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  AccountKind,
  EmailDeliveryStatus,
  PasswordRecoveryChannel,
  Role,
} from "@prisma/client";
import { platformDb } from "@/lib/platform-db";
import { hashToken } from "@/lib/tokens";

export const RELEASE28_STAFF_LOGIN_ID = "EJM-E2E-RECOVERY";
export const RELEASE28_STAFF_EMAIL = "release28-recovery-staff@ejm.test";
export const RELEASE28_STAFF_PHONE = "+233200000128";
export const RELEASE28_STAFF_CHALLENGE = "release28-staff-recovery-public-token-2026";
export const RELEASE28_STAFF_CODE = "482913";

export const RELEASE28_BUYER_PHONE = "+233200000129";
export const RELEASE28_BUYER_EMAIL = "release28-recovery-buyer@ejm.test";
export const RELEASE28_BUYER_CHALLENGE = "release28-buyer-recovery-public-token-2026";
export const RELEASE28_BUYER_CODE = "593824";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Release 28 browser seed must never run in production.");
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 12) throw new Error("E2E_PASSWORD of at least 12 characters is required.");
  const passwordHash = await bcrypt.hash(password, 12);

  const staff = await platformDb.user.upsert({
    where: { email: RELEASE28_STAFF_EMAIL },
    update: {
      adminLoginId: RELEASE28_STAFF_LOGIN_ID,
      name: "EJM Release 28 Recovery Staff",
      phone: RELEASE28_STAFF_PHONE,
      passwordHash,
      role: Role.SUPER_ADMIN,
      shopId: null,
      isActive: true,
      sessionVersion: 0,
      failedLoginCount: 0,
      lockUntil: null,
    },
    create: {
      adminLoginId: RELEASE28_STAFF_LOGIN_ID,
      email: RELEASE28_STAFF_EMAIL,
      name: "EJM Release 28 Recovery Staff",
      phone: RELEASE28_STAFF_PHONE,
      passwordHash,
      role: Role.SUPER_ADMIN,
      shopId: null,
      isActive: true,
    },
  });

  const buyer = await platformDb.buyerAccount.upsert({
    where: { phone: RELEASE28_BUYER_PHONE },
    update: {
      email: RELEASE28_BUYER_EMAIL,
      name: "EJM Release 28 Recovery Buyer",
      passwordHash,
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
    create: {
      phone: RELEASE28_BUYER_PHONE,
      email: RELEASE28_BUYER_EMAIL,
      name: "EJM Release 28 Recovery Buyer",
      passwordHash,
      phoneVerifiedAt: new Date(),
      isActive: true,
    },
  });

  await platformDb.passwordRecoveryChallenge.deleteMany({
    where: {
      OR: [
        { accountKind: AccountKind.USER, accountId: staff.id },
        { accountKind: AccountKind.BUYER, accountId: buyer.id },
      ],
    },
  });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await platformDb.passwordRecoveryChallenge.createMany({
    data: [
      {
        publicTokenHash: hashToken(RELEASE28_STAFF_CHALLENGE),
        accountKind: AccountKind.USER,
        accountId: staff.id,
        channel: PasswordRecoveryChannel.SMS,
        destination: RELEASE28_STAFF_PHONE,
        codeHash: hashToken(RELEASE28_STAFF_CODE),
        expiresAt,
        providerReference: "E2E-STAFF-RECOVERY",
        deliveryStatus: EmailDeliveryStatus.ACCEPTED,
      },
      {
        publicTokenHash: hashToken(RELEASE28_BUYER_CHALLENGE),
        accountKind: AccountKind.BUYER,
        accountId: buyer.id,
        channel: PasswordRecoveryChannel.SMS,
        destination: RELEASE28_BUYER_PHONE,
        codeHash: hashToken(RELEASE28_BUYER_CODE),
        expiresAt,
        providerReference: "E2E-BUYER-RECOVERY",
        deliveryStatus: EmailDeliveryStatus.ACCEPTED,
      },
    ],
  });

  console.log("Release 28 recovery browser identities and one-time challenges are ready.");
  await platformDb.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});