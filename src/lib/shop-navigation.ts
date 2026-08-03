import type { Role } from "@prisma/client";
import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileDown,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Palette,
  ReceiptText,
  Settings,
  ShoppingCart,
  WandSparkles,
  Tags,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { businessModuleEnabled, type BusinessModuleKey } from "@/lib/business-modules";
import { canSeeNav } from "@/lib/rbac";
import type { SubscriptionFeature } from "@/lib/subscription-hardening";

export type ShopNavKey = keyof ReturnType<typeof canSeeNav>;
export type ShopNavSection = "Core" | "Customers & money" | "Operations" | "Management";

export type ShopNavItem = {
  section: ShopNavSection;
  key: ShopNavKey;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  requiredModule?: BusinessModuleKey;
  requiredFeature?: SubscriptionFeature;
};

export const shopNavigationSections: readonly ShopNavSection[] = [
  "Core",
  "Customers & money",
  "Operations",
  "Management",
];

export const shopNavigationItems: readonly ShopNavItem[] = [
  { section: "Core", key: "dashboard", href: "/dashboard", label: "Home", shortLabel: "Home", description: "Business overview and attention items", icon: LayoutDashboard },
  { section: "Core", key: "pos", href: "/dashboard/pos", label: "Sales & POS", shortLabel: "Sell", description: "Start and complete a sale", icon: ShoppingCart },
  { section: "Core", key: "orders", href: "/dashboard/orders", label: "Orders & jobs", shortLabel: "Orders", description: "Track orders and operational work", icon: ClipboardList },
  { section: "Core", key: "catalog", href: "/dashboard/catalog", label: "Items & stock", shortLabel: "Items", description: "Products, services and stock", icon: Boxes },
  { section: "Customers & money", key: "customers", href: "/dashboard/customers", label: "Customers", shortLabel: "Customers", description: "Customer records and contact details", icon: Users },
  { section: "Customers & money", key: "debts", href: "/dashboard/debts", label: "Payments & credit", shortLabel: "Payments", description: "Balances, installments and collections", icon: CreditCard },
  { section: "Customers & money", key: "messages", href: "/dashboard/messages", label: "Customer messages", shortLabel: "Messages", description: "Send customer communication", icon: MessageCircle, requiredFeature: "CUSTOMER_MESSAGING" },
  { section: "Operations", key: "designs", href: "/dashboard/designs", label: "Printing & production", shortLabel: "Production", description: "Design and production tools", icon: Palette, requiredModule: "PRINTING_PRODUCTION", requiredFeature: "DESIGN_STUDIO" },
  { section: "Operations", key: "suppliers", href: "/dashboard/suppliers", label: "Suppliers & purchasing", shortLabel: "Suppliers", description: "Suppliers and purchase operations", icon: Truck, requiredModule: "SUPPLIERS_PURCHASING", requiredFeature: "SUPPLIERS" },
  { section: "Operations", key: "commerce", href: "/dashboard/commerce", label: "Online selling", shortLabel: "Online", description: "Storefront and online ordering", icon: Tags, requiredModule: "ONLINE_SELLING", requiredFeature: "STOREFRONT" },
  { section: "Operations", key: "network", href: "/dashboard/network", label: "Marketplace network", shortLabel: "Market", description: "Business marketplace connections", icon: Link2, requiredModule: "MARKETPLACE", requiredFeature: "SHOP_NETWORK" },
  { section: "Management", key: "reports", href: "/dashboard/reports", label: "Reports", shortLabel: "Reports", description: "Business performance and finance", icon: BarChart3 },
  { section: "Management", key: "exports", href: "/dashboard/exports", label: "Advanced exports", shortLabel: "Exports", description: "Download operational records", icon: FileDown, requiredFeature: "ADVANCED_REPORTS" },
  { section: "Management", key: "closing", href: "/dashboard/closing", label: "Daily closing", shortLabel: "Closing", description: "Close and verify the business day", icon: ClipboardCheck },
  { section: "Management", key: "staff", href: "/dashboard/staff", label: "Staff & permissions", shortLabel: "Staff", description: "Team accounts and access", icon: Users },
  { section: "Management", key: "activity", href: "/dashboard/activity", label: "Activity & security", shortLabel: "Activity", description: "Audit activity and security events", icon: Activity },
  { section: "Management", key: "subscription", href: "/dashboard/subscription", label: "Modules, plan & usage", shortLabel: "Plan", description: "Enabled modules and account limits", icon: ReceiptText },
  { section: "Management", key: "settings", href: "/dashboard/setup", label: "Business setup", shortLabel: "Setup", description: "Guided identity, location, payments, catalogue and production configuration", icon: WandSparkles },
  { section: "Management", key: "settings", href: "/dashboard/settings", label: "Business settings", shortLabel: "Settings", description: "Identity, payments and configuration", icon: Settings },
] as const;

export const mobilePrimaryShopKeys: readonly ShopNavKey[] = ["dashboard", "pos", "orders", "catalog"];

export function isShopNavigationItemActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function visibleShopNavigationItems(
  role: Role,
  enabledModules: readonly string[],
  includedFeatures: readonly SubscriptionFeature[],
) {
  const visible = canSeeNav(role);
  return shopNavigationItems.filter((item) =>
    visible[item.key]
    && (!item.requiredModule || businessModuleEnabled(enabledModules, item.requiredModule))
    && (!item.requiredFeature || includedFeatures.includes(item.requiredFeature)),
  );
}

export function shopNavigationItemForPath(pathname: string) {
  return shopNavigationItems.find((item) => isShopNavigationItemActive(pathname, item.href));
}
