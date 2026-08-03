from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


schema = Path("prisma/schema.prisma")
schema_text = schema.read_text()
if "model ShopAccessGrant" in schema_text:
    raise SystemExit("ShopAccessGrant already exists in root schema")
schema.write_text(schema_text.rstrip() + """


enum SubscriptionAccessType {
  PAID
  FREE_TRIAL
  SPONSORED
  PROMOTIONAL
  FREE_FOREVER
  EMERGENCY
  SUSPENDED
}

enum SubscriptionAccessExpiryAction {
  EXTEND_AUTOMATICALLY
  RETURN_TO_FREE
  MOVE_TO_PAID
  SUSPEND_ACTIONS
  ADMIN_REVIEW
}

model ShopAccessGrant {
  id                     String                         @id @default(cuid())
  shopId                 String
  accessType             SubscriptionAccessType
  planId                 String
  planVersion            Int
  startsAt               DateTime
  endsAt                 DateTime?
  priceOverride          Decimal?                       @db.Decimal(12, 2)
  invoicesDisabled       Boolean                        @default(false)
  reason                 String
  approvedById           String
  expiryAction           SubscriptionAccessExpiryAction
  expiryPlanId           String?
  automaticExtensionDays Int?
  featureOverrides       String[]                       @default([])
  termsSnapshot          Json
  isActive               Boolean                        @default(true)
  expiredAt              DateTime?
  expiryOutcome          String?
  revokedAt              DateTime?
  revokedById            String?
  revocationReason       String?
  createdAt              DateTime                       @default(now())
  updatedAt              DateTime                       @updatedAt

  @@index([shopId, startsAt, endsAt])
  @@index([accessType, isActive])
  @@index([endsAt, isActive])
}
""")

replace_once(
    "src/lib/admin-navigation.ts",
    "  FolderKanban,\n  HeartPulse,\n",
    "  FolderKanban,\n  Gift,\n  HeartPulse,\n",
)
replace_once(
    "src/lib/admin-navigation.ts",
    '  { section: "Plans & access", href: "/admin/staff", label: "Administrator staff", shortLabel: "Staff", icon: UserCog, permission: "workers" },\n',
    '  { section: "Plans & access", href: "/admin/access", label: "Access grants", shortLabel: "Access", icon: Gift, permission: "billing" },\n  { section: "Plans & access", href: "/admin/staff", label: "Administrator staff", shortLabel: "Staff", icon: UserCog, permission: "workers" },\n',
)

replace_once(
    "src/lib/subscription-hardening.ts",
    'import { OrderChannel, Prisma, SubscriptionStatus } from "@prisma/client";\n',
    'import { OrderChannel, Prisma, SubscriptionAccessExpiryAction, SubscriptionAccessType, SubscriptionStatus } from "@prisma/client";\n',
)
replace_once(
    "src/lib/subscription-hardening.ts",
    'import { platformDb } from "@/lib/platform-db";\n',
    'import { platformDb } from "@/lib/platform-db";\nimport { activeShopAccessGrant, accessGrantCommercialStatus, accessTypeLabel } from "@/lib/subscription-access";\n',
)
replace_once(
    "src/lib/subscription-hardening.ts",
    '  blockCode: SubscriptionBlockCode | null;\n};\n',
    '  blockCode: SubscriptionBlockCode | null;\n  accessGrant: {\n    id: string;\n    accessType: SubscriptionAccessType;\n    startsAt: Date;\n    endsAt: Date | null;\n    invoicesDisabled: boolean;\n    priceOverride: string | null;\n    expiryAction: SubscriptionAccessExpiryAction;\n    reason: string;\n  } | null;\n};\n',
)
replace_once(
    "src/lib/subscription-hardening.ts",
    '    graceEndsAt,\n  };\n',
    '    graceEndsAt,\n    accessGrant: null,\n  };\n',
)
replace_once(
    "src/lib/subscription-hardening.ts",
    'async function commercialStateFromDb(db: SubscriptionDb, shopId: string, now = new Date()) {\n  const [contract, shop] = await Promise.all([\n',
    'async function commercialStateFromDb(db: SubscriptionDb, shopId: string, now = new Date()) {\n  const accessGrant = await activeShopAccessGrant(shopId, now);\n  const [contract, shop] = await Promise.all([\n',
)
replace_once(
    "src/lib/subscription-hardening.ts",
    '  if (!shop) throw new CommercialSubscriptionError("SUBSCRIPTION_SUSPENDED", "This shop no longer exists.");\n\n  let snapshot: SubscriptionPlanSnapshot | null = null;\n',
    '  if (!shop) throw new CommercialSubscriptionError("SUBSCRIPTION_SUSPENDED", "This shop no longer exists.");\n\n  if (accessGrant) {\n    const status = accessGrantCommercialStatus(accessGrant);\n    const suspended = accessGrant.accessType === SubscriptionAccessType.SUSPENDED;\n    const label = accessTypeLabel(accessGrant.accessType);\n    return {\n      shopId,\n      hasContract: Boolean(contract),\n      enforcementEnabled: true,\n      recordedStatus: status,\n      effectiveStatus: status,\n      operational: !suspended,\n      snapshot: accessGrant.snapshot,\n      trialEndsAt: accessGrant.accessType === SubscriptionAccessType.FREE_TRIAL ? accessGrant.endsAt : null,\n      renewalAt: accessGrant.endsAt,\n      graceEndsAt: null,\n      deadline: accessGrant.endsAt,\n      notice: suspended\n        ? "Commercial actions are suspended by the platform administrator."\n        : `${label} is active${accessGrant.endsAt ? ` until ${accessGrant.endsAt.toLocaleDateString("en-GB")}` : " without an expiry date"}.${accessGrant.invoicesDisabled ? " Subscription invoices are disabled during this grant." : ""}`,\n      blockCode: suspended ? "SUBSCRIPTION_SUSPENDED" : null,\n      accessGrant: {\n        id: accessGrant.id,\n        accessType: accessGrant.accessType,\n        startsAt: accessGrant.startsAt,\n        endsAt: accessGrant.endsAt,\n        invoicesDisabled: accessGrant.invoicesDisabled,\n        priceOverride: accessGrant.priceOverride?.toFixed(2) ?? null,\n        expiryAction: accessGrant.expiryAction,\n        reason: accessGrant.reason,\n      },\n    };\n  }\n\n  let snapshot: SubscriptionPlanSnapshot | null = null;\n',
)

