import Link from "next/link";
import { ArrowRight, Building2, LockKeyhole, Mail, Search, ShieldCheck, ShoppingBag, UserRoundCheck } from "lucide-react";
import { Role, ShopVerificationStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";

const errorCopy: Record<string, string> = {
  invalid: "The login details are not correct. Check the ID, email, and password.",
  "shop-id": "This account does not belong to the selected shop workspace.",
  locked: "Too many wrong attempts. Wait a few minutes, then try again.",
  "shop-not-found": "The shop connected to this account could not be found.",
  "missing-shop": "This staff account is missing shop access.",
  permission: "That account does not have permission for the requested area.",
};

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string; loginId?: string }>;
};

type LoginTarget =
  | {
      kind: "platform" | "supplier" | "staff";
      title: string;
      detail: string;
      email: string;
      shopLoginId?: string | null;
      loginId: string;
      role: Role;
      active: boolean;
    }
  | {
      kind: "shop";
      title: string;
      detail: string;
      shopLoginId: string;
      loginId: string;
      active: boolean;
    }
  | {
      kind: "unknown";
      title: string;
      detail: string;
      loginId: string;
      active: false;
    };

function cleanLoginId(value: string | undefined) {
  return value?.trim() ?? "";
}

async function resolveLoginTarget(rawLoginId: string): Promise<LoginTarget | null> {
  const loginId = cleanLoginId(rawLoginId);
  if (!loginId) return null;

  const upperLoginId = loginId.toUpperCase();
  const lowerLoginId = loginId.toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { adminLoginId: upperLoginId },
        { email: lowerLoginId },
        { phone: loginId },
      ],
    },
    include: {
      shop: { select: { name: true, slug: true, staffLoginId: true, networkCode: true, isActive: true } },
    },
  });

  if (user) {
    const isPlatform = user.role === Role.SUPER_ADMIN && !user.shopId;
    const isSupplier = user.role === Role.SUPPLIER;
    const kind = isPlatform ? "platform" : isSupplier ? "supplier" : "staff";
    const title = isPlatform ? "Platform admin account" : isSupplier ? "Supplier portal account" : `${user.shop?.name ?? "Shop"} staff account`;
    const detail = isPlatform
      ? "Enter the password for this admin worker profile."
      : isSupplier
        ? "Enter the supplier portal password."
        : "Enter the password for this shop staff profile.";

    return {
      kind,
      title,
      detail,
      email: user.email,
      shopLoginId: user.shop?.staffLoginId ?? user.shop?.networkCode ?? user.shop?.slug,
      loginId,
      role: user.role,
      active: user.isActive && (isPlatform || isSupplier || Boolean(user.shop?.isActive)),
    };
  }

  const shop = await prisma.shop.findFirst({
    where: {
      OR: [
        { staffLoginId: upperLoginId },
        { networkCode: upperLoginId },
        { slug: lowerLoginId },
      ],
    },
    select: { name: true, slug: true, staffLoginId: true, networkCode: true, isActive: true, city: true, country: true },
  });

  if (shop) {
    return {
      kind: "shop",
      title: `${shop.name} workspace`,
      detail: `${shop.city ?? "Online"}${shop.country ? `, ${shop.country}` : ""}. Enter your staff email and password for this shop.`,
      shopLoginId: shop.staffLoginId ?? shop.networkCode ?? shop.slug,
      loginId,
      active: shop.isActive,
    };
  }

  return {
    kind: "unknown",
    title: "No workspace found",
    detail: "Check the Login ID from the admin, shop owner, or supplier record.",
    loginId,
    active: false,
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const loginId = cleanLoginId(params.loginId);
  const target = await resolveLoginTarget(loginId);
  const error = params.error ? errorCopy[params.error] : null;
  const shops = await prisma.shop.findMany({
    where: { isActive: true, storefrontEnabled: true, verificationStatus: ShopVerificationStatus.VERIFIED },
    select: { name: true, slug: true, city: true, country: true, verificationStatus: true, credentialPhone: true },
    orderBy: { name: "asc" },
    take: 6,
  });

  return (
    <main className="min-h-screen bg-[#10151f] text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl gap-4 px-3 py-3 sm:px-5 sm:py-5 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="flex min-h-[560px] flex-col justify-between rounded-[8px] border border-white/10 bg-[#141b29] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="rounded-[8px] bg-white/10 p-3"><ShieldCheck size={24} /></span>
              <div>
                <p className="text-sm text-white/55">Eugene Jersey Management</p>
                <h1 className="text-xl font-semibold">Shop operations platform</h1>
              </div>
            </Link>
            <Badge tone="green">Secure staff access</Badge>
          </div>

          <div className="py-10">
            <p className="mb-4 inline-flex items-center gap-2 rounded-[8px] bg-white/8 px-3 py-1 text-sm text-white/70">
              <UserRoundCheck size={15} className="text-[#f97316]" /> Built for jersey and sports shops
            </p>
            <h2 className="max-w-2xl text-4xl font-semibold leading-[1.02] sm:text-6xl">
              Sell, produce, track and grow from one workspace.
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Sell", "POS, online orders, payments, receipts and customer accounts"],
                ["Produce", "Transfer artwork, job flow, materials and production handoff"],
                ["Control", "Stock, staff, suppliers, reporting and daily closing"],
              ].map(([title, body]) => (
                <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-4">
                  <ShieldCheck className="mb-3 text-[#f97316]" size={20} />
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-5 text-white/55">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-4 text-sm text-white/60 sm:grid-cols-3">
            <span>Role-based access</span>
            <span>Audited operations</span>
            <span>Multi-shop ready</span>
          </div>
        </div>

        <div className="grid content-center gap-4 rounded-[8px] bg-[#f6f4ef] p-4 text-slate-950 sm:p-5">
          <div className="w-full">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-[8px] bg-[#111827] p-3 text-white">
                <LockKeyhole size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-[#0f766e]">Staff, admin, shop, supplier</p>
                <h2 className="text-3xl font-semibold">Enter Login ID</h2>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form action="/login" method="get" className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
              <input type="hidden" name="next" value={params.next ?? ""} />
              <label className="block">
                <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Building2 size={16} /> Login ID
                </span>
                <input className="field uppercase" name="loginId" autoComplete="username" placeholder="Shop ID, admin ID, email, or phone" defaultValue={loginId} required />
              </label>
              <button className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Detect account <ArrowRight size={16} />
              </button>
            </form>

            {target && target.kind !== "unknown" ? (
              <form action="/api/auth/login" method="post" className="mt-4 space-y-4 rounded-[8px] border border-[#ded8cd] bg-white p-4">
                <input type="hidden" name="next" value={params.next ?? ""} />
                <input type="hidden" name="loginId" value={target.loginId} />
                {"shopLoginId" in target ? <input type="hidden" name="shopLoginId" value={target.shopLoginId ?? ""} /> : null}
                {"email" in target ? <input type="hidden" name="email" value={target.email} /> : null}

                <div className="rounded-[8px] bg-[#f6f4ef] p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{target.title}</p>
                      <p className="mt-1 text-slate-600">{target.detail}</p>
                    </div>
                    <Badge tone={target.active ? "green" : "red"}>{target.active ? "Active" : "Blocked"}</Badge>
                  </div>
                </div>

                {target.kind === "shop" ? (
                  <label className="block">
                    <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Mail size={16} /> Staff email
                    </span>
                    <input className="field" name="email" type="email" autoComplete="email" required />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <LockKeyhole size={16} /> Password
                  </span>
                  <input className="field" name="password" type="password" autoComplete="current-password" required />
                </label>
                <button disabled={!target.active} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
                  Sign in <ArrowRight size={16} />
                </button>
              </form>
            ) : target?.kind === "unknown" ? (
              <div className="mt-4 rounded-[8px] border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
                <p className="font-semibold">{target.title}</p>
                <p className="mt-1">{target.detail}</p>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 rounded-[8px] border border-[#ded8cd] bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-semibold">Buyer or customer?</p>
                <p className="mt-1 text-sm text-slate-600">Buyers do not need a staff ID. Browse stores, then sign in with phone or email when buying, chatting, rating, or tracking.</p>
              </div>
              <Link href="/shops" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-4 text-sm font-semibold text-white">
                Browse shops <ShoppingBag size={16} />
              </Link>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm">
              <Link href="/forgot-password" className="font-semibold text-[#0f766e] hover:underline">
                Staff password recovery
              </Link>
              <Link href="/buyer/login" className="font-semibold text-[#0f766e] hover:underline">
                Buyer sign in
              </Link>
            </div>
          </div>

          <section className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
            <div className="flex items-center gap-2">
              <Search size={17} className="text-[#0f766e]" />
              <h3 className="font-semibold">Verified shops</h3>
            </div>
            <form action="/shops" className="mt-3 flex gap-2">
              <input className="field" name="q" placeholder="Search shops or sports items" />
              <button className="rounded-[8px] bg-[#111827] px-3 text-sm font-semibold text-white">Search</button>
            </form>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {shops.map((shop) => (
                <Link key={shop.slug} href={`/shop/${shop.slug}`} className="rounded-[8px] border border-[#ded8cd] bg-[#f8fafc] p-3 text-sm transition hover:border-[#0f766e]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{shop.name}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{shop.verificationStatus}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{shop.city ?? "Online"} {shop.country ? `- ${shop.country}` : ""}</p>
                  {shop.credentialPhone ? <p className="mt-1 text-xs font-semibold text-slate-600">{shop.credentialPhone}</p> : null}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
