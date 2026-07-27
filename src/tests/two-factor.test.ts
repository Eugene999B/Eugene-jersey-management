import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTwoFactorSetup,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  findRecoveryCodeIndex,
  generateTotpCode,
  hashRecoveryCodes,
  verifyTotpCode,
} from "@/lib/two-factor";

const ORIGINAL_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY;

describe("optional two-factor authentication primitives", () => {
  beforeEach(() => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = "test-only-two-factor-encryption-key-0123456789";
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    else process.env.TWO_FACTOR_ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it("encrypts and decrypts authenticator secrets", () => {
    const encrypted = encryptTwoFactorSecret("JBSWY3DPEHPK3PXP");
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptTwoFactorSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("accepts the current authenticator code and a one-step clock window", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const timestamp = Date.UTC(2026, 6, 27, 12, 0, 0);
    const current = generateTotpCode(secret, timestamp);
    const previous = generateTotpCode(secret, timestamp - 30_000);

    expect(verifyTotpCode(secret, current, timestamp)).toBe(true);
    expect(verifyTotpCode(secret, previous, timestamp)).toBe(true);
    expect(verifyTotpCode(secret, "000000", timestamp)).toBe(false);
  });

  it("creates unique recovery codes that are stored only as hashes", () => {
    const setup = createTwoFactorSetup("owner@example.com");
    expect(setup.recoveryCodes).toHaveLength(10);
    expect(new Set(setup.recoveryCodes).size).toBe(10);
    expect(setup.recoveryCodeHashes).toHaveLength(10);
    expect(setup.recoveryCodeHashes[0]).not.toContain(setup.recoveryCodes[0]);
    expect(findRecoveryCodeIndex(setup.recoveryCodes[0], setup.recoveryCodeHashes)).toBe(0);
  });

  it("does not match a recovery code from another set", () => {
    const first = createTwoFactorSetup("first@example.com");
    const secondHashes = hashRecoveryCodes(createTwoFactorSetup("second@example.com").recoveryCodes);
    expect(findRecoveryCodeIndex(first.recoveryCodes[0], secondHashes)).toBe(-1);
  });
});