replace_once(
    "src/lib/subscription-billing.ts",
    'import { platformDb } from "@/lib/platform-db";\n',
    'import { platformDb } from "@/lib/platform-db";\nimport { activeShopAccessGrant } from "@/lib/subscription-access";\n',
)
replace_once(
    "src/lib/subscription-billing.ts",
    '  const now = input.now ?? new Date();\n  const contract = await platformDb.shopSubscriptionContract.findUnique({ where: { shopId: input.shopId } });\n',
    '  const now = input.now ?? new Date();\n  const accessGrant = await activeShopAccessGrant(input.shopId, now);\n  if (accessGrant?.invoicesDisabled) return null;\n  const contract = await platformDb.shopSubscriptionContract.findUnique({ where: { shopId: input.shopId } });\n',
)
replace_once(
    "src/lib/subscription-billing.ts",
    '  const parsed = parseSubscriptionPlanSnapshot(contract.termsSnapshot);\n  if (!parsed.success || !parsed.data.isConfigured) return null;\n  const amount = selectedContractPrice(contract);\n',
    '  const parsed = accessGrant\n    ? { success: true as const, data: accessGrant.snapshot }\n    : parseSubscriptionPlanSnapshot(contract.termsSnapshot);\n  if (!parsed.success || !parsed.data.isConfigured) return null;\n  const amount = accessGrant?.priceOverride ?? selectedContractPrice(contract);\n',
)
replace_once(
    "src/lib/subscription-billing.ts",
    '      description: `${parsed.data.name} ${contract.billingCycle.toLowerCase()} subscription renewal`,\n',
    '      description: `${parsed.data.name} ${contract.billingCycle.toLowerCase()} subscription renewal${accessGrant ? ` under ${accessGrant.accessType.toLowerCase().replaceAll("_", " ")} access` : ""}`,\n',
)
replace_once(
    "src/lib/subscription-billing.ts",
    'export async function createSubscriptionPaymentCheckout(input: {\n  shopId: string;\n  invoiceId: string;\n  userId: string;\n  email: string;\n  callbackUrl: string;\n}) {\n  const invoice = await platformDb.subscriptionInvoice.findFirst({\n',
    'export async function createSubscriptionPaymentCheckout(input: {\n  shopId: string;\n  invoiceId: string;\n  userId: string;\n  email: string;\n  callbackUrl: string;\n}) {\n  const accessGrant = await activeShopAccessGrant(input.shopId);\n  if (accessGrant?.invoicesDisabled) throw new SubscriptionBillingError("invoice-disabled-by-access-grant", "Subscription payment is disabled while administrator-granted access is active.");\n  const invoice = await platformDb.subscriptionInvoice.findFirst({\n',
)

