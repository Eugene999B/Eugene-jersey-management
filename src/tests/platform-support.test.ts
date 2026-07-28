import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applicationDuplicateFingerprint,
  createApplicationStatusToken,
  createBusinessApplicationReference,
  createSupportCaseReference,
  hashApplicationStatusToken,
  normaliseApplicationEmail,
  normaliseApplicationPhone,
  normaliseBusinessRegistrationNumber,
} from "@/lib/platform-support";

const releaseDate = new Date("2026-07-28T11:30:00.000Z");

describe("Release 26 support references", () => {
  it("creates stable human-readable case and application references", () => {
    expect(createSupportCaseReference(releaseDate, "ab-12-cd")).toBe("SUP-20260728-AB12CD00");
    expect(createBusinessApplicationReference("SHOP", releaseDate, "shop-26")).toBe("APP-SHP-20260728-SHOP2600");
    expect(createBusinessApplicationReference("SUPPLIER", releaseDate, "supplier")).toBe("APP-SUPL-20260728-SUPPLIER");
  });

  it("creates an opaque public status token and stores only its hash", () => {
    const token = createApplicationStatusToken();
    const hash = hashApplicationStatusToken(token);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashApplicationStatusToken(token)).toBe(hash);
  });
});

describe("Release 26 application duplicate controls", () => {
  it("normalises applicant identifiers without changing their business meaning", () => {
    expect(normaliseApplicationEmail("  OWNER@Example.COM ")).toBe("owner@example.com");
    expect(normaliseApplicationPhone("00 233 20 123 4567")).toBe("+233201234567");
    expect(normaliseBusinessRegistrationNumber("  bn  123 456 ")).toBe("BN 123 456");
    expect(normaliseBusinessRegistrationNumber("   ")).toBeNull();
  });

  it("produces the same duplicate fingerprint for formatting-only differences", () => {
    const first = applicationDuplicateFingerprint({
      email: "Owner@Example.com",
      phone: "00 233 20 123 4567",
      businessRegistrationNumber: "BN  123 456",
    });
    const second = applicationDuplicateFingerprint({
      email: " owner@example.COM ",
      phone: "+233201234567",
      businessRegistrationNumber: "bn 123 456",
    });
    expect(first).toBe(second);
  });
});

describe("Release 26 database foundation", () => {
  it("keeps case notes append-only and public application status tokens hashed", () => {
    const models = readFileSync(
      new URL("../../prisma/models/support-applications.prisma", import.meta.url),
      "utf8",
    );
    const migration = readFileSync(
      new URL("../../prisma/migrations/20260728230000_release26_support_applications/migration.sql", import.meta.url),
      "utf8",
    );
    const noteModel = models.split("model SupportCaseNote")[1]?.split("model BusinessApplication")[0] ?? "";

    expect(noteModel).toContain("createdAt");
    expect(noteModel).not.toContain("updatedAt");
    expect(models).toContain("statusTokenHash          String                    @unique");
    expect(migration).toContain('CONSTRAINT "BusinessApplication_consent_check" CHECK ("consentGiven" = true)');
    expect(migration).toContain('FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE');
  });
});
