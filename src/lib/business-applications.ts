import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { BusinessApplicationStatus, BusinessApplicationType } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { platformDb } from "@/lib/platform-db";
import {
  applicationDuplicateFingerprint,
  hashApplicationStatusToken,
  normaliseApplicationEmail,
  normaliseApplicationPhone,
  normaliseBusinessRegistrationNumber,
} from "@/lib/platform-support";
import {
  buildLocationSearchText,
  canonicalGhanaRegion,
  cleanLocationText,
} from "@/lib/ghana-locations";

export const APPLICATION_RECEIPT_COOKIE = "ejm_application_receipt";
export const APPLICATION_ACCESS_COOKIE = "ejm_application_access";

export const openApplicationStatuses = [
  BusinessApplicationStatus.SUBMITTED,
  BusinessApplicationStatus.UNDER_REVIEW,
  BusinessApplicationStatus.CHANGES_REQUESTED,
] as const;

const optionalText = (maximum: number) => z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.string().max(maximum).optional(),
);

const optionalCoordinate = (minimum: number, maximum: number) => z.preprocess(
  (value) => String(value ?? "").trim() || undefined,
  z.coerce.number().min(minimum).max(maximum).optional(),
);

export const publicBusinessApplicationSchema = z
  .object({
    type: z.nativeEnum(BusinessApplicationType),
    businessName: z.string().trim().min(2).max(160),
    legalBusinessName: optionalText(180),
    businessRegistrationNumber: optionalText(100),
    taxIdentificationNumber: optionalText(100),
    contactName: z.string().trim().min(2).max(140),
    email: z.string().email().max(180),
    phone: z.string().trim().min(7).max(40),
    address: optionalText(500),
    city: optionalText(160),
    region: optionalText(100),
    district: optionalText(180),
    suburb: optionalText(160),
    digitalAddress: optionalText(40),
    landmark: optionalText(700),
    latitude: optionalCoordinate(-90, 90),
    longitude: optionalCoordinate(-180, 180),
    country: z.string().trim().min(2).max(100).default("Ghana"),
    categories: optionalText(700),
    requestedServices: optionalText(1000),
    requestedShopId: optionalText(100),
    applicantNotes: optionalText(3000),
    consentGiven: z.preprocess((value) => value === "true" || value === "on", z.boolean()),
    website: optionalText(500),
  })
  .superRefine((value, context) => {
    if (!value.consentGiven) context.addIssue({ code: "custom", path: ["consentGiven"], message: "Consent is required." });
    if (value.website) context.addIssue({ code: "custom", path: ["website"], message: "Automated submission rejected." });
    if (value.type === BusinessApplicationType.SUPPLIER && !value.requestedShopId) {
      context.addIssue({ code: "custom", path: ["requestedShopId"], message: "Choose the shop you want to supply." });
    }
    if (value.type === BusinessApplicationType.SHOP && value.requestedShopId) {
      context.addIssue({ code: "custom", path: ["requestedShopId"], message: "Shop applications cannot request a supplier relationship." });
    }
    if (value.region && !canonicalGhanaRegion(value.region)) {
      context.addIssue({ code: "custom", path: ["region"], message: "Choose one of Ghana's 16 regions." });
    }
    if (value.type === BusinessApplicationType.SHOP) {
      if (!value.region) context.addIssue({ code: "custom", path: ["region"], message: "Region is required." });
      if (!value.district) context.addIssue({ code: "custom", path: ["district"], message: "District is required." });
      if (!value.city) context.addIssue({ code: "custom", path: ["city"], message: "Town or community is required." });
    }
  });

export type PublicBusinessApplicationInput = z.infer<typeof publicBusinessApplicationSchema>;

type ApplicationCookiePayload = { reference: string; token: string };

function encodeCookiePayload(payload: ApplicationCookiePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCookiePayload(value: string | undefined): ApplicationCookiePayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<ApplicationCookiePayload>;
    if (typeof parsed.reference !== "string" || typeof parsed.token !== "string") return null;
    if (parsed.reference.length > 100 || parsed.token.length > 200) return null;
    return { reference: parsed.reference, token: parsed.token };
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/apply",
    maxAge,
  };
}

