export const PLATFORM_NAME = "Eugene Shop Management";
export const PLATFORM_SHORT_NAME = "ESM";
export const PLATFORM_TAGLINE = "Commerce • services • production";
export const PLATFORM_DESCRIPTION = "Professional multi-business sales, orders, stock, services, production, customers and management operations.";
export const PLATFORM_MARK_PATH = "/brand/esm-mark.svg";
export const PLATFORM_LOGO_PATH = "/brand/esm-logo.svg";
export const PLATFORM_EMAIL_USER_AGENT = "Eugene-Shop-Management/1.0";
export const PLATFORM_PAYMENTS_LABEL = "ESM administrator main account";

export const BUSINESS_TYPE_OPTIONS = [
  { value: "RETAIL", label: "Retail" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "SERVICES", label: "Services" },
  { value: "PRODUCTION_PRINTING", label: "Production / printing" },
  { value: "RENTAL", label: "Rental" },
  { value: "MIXED", label: "Mixed business" },
] as const;

export function businessTypeLabel(value: string | null | undefined) {
  return BUSINESS_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Mixed business";
}
