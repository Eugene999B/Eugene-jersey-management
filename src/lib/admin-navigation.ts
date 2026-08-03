import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Coins,
  CreditCard,
  FileText,
  FolderKanban,
  Gift,
  HeartPulse,
  LifeBuoy,
  Megaphone,
  Search,
  Settings,
  Shield,
  Store,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { PlatformPermission } from "@/lib/platform-admin";

export type AdminNavSection = "Businesses" | "Plans & access" | "Billing" | "Support" | "Communications" | "Security" | "Platform settings";
export type AdminNavItem = {
  section: AdminNavSection;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  permission: PlatformPermission | null;
};

export const adminNavigationSections: readonly AdminNavSection[] = [
  "Businesses",
  "Plans & access",
  "Billing",
  "Support",
  "Communications",
  "Security",
  "Platform settings",
];

export const adminNavigationItems: readonly AdminNavItem[] = [
  { section: "Businesses", href: "/admin", label: "Platform overview", shortLabel: "Home", icon: BarChart3, permission: null },
  { section: "Businesses", href: "/admin/shops", label: "Businesses", shortLabel: "Businesses", icon: Store, permission: "shops" },
  { section: "Businesses", href: "/admin/applications", label: "Applications", shortLabel: "Apply", icon: ClipboardCheck, permission: "shops" },
  { section: "Plans & access", href: "/admin/access", label: "Access grants", shortLabel: "Access", icon: Gift, permission: "billing" },
  { section: "Plans & access", href: "/admin/staff", label: "Administrator staff", shortLabel: "Staff", icon: UserCog, permission: "workers" },
  { section: "Billing", href: "/admin/billing", label: "Plans and billing", shortLabel: "Billing", icon: CreditCard, permission: "billing" },
  { section: "Billing", href: "/admin/billing/invoices", label: "Subscription invoices", shortLabel: "Invoices", icon: FileText, permission: "billing" },
  { section: "Support", href: "/admin/investigate", label: "Investigation search", shortLabel: "Search", icon: Search, permission: "support" },
  { section: "Support", href: "/admin/support/cases", label: "Support cases", shortLabel: "Cases", icon: FolderKanban, permission: "support" },
  { section: "Support", href: "/admin/support", label: "Support desk", shortLabel: "Support", icon: LifeBuoy, permission: "support" },
  { section: "Communications", href: "/admin/billing/communications", label: "Communication credits", shortLabel: "Credits", icon: Coins, permission: "billing" },
  { section: "Communications", href: "/admin/broadcast", label: "Platform broadcast", shortLabel: "Broadcast", icon: Megaphone, permission: "broadcast" },
  { section: "Security", href: "/admin/activity", label: "Activity logs", shortLabel: "Activity", icon: Activity, permission: "activity" },
  { section: "Security", href: "/admin/security", label: "Security controls", shortLabel: "Security", icon: Shield, permission: "security" },
  { section: "Platform settings", href: "/admin/integrations", label: "Integration health", shortLabel: "Health", icon: HeartPulse, permission: "settings" },
  { section: "Platform settings", href: "/admin/settings", label: "Platform settings", shortLabel: "Settings", icon: Settings, permission: "settings" },
  { section: "Platform settings", href: "/admin/help", label: "Help centre", shortLabel: "Help", icon: BookOpen, permission: null },
] as const;

export const mobilePrimaryAdminHrefs = ["/admin", "/admin/shops", "/admin/billing", "/admin/support"] as const;

export function isAdminNavigationItemActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/billing" || href === "/admin/support") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function visibleAdminNavigationItems(allowedPermissions: PlatformPermission[] | null) {
  return adminNavigationItems.filter((item) => {
    if (item.permission === null) return allowedPermissions === null;
    return allowedPermissions === null || allowedPermissions.includes(item.permission);
  });
}

export function adminNavigationItemForPath(pathname: string) {
  return adminNavigationItems.find((item) => isAdminNavigationItemActive(pathname, item.href));
}
