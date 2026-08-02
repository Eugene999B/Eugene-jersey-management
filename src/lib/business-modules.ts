import type { BusinessType } from "@prisma/client";
import type { SubscriptionFeature } from "@/lib/subscription-hardening";

export const CORE_BUSINESS_MODULES = [
  { key: "HOME", label: "Home", description: "Business overview, alerts and daily priorities." },
  { key: "SALES", label: "Sales", description: "Point of sale, checkout and completed sales." },
  { key: "ORDERS", label: "Orders", description: "Customer orders, fulfilment and production status." },
  { key: "ITEMS", label: "Items", description: "Products, services, options, prices and stock." },
  { key: "CUSTOMERS", label: "Customers", description: "Customer records, balances and history." },
  { key: "PAYMENTS", label: "Payments", description: "Payments, credit, balances and collections." },
  { key: "REPORTS", label: "Reports", description: "Essential sales, stock and business reports." },
  { key: "SETTINGS", label: "Settings", description: "Business identity, payment and operating settings." },
] as const;

export const OPTIONAL_BUSINESS_MODULE_KEYS = [
  "PRINTING_PRODUCTION",
  "SERVICES_JOBS",
  "RENTALS",
  "SUPPLIERS_PURCHASING",
  "ONLINE_SELLING",
  "MARKETPLACE",
  "MULTI_LOCATION_STOCK",
  "ADVANCED_ACCOUNTING",
] as const;

export type BusinessModuleKey = (typeof OPTIONAL_BUSINESS_MODULE_KEYS)[number];

export type BusinessModuleDefinition = {
  key: BusinessModuleKey;
  label: string;
  description: string;
  status: "AVAILABLE" | "PLANNED";
  requiredFeature?: SubscriptionFeature;
  dashboardPrefixes: readonly string[];
  recommendedFor: readonly BusinessType[];
};

export const OPTIONAL_BUSINESS_MODULES: readonly BusinessModuleDefinition[] = [
  {
    key: "PRINTING_PRODUCTION",
    label: "Printing and production",
    description: "Design Studio, artwork preparation and garment-production tools.",
    status: "AVAILABLE",
    requiredFeature: "DESIGN_STUDIO",
    dashboardPrefixes: ["/dashboard/designs"],
    recommendedFor: ["PRODUCTION_PRINTING", "MIXED"],
  },
  {
    key: "SERVICES_JOBS",
    label: "Services and job management",
    description: "Service bookings, assigned work, due dates and completion evidence.",
    status: "PLANNED",
    dashboardPrefixes: [],
    recommendedFor: ["SERVICES", "MIXED"],
  },
  {
    key: "RENTALS",
    label: "Rentals and equipment hire",
    description: "Rental assets, availability, bookings, deposits and returns.",
    status: "PLANNED",
    dashboardPrefixes: [],
    recommendedFor: ["RENTAL", "MIXED"],
  },
  {
    key: "SUPPLIERS_PURCHASING",
    label: "Suppliers and purchasing",
    description: "Supplier records, purchase workflows and replenishment operations.",
    status: "AVAILABLE",
    requiredFeature: "SUPPLIERS",
    dashboardPrefixes: ["/dashboard/suppliers"],
    recommendedFor: ["RETAIL", "WHOLESALE", "PRODUCTION_PRINTING", "MIXED"],
  },
  {
    key: "ONLINE_SELLING",
    label: "Online selling",
    description: "Storefront availability, online checkout, delivery and collection controls.",
    status: "AVAILABLE",
    requiredFeature: "STOREFRONT",
    dashboardPrefixes: ["/dashboard/commerce"],
    recommendedFor: ["RETAIL", "WHOLESALE", "SERVICES", "PRODUCTION_PRINTING", "RENTAL", "MIXED"],
  },
  {
    key: "MARKETPLACE",
    label: "Marketplace",
    description: "Marketplace participation and business-to-business partner tools.",
    status: "AVAILABLE",
    requiredFeature: "SHOP_NETWORK",
    dashboardPrefixes: ["/dashboard/network"],
    recommendedFor: ["RETAIL", "WHOLESALE", "SERVICES", "PRODUCTION_PRINTING", "RENTAL", "MIXED"],
  },
  {
    key: "MULTI_LOCATION_STOCK",
    label: "Multi-location stock",
    description: "Location-specific inventory, transfers and consolidated availability.",
    status: "PLANNED",
    dashboardPrefixes: [],
    recommendedFor: ["RETAIL", "WHOLESALE", "MIXED"],
  },
  {
    key: "ADVANCED_ACCOUNTING",
    label: "Advanced accounting",
    description: "Ledgers, reconciliations, accounting exports and deeper financial controls.",
    status: "PLANNED",
    dashboardPrefixes: [],
    recommendedFor: ["WHOLESALE", "MIXED"],
  },
] as const;

export const AVAILABLE_OPTIONAL_BUSINESS_MODULES = OPTIONAL_BUSINESS_MODULES.filter(
  (module) => module.status === "AVAILABLE",
);

export function normalizeEnabledModules(values: readonly string[] | null | undefined): BusinessModuleKey[] {
  const selected = new Set(values ?? []);
  return OPTIONAL_BUSINESS_MODULE_KEYS.filter((key) => selected.has(key));
}

export function businessModuleEnabled(values: readonly string[] | null | undefined, key: BusinessModuleKey) {
  return normalizeEnabledModules(values).includes(key);
}

export function businessModuleForDashboardPath(pathname: string) {
  return AVAILABLE_OPTIONAL_BUSINESS_MODULES.find((module) =>
    module.dashboardPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  ) ?? null;
}

export function defaultEnabledModulesForBusinessType(businessType: BusinessType): BusinessModuleKey[] {
  return AVAILABLE_OPTIONAL_BUSINESS_MODULES
    .filter((module) => module.recommendedFor.includes(businessType))
    .map((module) => module.key);
}
