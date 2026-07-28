import { createHash, randomBytes } from "node:crypto";

type BusinessApplicationReferenceType = "SHOP" | "SUPPLIER";

function utcDateStamp(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function normaliseSuffix(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8).padEnd(8, "0");
}

function randomReferenceSuffix() {
  return randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
}

export function createSupportCaseReference(now = new Date(), suffix = randomReferenceSuffix()) {
  return `SUP-${utcDateStamp(now)}-${normaliseSuffix(suffix)}`;
}

export function createBusinessApplicationReference(
  type: BusinessApplicationReferenceType,
  now = new Date(),
  suffix = randomReferenceSuffix(),
) {
  const prefix = type === "SHOP" ? "SHP" : "SUPL";
  return `APP-${prefix}-${utcDateStamp(now)}-${normaliseSuffix(suffix)}`;
}

export function createApplicationStatusToken() {
  return randomBytes(24).toString("base64url");
}

export function hashApplicationStatusToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normaliseApplicationEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normaliseApplicationPhone(value: string) {
  return value.trim().replace(/[^0-9+]/g, "").replace(/^00/, "+");
}

export function normaliseBusinessRegistrationNumber(value: string | null | undefined) {
  const normalised = value?.trim().toUpperCase().replace(/\s+/g, " ");
  return normalised || null;
}

export function applicationDuplicateFingerprint(input: {
  email: string;
  phone: string;
  businessRegistrationNumber?: string | null;
}) {
  const canonical = [
    normaliseApplicationEmail(input.email),
    normaliseApplicationPhone(input.phone),
    normaliseBusinessRegistrationNumber(input.businessRegistrationNumber) ?? "",
  ].join("|");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