replace_once(
    "src/app/dashboard/subscription/page.tsx",
    '  "invoice-zero": "This invoice does not require an online payment.",\n',
    '  "invoice-zero": "This invoice does not require an online payment.",\n  "invoice-disabled-by-access-grant": "Subscription payment is disabled while administrator-granted access is active.",\n',
)
replace_once(
    "src/app/dashboard/subscription/page.tsx",
    '  const selectedPrice = snapshot\n    ? shop.billingCycle === "YEARLY" ? snapshot.yearlyPrice : snapshot.monthlyPrice\n    : null;\n',
    '  const selectedPrice = usage.accessGrant?.priceOverride ?? (snapshot\n    ? shop.billingCycle === "YEARLY" ? snapshot.yearlyPrice : snapshot.monthlyPrice\n    : null);\n',
)
replace_once(
    "src/app/dashboard/subscription/page.tsx",
    '      {usage.notice ? (\n        <div role={usage.operational ? "status" : "alert"} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${usage.operational ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>\n          {usage.notice}\n        </div>\n      ) : null}\n\n      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">\n',
    '      {usage.notice ? (\n        <div role={usage.operational ? "status" : "alert"} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${usage.operational ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>\n          {usage.notice}\n        </div>\n      ) : null}\n\n      {usage.accessGrant ? <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Administrator access grant</p><h2 className="mt-2 text-xl font-semibold text-violet-950">{usage.accessGrant.accessType.replaceAll("_", " ")}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-violet-900/80">{usage.accessGrant.reason}</p></div><Badge tone={usage.accessGrant.invoicesDisabled ? "green" : "blue"}>{usage.accessGrant.invoicesDisabled ? "Invoices disabled" : "Billing enabled"}</Badge></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Starts</dt><dd className="mt-1 font-semibold">{shortDate(usage.accessGrant.startsAt)}</dd></div><div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">Ends</dt><dd className="mt-1 font-semibold">{usage.accessGrant.endsAt ? shortDate(usage.accessGrant.endsAt) : "No expiry"}</dd></div><div className="rounded-xl bg-white p-3"><dt className="text-xs font-bold uppercase text-slate-500">After expiry</dt><dd className="mt-1 font-semibold">{usage.accessGrant.expiryAction.replaceAll("_", " ")}</dd></div></dl></section> : null}\n\n      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">\n',
)
replace_once(
    "src/app/dashboard/subscription/page.tsx",
    '          {isOwner ? <form action={generateSubscriptionInvoiceAction}><Button variant="outline"><RefreshCw size={16} />Generate renewal invoice</Button></form> : null}\n',
    '          {isOwner && !usage.accessGrant?.invoicesDisabled ? <form action={generateSubscriptionInvoiceAction}><Button variant="outline"><RefreshCw size={16} />Generate renewal invoice</Button></form> : null}\n',
)
replace_once(
    "src/app/dashboard/subscription/page.tsx",
    '            const payable = isOwner && (invoice.status === SubscriptionInvoiceStatus.OPEN || invoice.status === SubscriptionInvoiceStatus.OVERDUE);\n',
    '            const payable = isOwner && !usage.accessGrant?.invoicesDisabled && (invoice.status === SubscriptionInvoiceStatus.OPEN || invoice.status === SubscriptionInvoiceStatus.OVERDUE);\n',
)
replace_once(
    "src/app/dashboard/subscription/page.tsx",
    '          {!invoices.length ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 lg:col-span-2">No subscription invoice has been issued. The owner can generate one once a configured paid contract and renewal date exist.</div> : null}\n',
    '          {!invoices.length ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 lg:col-span-2">{usage.accessGrant?.invoicesDisabled ? "No subscription invoice is required while this administrator access grant is active." : "No subscription invoice has been issued. The owner can generate one once a configured paid contract and renewal date exist."}</div> : null}\n',
)

replace_once(
    "README.md",
    'Phase 5 adds `/dashboard/setup`, a server-verified ten-step onboarding workspace for new businesses. Existing operational tenants are marked complete during migration. New tenants configure identity, business type, Ghana location, enabled-module review, currency and tax, payment methods, receipt details, staff, first item/service and opening stock. Printing businesses also record the real cutter, manual heat press, materials, garments, placements, artwork sizes, stages and deposit policy before completion.\n',
    'Phase 5 adds `/dashboard/setup`, a server-verified ten-step onboarding workspace for new businesses. Existing operational tenants are marked complete during migration. New tenants configure identity, business type, Ghana location, enabled-module review, currency and tax, payment methods, receipt details, staff, first item/service and opening stock. Printing businesses also record the real cutter, manual heat press, materials, garments, placements, artwork sizes, stages and deposit policy before completion.\n\nPhase 6 adds `/admin/access`, an audited administrator access-grant ledger separate from ordinary recurring billing. Paid, free-trial, sponsored, promotional, free-forever, emergency and suspended access can carry exact dates, plan and feature terms, price overrides, invoice suppression and an explicit expiry outcome. The tenant subscription centre shows the active grant, while invoice generation and payment prompts are suppressed whenever the grant disables billing.\n',
)

print("Phase 6 access integrations applied.")
