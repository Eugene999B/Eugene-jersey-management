from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"Expected one match in {path}, found {text.count(old)}")
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    "prisma/schema.prisma",
    '  currency                   String                 @default("GHS")\n',
    '  currency                   String                 @default("GHS")\n'
    '  taxRate                    Decimal                @default(0) @db.Decimal(5, 2)\n'
    '  receiptHeader              String?\n'
    '  receiptFooter              String?\n'
    '  defaultDepositPercent      Int                    @default(0)\n'
    '  productionSetup            Json                   @default("{}")\n'
    '  onboardingCurrentStep      Int                    @default(1)\n'
    '  onboardingCompletedSteps   Int[]                  @default([])\n'
    '  onboardingStartedAt        DateTime?\n'
    '  onboardingCompletedAt      DateTime?\n',
)

replace_once(
    "src/lib/shop-navigation.ts",
    '  Settings,\n  ShoppingCart,\n',
    '  Settings,\n  ShoppingCart,\n  WandSparkles,\n',
)
replace_once(
    "src/lib/shop-navigation.ts",
    '  { section: "Management", key: "subscription", href: "/dashboard/subscription", label: "Modules, plan & usage", shortLabel: "Plan", description: "Enabled modules and account limits", icon: ReceiptText },\n  { section: "Management", key: "settings", href: "/dashboard/settings", label: "Business settings", shortLabel: "Settings", description: "Identity, payments and configuration", icon: Settings },\n',
    '  { section: "Management", key: "subscription", href: "/dashboard/subscription", label: "Modules, plan & usage", shortLabel: "Plan", description: "Enabled modules and account limits", icon: ReceiptText },\n  { section: "Management", key: "settings", href: "/dashboard/setup", label: "Business setup", shortLabel: "Setup", description: "Guided identity, location, payments, catalogue and production configuration", icon: WandSparkles },\n  { section: "Management", key: "settings", href: "/dashboard/settings", label: "Business settings", shortLabel: "Settings", description: "Identity, payments and configuration", icon: Settings },\n',
)

replace_once(
    "src/app/dashboard/page.tsx",
    'import { AlertTriangle, ArrowRight, BarChart3, Boxes, ClipboardList, CreditCard, Palette, ShoppingBag, Users } from "lucide-react";\n',
    'import { AlertTriangle, ArrowRight, BarChart3, Boxes, ClipboardList, CreditCard, Palette, ShoppingBag, Users, WandSparkles } from "lucide-react";\n',
)
replace_once(
    "src/app/dashboard/page.tsx",
    '      {params.error === "permission" ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Access restricted.</strong> Your {titleCase(session.role)} role cannot open {params.from ?? "that page"}. Choose an available area below or ask the owner to update your role.</div> : null}\n      <section className="rounded-xl bg-slate-950 p-4 text-white shadow-xl sm:p-5">\n',
    '      {params.error === "permission" ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Access restricted.</strong> Your {titleCase(session.role)} role cannot open {params.from ?? "that page"}. Choose an available area below or ask the owner to update your role.</div> : null}\n      {params.setup === "complete" ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">Business setup completed. The workspace is ready for daily operations.</div> : null}\n      {!shop.onboardingCompletedAt && visibleNavigation.settings ? <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-cyan-100 p-2 text-cyan-800"><WandSparkles size={20} /></span><div><h2 className="font-bold text-cyan-950">Finish business setup</h2><p className="mt-1 text-sm leading-6 text-cyan-900/75">Confirm identity, location, payments, receipt details, staff, first item and opening stock before the business begins full operation.</p></div></div><Link href="/dashboard/setup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-900 px-4 text-sm font-bold text-white">Continue setup <ArrowRight size={16} className="ml-2" /></Link></div></section> : null}\n      <section className="rounded-xl bg-slate-950 p-4 text-white shadow-xl sm:p-5">\n',
)
replace_once(
    "src/app/dashboard/page.tsx",
    'type DashboardPageProps = { searchParams?: Promise<{ error?: string; from?: string }> };\n',
    'type DashboardPageProps = { searchParams?: Promise<{ error?: string; from?: string; setup?: string }> };\n',
)

replace_once(
    "src/app/api/receipts/[orderId]/route.ts",
    '        <h1>${escapeHtml(order.shop.name)}</h1>\n        <p>Receipt: ${escapeHtml(order.receiptNumber)}</p>\n',
    '        <h1>${escapeHtml(order.shop.name)}</h1>\n        ${order.shop.receiptHeader ? `<p><strong>${escapeHtml(order.shop.receiptHeader)}</strong></p>` : ""}\n        <p>Receipt: ${escapeHtml(order.receiptNumber)}</p>\n',
)
replace_once(
    "src/app/api/receipts/[orderId]/route.ts",
    '          <tr><td class="total">Total</td><td class="total" style="text-align:right">${escapeHtml(currency(order.totalAmount.toString(), order.shop.currency))}</td></tr>\n        </table>\n',
    '          <tr><td class="total">Total</td><td class="total" style="text-align:right">${escapeHtml(currency(order.totalAmount.toString(), order.shop.currency))}</td></tr>\n        </table>\n        ${order.shop.receiptFooter ? `<p style="margin-top:16px;font-size:12px;text-align:center">${escapeHtml(order.shop.receiptFooter)}</p>` : ""}\n',
)

replace_once(
    "README.md",
    'Phase 2 introduces per-business modules. Home, Sales, Orders, Items, Customers, Payments, Reports and Settings are universal. Optional production, purchasing, online-selling and marketplace tools appear only when the platform administrator enables them and the assigned plan includes the necessary capability. Services, rentals, multi-location stock and advanced accounting are registered for later phases without exposing empty navigation.\n',
    'Phase 2 introduces per-business modules. Home, Sales, Orders, Items, Customers, Payments, Reports and Settings are universal. Optional production, purchasing, online-selling and marketplace tools appear only when the platform administrator enables them and the assigned plan includes the necessary capability. Services, rentals, multi-location stock and advanced accounting are registered for later phases without exposing empty navigation.\n\nPhase 5 adds `/dashboard/setup`, a server-verified ten-step onboarding workspace for new businesses. Existing operational tenants are marked complete during migration. New tenants configure identity, business type, Ghana location, enabled-module review, currency and tax, payment methods, receipt details, staff, first item/service and opening stock. Printing businesses also record the real cutter, manual heat press, materials, garments, placements, artwork sizes, stages and deposit policy before completion.\n',
)

print("Phase 5 existing-file patches applied.")
