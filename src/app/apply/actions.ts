"use server";

import { BusinessApplicationStatus, BusinessApplicationType, Prisma, ShopVerificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  applicationRequestFingerprint,
  findPublicApplicationByCredentials,
  normalisePublicApplicationInput,
  openApplicationStatuses,
  publicBusinessApplicationSchema,
  readApplicationAccessCookie,
  setApplicationAccessCookie,
  setApplicationReceiptCookie,
} from "@/lib/business-applications";
import { platformDb } from "@/lib/platform-db";
import { createApplicationStatusToken, createBusinessApplicationReference, hashApplicationStatusToken } from "@/lib/platform-support";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

function applicationPath(type: BusinessApplicationType) {
  return type === BusinessApplicationType.SHOP ? "/apply/shop" : "/apply/supplier";
}

function isWithdrawableStatus(status: BusinessApplicationStatus) {
  return status === BusinessApplicationStatus.SUBMITTED || status === BusinessApplicationStatus.CHANGES_REQUESTED;
}

async function enforcePublicApplicationLimits(duplicateFingerprint: string) {
  const requestFingerprint = await applicationRequestFingerprint();
  await Promise.all([
    enforceRateLimit({ key: `application:request:${requestFingerprint}`, limit: 6, windowSeconds: 60 * 60 }),
    enforceRateLimit({ key: `application:identity:${duplicateFingerprint}`, limit: 3, windowSeconds: 24 * 60 * 60 }),
  ]);
}

async function createApplicationWithUniqueReference(input: {
  type: BusinessApplicationType;
  statusTokenHash: string;
  duplicateFingerprint: string;
  businessName: string;
  legalBusinessName: string | null;
  businessRegistrationNumber: string | null;
  taxIdentificationNumber: string | null;
  contactName: string;
  email: string;
  phone: string;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string;
  categories: string | null;
  requestedServices: string | null;
  requestedShopId: string | null;
  applicantNotes: string | null;
}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await platformDb.businessApplication.create({
        data: {
          ...input,
          reference: createBusinessApplicationReference(input.type),
          consentGiven: true,
          consentedAt: new Date(),
          documentUrls: [],
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || attempt === 3) throw error;
    }
  }
  throw new Error("Unable to create a unique business application reference.");
}

export async function submitBusinessApplicationAction(formData: FormData) {
  const parsed = publicBusinessApplicationSchema.safeParse({
    type: formData.get("type"),
    businessName: formData.get("businessName"),
    legalBusinessName: formData.get("legalBusinessName"),
    businessRegistrationNumber: formData.get("businessRegistrationNumber"),
    taxIdentificationNumber: formData.get("taxIdentificationNumber"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    region: formData.get("region"),
    country: formData.get("country") || "Ghana",
    categories: formData.get("categories"),
    requestedServices: formData.get("requestedServices"),
    requestedShopId: formData.get("requestedShopId"),
    applicantNotes: formData.get("applicantNotes"),
    consentGiven: formData.get("consentGiven"),
    website: formData.get("website"),
  });
  const suppliedType = formData.get("type") === BusinessApplicationType.SUPPLIER ? BusinessApplicationType.SUPPLIER : BusinessApplicationType.SHOP;
  if (!parsed.success) redirect(`${applicationPath(suppliedType)}?error=invalid`);
  const input = normalisePublicApplicationInput(parsed.data);

  try {
    await enforcePublicApplicationLimits(input.duplicateFingerprint);
  } catch (error) {
    if (error instanceof RateLimitError) redirect(`${applicationPath(input.type)}?error=rate`);
    throw error;
  }

  if (input.type === BusinessApplicationType.SUPPLIER) {
    const requestedShop = await platformDb.shop.findFirst({
      where: {
        id: input.requestedShopId ?? "",
        isActive: true,
        verificationStatus: ShopVerificationStatus.VERIFIED,
      },
      select: { id: true },
    });
    if (!requestedShop) redirect("/apply/supplier?error=shop");
  }

  const duplicate = await platformDb.businessApplication.findFirst({
    where: {
      duplicateFingerprint: input.duplicateFingerprint,
      status: { in: [...openApplicationStatuses] },
    },
    select: { id: true },
  });
  if (duplicate) redirect(`${applicationPath(input.type)}?error=duplicate`);

  const statusToken = createApplicationStatusToken();
  const application = await createApplicationWithUniqueReference({
    type: input.type,
    statusTokenHash: hashApplicationStatusToken(statusToken),
    duplicateFingerprint: input.duplicateFingerprint,
    businessName: input.businessName,
    legalBusinessName: input.legalBusinessName,
    businessRegistrationNumber: input.businessRegistrationNumber,
    taxIdentificationNumber: input.taxIdentificationNumber,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    address: input.address,
    city: input.city,
    region: input.region,
    country: input.country,
    categories: input.categories,
    requestedServices: input.requestedServices,
    requestedShopId: input.requestedShopId,
    applicantNotes: input.applicantNotes,
  });

  await setApplicationReceiptCookie({ reference: application.reference, token: statusToken });
  redirect("/apply/submitted");
}

const statusLookupSchema = z.object({
  reference: z.string().trim().min(10).max(100).transform((value) => value.toUpperCase()),
  token: z.string().trim().min(20).max(200),
});

export async function lookupBusinessApplicationStatusAction(formData: FormData) {
  const parsed = statusLookupSchema.safeParse({ reference: formData.get("reference"), token: formData.get("token") });
  if (!parsed.success) redirect("/apply/status?error=invalid");

  const requestFingerprint = await applicationRequestFingerprint();
  try {
    await enforceRateLimit({ key: `application:status:${requestFingerprint}`, limit: 12, windowSeconds: 60 * 60 });
  } catch (error) {
    if (error instanceof RateLimitError) redirect("/apply/status?error=rate");
    throw error;
  }

  const application = await findPublicApplicationByCredentials(parsed.data.reference, parsed.data.token);
  if (!application) redirect("/apply/status?error=invalid");
  await setApplicationAccessCookie(parsed.data);
  redirect("/apply/status/result");
}

export async function withdrawBusinessApplicationAction() {
  const access = await readApplicationAccessCookie();
  if (!access) redirect("/apply/status?error=expired");
  const application = await findPublicApplicationByCredentials(access.reference, access.token);
  if (!application) redirect("/apply/status?error=expired");
  if (!isWithdrawableStatus(application.status)) {
    redirect("/apply/status/result?error=withdraw");
  }

  const changed = await platformDb.businessApplication.updateMany({
    where: { id: application.id, status: application.status },
    data: { status: BusinessApplicationStatus.WITHDRAWN },
  });
  if (changed.count !== 1) redirect("/apply/status/result?error=changed");
  redirect("/apply/status/result?withdrawn=true");
}
