import Link from "next/link";
import { ArrowRight, MessageSquareText, Phone, ShieldCheck, Store } from "lucide-react";
import { buyerPasswordLoginAction, requestBuyerLoginCodeAction, verifyBuyerLoginCodeAction } from "@/app/buyer/login/actions";

type Props = {
  searchParams?: Promise<{ sent?: string; phone?: string; next?: string; error?: string }>;
};

const errors: Record<string, string> = {
  invalid: "Check the phone number and details, then try again.",
  code: "That code is not correct or has expired.",
  rate: "Too many code attempts. Please wait a few minutes and try again.",
  "login-required": "Login first to continue.",
};

export default async function BuyerLoginPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const next = params.next ?? "/shops";

  return (
    <main className="min-h-screen bg-[#10151f] px-3 py-4 text-white sm:px-5">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-between rounded-[8px] border border-white/10 bg-[#151c29] p-5 sm:p-7">
          <div>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
              <Store size={16} /> Staff portal
            </Link>
            <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
              Buyer login with phone verification.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/65">
              Customers can browse without an account, but buying, rating, pickup verification, and delivery confirmation use a verified phone.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Phone code", "SMS verification"],
              ["Secure pickup", "Special order code"],
              ["Verified reviews", "Only buyers can rate"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
                <ShieldCheck size={18} className="text-[#f97316]" />
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-white/55">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid content-center rounded-[8px] bg-[#f6f4ef] p-4 text-slate-950 sm:p-6">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-[8px] bg-[#111827] p-3 text-white">
                <Phone size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-[#0f766e]">Customer access</p>
                <h2 className="text-2xl font-semibold">Continue shopping</h2>
              </div>
            </div>

            {params.error ? (
              <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errors[params.error] ?? errors.invalid}
              </div>
            ) : null}

            <div className="grid gap-4">
              <form action={buyerPasswordLoginAction} className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Phone size={17} className="text-[#0f766e]" />
                  <h3 className="font-semibold">Phone and password</h3>
                </div>
                <input type="hidden" name="next" value={next} />
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input className="field" name="phone" placeholder="+233..." defaultValue={params.phone ?? ""} required />
                  <input className="field" name="password" type="password" placeholder="Password" required />
                  <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white">
                    Sign in <ArrowRight size={16} />
                  </button>
                </div>
              </form>

              <div className="grid gap-4 lg:grid-cols-2">
              <form action={requestBuyerLoginCodeAction} className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquareText size={17} className="text-[#0f766e]" />
                  <h3 className="font-semibold">SMS setup or recovery</h3>
                </div>
                <input type="hidden" name="next" value={next} />
                <div className="space-y-3">
                  <input className="field" name="name" placeholder="Full name" required />
                  <input className="field" name="phone" placeholder="+233..." defaultValue={params.phone ?? ""} required />
                  <input className="field" name="password" type="password" placeholder="New password" required />
                  <input className="field" name="email" type="email" placeholder="Email optional" />
                  <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white">
                    Send SMS <ArrowRight size={16} />
                  </button>
                </div>
              </form>

              <form action={verifyBuyerLoginCodeAction} className="rounded-[8px] border border-[#ded8cd] bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={17} className="text-[#0f766e]" />
                  <h3 className="font-semibold">Verify</h3>
                </div>
                <input type="hidden" name="next" value={next} />
                <div className="space-y-3">
                  <input className="field" name="phone" placeholder="+233..." defaultValue={params.phone ?? ""} required />
                  <input className="field tracking-[0.18em]" name="code" inputMode="numeric" placeholder="6-digit code" required />
                  <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white">
                    Verify and continue <ArrowRight size={16} />
                  </button>
                </div>
              </form>
              </div>
            </div>

            {params.sent ? (
              <p className="mt-4 rounded-[8px] bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                Code sent. Enter it on the right to continue.
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-between text-sm">
              <Link href="/shops" className="font-semibold text-[#0f766e] hover:underline">
                Browse shops
              </Link>
              <Link href="/login" className="font-semibold text-[#0f766e] hover:underline">
                Staff login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
