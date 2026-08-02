import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 5;

function encryptionKey() {
  const configured = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  if (!configured || configured.length < 32) {
    throw new Error("TWO_FACTOR_ENCRYPTION_KEY must contain at least 32 characters before two-factor authentication can be used.");
  }
  return createHash("sha256").update(configured, "utf8").digest();
}

export function isTwoFactorConfigured() {
  return Boolean(process.env.TWO_FACTOR_ENCRYPTION_KEY && process.env.TWO_FACTOR_ENCRYPTION_KEY.length >= 32);
}

function base32Encode(input: Buffer) {
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");

  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of normalized) {
    const alphabetIndex = BASE32_ALPHABET.indexOf(character);
    if (alphabetIndex < 0) throw new Error("INVALID_TWO_FACTOR_SECRET");
    bits += alphabetIndex.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function fixedLengthCode(value: number) {
  return String(value % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function generateTotpCode(secret: string, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return fixedLengthCode(binary);
}

function safeCodeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyTotpCode(secret: string, candidate: string, timestamp = Date.now(), window = 1) {
  const normalized = candidate.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secret, timestamp + offset * TOTP_PERIOD_SECONDS * 1000);
    if (safeCodeEqual(expected, normalized)) return true;
  }
  return false;
}

export function encryptTwoFactorSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTwoFactorSecret(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("INVALID_ENCRYPTED_TWO_FACTOR_SECRET");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(value: string) {
  const normalized = normalizeRecoveryCode(value);
  return createHmac("sha256", encryptionKey()).update(`ejm-recovery:${normalized}`, "utf8").digest("hex");
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(RECOVERY_CODE_BYTES)).slice(0, 8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function hashRecoveryCodes(codes: string[]) {
  return codes.map(hashRecoveryCode);
}

export function findRecoveryCodeIndex(candidate: string, hashes: string[]) {
  const candidateHash = hashRecoveryCode(candidate);
  return hashes.findIndex((storedHash) => safeCodeEqual(storedHash, candidateHash));
}

export function createTwoFactorSetup(accountLabel: string) {
  const secret = base32Encode(randomBytes(20));
  const recoveryCodes = generateRecoveryCodes();
  const issuer = "Eugene Shop Management";
  const otpauthUri = `otpauth://totp/${encodeURIComponent(`${issuer}:${accountLabel}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;

  return {
    secret,
    encryptedSecret: encryptTwoFactorSecret(secret),
    recoveryCodes,
    recoveryCodeHashes: hashRecoveryCodes(recoveryCodes),
    otpauthUri,
  };
}