export async function setApplicationReceiptCookie(payload: ApplicationCookiePayload) {
  const cookieStore = await cookies();
  cookieStore.set(APPLICATION_RECEIPT_COOKIE, encodeCookiePayload(payload), cookieOptions(10 * 60));
}

export async function setApplicationAccessCookie(payload: ApplicationCookiePayload) {
  const cookieStore = await cookies();
  cookieStore.set(APPLICATION_ACCESS_COOKIE, encodeCookiePayload(payload), cookieOptions(30 * 60));
}

export async function readApplicationReceiptCookie() {
  const cookieStore = await cookies();
  return decodeCookiePayload(cookieStore.get(APPLICATION_RECEIPT_COOKIE)?.value);
}

export async function readApplicationAccessCookie() {
  const cookieStore = await cookies();
  return decodeCookiePayload(cookieStore.get(APPLICATION_ACCESS_COOKIE)?.value);
}

function safeTokenHashMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashApplicationStatusToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function findPublicApplicationByCredentials(reference: string, token: string) {
  const application = await platformDb.businessApplication.findUnique({
    where: { reference: reference.trim().toUpperCase() },
    select: {
      id: true,
      reference: true,
      statusTokenHash: true,
      type: true,
      status: true,
      businessName: true,
      submittedAt: true,
      reviewedAt: true,
      decisionReason: true,
      updatedAt: true,
    },
  });
  if (!application || !safeTokenHashMatches(token.trim(), application.statusTokenHash)) return null;
  return {
    id: application.id,
    reference: application.reference,
    type: application.type,
    status: application.status,
    businessName: application.businessName,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    decisionReason: application.decisionReason,
    updatedAt: application.updatedAt,
  };
}

export function normalisePublicApplicationInput(input: PublicBusinessApplicationInput) {
  const email = normaliseApplicationEmail(input.email);
  const phone = normaliseApplicationPhone(input.phone);
  const businessRegistrationNumber = normaliseBusinessRegistrationNumber(input.businessRegistrationNumber);
  const region = input.region ? canonicalGhanaRegion(input.region) : null;
  const location = region && input.district && input.city
    ? {
        country: "Ghana",
        region,
        district: cleanLocationText(input.district, 180) as string,
        town: cleanLocationText(input.city, 160) as string,
        area: cleanLocationText(input.suburb, 160),
        digitalAddress: cleanLocationText(input.digitalAddress, 40)?.toUpperCase() ?? null,
        streetAddress: cleanLocationText(input.address, 500),
        landmark: cleanLocationText(input.landmark, 700),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      }
    : null;
  return {
    ...input,
    email,
    phone,
    businessRegistrationNumber,
    legalBusinessName: input.legalBusinessName?.trim() || null,
    taxIdentificationNumber: input.taxIdentificationNumber?.trim().toUpperCase() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    region,
    district: input.district?.trim() || null,
    suburb: input.suburb?.trim() || null,
    digitalAddress: input.digitalAddress?.trim().toUpperCase() || null,
    landmark: input.landmark?.trim() || null,
    categories: input.categories?.trim() || null,
    requestedServices: input.requestedServices?.trim() || null,
    requestedShopId: input.requestedShopId?.trim() || null,
    applicantNotes: input.applicantNotes?.trim() || null,
    location: location ? { ...location, searchText: buildLocationSearchText(location) } : null,
    duplicateFingerprint: applicationDuplicateFingerprint({ email, phone, businessRegistrationNumber }),
  };
}

export async function applicationRequestFingerprint() {
  const requestHeaders = await headers();
  const raw = requestHeaders.get("cf-connecting-ip")
    ?? requestHeaders.get("x-real-ip")
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  return createHash("sha256").update(`ejm-application:${raw}`, "utf8").digest("hex");
}
