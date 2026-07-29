import fs from "node:fs";

const file = "src/app/admin/billing/page.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOrFail(before, after) {
  if (!source.includes(before)) throw new Error(`Billing patch anchor not found: ${before.slice(0, 140)}`);
  source = source.replace(before, after);
}

replaceOrFail(
  'import { BillingCycle, SubscriptionStatus } from "@prisma/client";',
  'import { BillingCycle, Role, SubscriptionStatus } from "@prisma/client";',
);

replaceOrFail(
  `  formatNullableLimit,\n  sortSubscriptionPlans,`,
  `  formatNullableLimit,\n  parseSubscriptionPlanSnapshot,\n  sortSubscriptionPlans,`,
);

replaceOrFail(
  '} from "@/lib/subscription-plans";\n',
  '} from "@/lib/subscription-plans";\nimport { subscriptionMonthWindow } from "@/lib/subscription-hardening";\n',
);

replaceOrFail(
  `function planPrice(value: { toString(): string } | null) {\n  return value === null ? "Not configured" : currency(value.toString());\n}\n`,
  `function planPrice(value: { toString(): string } | null) {\n  return value === null ? "Not configured" : currency(value.toString());\n}\n\nfunction usageLabel(current: number, limit: number | null, configured: boolean) {\n  if (!configured) return \`${'${current.toLocaleString("en-GB")}'} / legacy\`;\n  if (limit === null) return \`${'${current.toLocaleString("en-GB")}'} / unlimited\`;\n  return \`${'${current.toLocaleString("en-GB")}'} / ${'${limit.toLocaleString("en-GB")}'}\`;\n}\n`,
);

replaceOrFail(
  `  const plans = await ensureSubscriptionPlans();\n  const [shops, contracts, recentChanges] = await Promise.all([\n    prisma.shop.findMany({ orderBy: [{ subscriptionStatus: "asc" }, { name: "asc" }] }),\n    prisma.shopSubscriptionContract.findMany(),\n    prisma.subscriptionPlanChangeRequest.findMany({\n      include: { plan: true },\n      orderBy: { createdAt: "desc" },\n      take: 8,\n    }),\n  ]);\n  const contractMap = new Map(contracts.map((contract) => [contract.shopId, contract]));`,
  `  const plans = await ensureSubscriptionPlans();\n  const { monthStart, monthEnd } = subscriptionMonthWindow();\n  const [shops, contracts, recentChanges, productGroups, orderGroups, staffGroups, inviteGroups] = await Promise.all([\n    prisma.shop.findMany({ orderBy: [{ subscriptionStatus: "asc" }, { name: "asc" }] }),\n    prisma.shopSubscriptionContract.findMany(),\n    prisma.subscriptionPlanChangeRequest.findMany({\n      include: { plan: true },\n      orderBy: { createdAt: "desc" },\n      take: 8,\n    }),\n    prisma.product.groupBy({ by: ["shopId"], _count: { _all: true } }),\n    prisma.order.groupBy({ by: ["shopId"], where: { createdAt: { gte: monthStart, lt: monthEnd } }, _count: { _all: true } }),\n    prisma.user.groupBy({ by: ["shopId"], where: { shopId: { not: null }, isActive: true, role: { not: Role.OWNER } }, _count: { _all: true } }),\n    prisma.inviteToken.groupBy({ by: ["shopId"], where: { usedAt: null, expiresAt: { gt: new Date() } }, _count: { _all: true } }),\n  ]);\n  const contractMap = new Map(contracts.map((contract) => [contract.shopId, contract]));\n  const productCountMap = new Map(productGroups.map((row) => [row.shopId, row._count._all]));\n  const orderCountMap = new Map(orderGroups.map((row) => [row.shopId, row._count._all]));\n  const staffCountMap = new Map(staffGroups.flatMap((row) => row.shopId ? [[row.shopId, row._count._all] as const] : []));\n  const inviteCountMap = new Map(inviteGroups.map((row) => [row.shopId, row._count._all]));`,
);

const oldTable = `          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Shop</th><th className="p-4">Plan version</th><th className="p-4">Cycle</th><th className="p-4">Price</th><th className="p-4">Renewal</th><th className="p-4">Grace ends</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">{shops.map((shop) => { const contract = contractMap.get(shop.id); return <tr key={shop.id}><td className="p-4 font-semibold">{shop.name}</td><td className="p-4">{shop.planTier}{contract ? \` · v${'${contract.planVersion}'}\` : " · legacy"}</td><td className="p-4">{shop.billingCycle}</td><td className="p-4">{shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</td><td className="p-4 text-slate-500">{shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "Not set"}</td><td className="p-4 text-slate-500">{contract?.graceEndsAt ? shortDate(contract.graceEndsAt) : "—"}</td><td className="p-4"><Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.subscriptionStatus}</Badge></td></tr>; })}</tbody></table></div>`;

const newTable = `          <div className="overflow-x-auto"><table className="w-full min-w-[1320px] text-left text-sm"><thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500"><tr><th className="p-4">Shop</th><th className="p-4">Plan version</th><th className="p-4">Products</th><th className="p-4">Orders this month</th><th className="p-4">Staff slots</th><th className="p-4">Cycle</th><th className="p-4">Price</th><th className="p-4">Renewal</th><th className="p-4">Grace ends</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-[#ded8cd] bg-white">{shops.map((shop) => {\n            const contract = contractMap.get(shop.id);\n            const parsedTerms = contract ? parseSubscriptionPlanSnapshot(contract.termsSnapshot) : null;\n            const terms = parsedTerms?.success ? parsedTerms.data : null;\n            const configured = Boolean(contract && terms?.isConfigured);\n            const products = productCountMap.get(shop.id) ?? 0;\n            const orders = orderCountMap.get(shop.id) ?? 0;\n            const staff = (staffCountMap.get(shop.id) ?? 0) + (inviteCountMap.get(shop.id) ?? 0);\n            return <tr key={shop.id}><td className="p-4 font-semibold">{shop.name}</td><td className="p-4">{shop.planTier}{contract ? \` · v${'${contract.planVersion}'}\` : " · legacy"}</td><td className="p-4 font-semibold">{usageLabel(products, terms?.maxProducts ?? null, configured)}</td><td className="p-4 font-semibold">{usageLabel(orders, terms?.maxOrdersPerMonth ?? null, configured)}</td><td className="p-4 font-semibold">{usageLabel(staff, terms?.includedStaffAccounts ?? null, configured)}</td><td className="p-4">{shop.billingCycle}</td><td className="p-4">{shop.billingCycle === "YEARLY" ? currency(shop.yearlyPrice?.toString() ?? "0") : currency(shop.monthlyPrice?.toString() ?? "0")}</td><td className="p-4 text-slate-500">{shop.subscriptionRenewalAt ? shortDate(shop.subscriptionRenewalAt) : "Not set"}</td><td className="p-4 text-slate-500">{contract?.graceEndsAt ? shortDate(contract.graceEndsAt) : "—"}</td><td className="p-4"><Badge tone={shop.subscriptionStatus === "ACTIVE" ? "green" : shop.subscriptionStatus === "PAST_DUE" ? "red" : "orange"}>{shop.subscriptionStatus}</Badge></td></tr>;\n          })}</tbody></table></div>`;

replaceOrFail(oldTable, newTable);

fs.writeFileSync(file, source, "utf8");
console.log("Release 37 administrator usage register applied.");
