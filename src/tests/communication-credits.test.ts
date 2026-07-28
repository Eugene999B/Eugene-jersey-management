import { readFileSync } from "node:fs";
import {
  CommunicationCreditChannel,
  NotificationChannel,
  Prisma,
  type CommunicationCreditPackage,
} from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  communicationCreditPackageSnapshot,
  communicationCreditPackageSnapshotSchema,
  creditChannelForNotification,
  packageTotalUnits,
  packageUnitPrice,
} from "@/lib/communication-credits";
import { canApproveCommercialChange } from "@/lib/subscription-plans";

function creditPackage(overrides: Partial<CommunicationCreditPackage> = {}): CommunicationCreditPackage {
  const now = new Date("2026-07-28T00:00:00.000Z");
  return {
    id: "credit-package-sms-starter",
    code: "SMS-STARTER",
    channel: CommunicationCreditChannel.SMS,
    name: "SMS Starter",
    description: "Approved starter SMS package",
    currency: "GHS",
    price: new Prisma.Decimal("80.00"),
    creditUnits: 100,
    bonusUnits: 20,
    isConfigured: true,
    isPublic: true,
    isActive: true,
    version: 3,
    createdById: "admin-a",
    updatedById: "admin-b",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("communication credit packages", () => {
  it("serializes immutable approved package terms and calculates total value", () => {
    const snapshot = communicationCreditPackageSnapshot(creditPackage());
    expect(snapshot).toEqual({
      code: "SMS-STARTER",
      channel: CommunicationCreditChannel.SMS,
      name: "SMS Starter",
      description: "Approved starter SMS package",
      currency: "GHS",
      price: "80.00",
      creditUnits: 100,
      bonusUnits: 20,
      isConfigured: true,
      isPublic: true,
      isActive: true,
      version: 3,
    });
    expect(communicationCreditPackageSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(packageTotalUnits(snapshot)).toBe(120);
    expect(packageUnitPrice(snapshot)).toBe(0.6667);
  });

  it("refuses to invent unit economics for an unconfigured package", () => {
    const snapshot = communicationCreditPackageSnapshot(creditPackage({ price: null, creditUnits: null, isConfigured: false, isPublic: false }));
    expect(snapshot.price).toBeNull();
    expect(snapshot.creditUnits).toBeNull();
    expect(packageTotalUnits(snapshot)).toBeNull();
    expect(packageUnitPrice(snapshot)).toBeNull();
  });

  it("maps only chargeable shop messaging channels to wallet channels", () => {
    expect(creditChannelForNotification(NotificationChannel.SMS)).toBe(CommunicationCreditChannel.SMS);
    expect(creditChannelForNotification(NotificationChannel.WHATSAPP)).toBe(CommunicationCreditChannel.WHATSAPP);
    expect(creditChannelForNotification(NotificationChannel.EMAIL)).toBeNull();
    expect(creditChannelForNotification(NotificationChannel.IN_APP)).toBeNull();
  });

  it("uses the existing second-administrator commercial approval rule", () => {
    expect(canApproveCommercialChange("admin-a", "admin-a")).toBe(false);
    expect(canApproveCommercialChange("admin-a", "admin-b")).toBe(true);
  });

  it("backfills zero balances and package placeholders without invented prices or units", () => {
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260728193000_communication_credit_wallets/migration.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("No package price or credit quantity was invented");
    expect(migration).toContain("INSERT INTO \"ShopCommunicationWallet\"");
    expect(migration).toContain("'SMS'::\"CommunicationCreditChannel\"");
    expect(migration).toContain("'WHATSAPP'::\"CommunicationCreditChannel\"");
    expect(migration).not.toMatch(/SMS-STARTER[^;]+DECIMAL|SMS-STARTER[^;]+[0-9]+\.[0-9]{2}/);
  });
});
