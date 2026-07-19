import Link from "next/link";
import { requestPasswordResetAction } from "@/app/forgot-password/actions";

type Props = {
  searchParams?: Promise<{ sent?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-5">
      <div className="panel w-full max-w-md p-6">
        <p className="text-sm font-semibold uppercase text-[#0f766e]">Password recovery</p>
        <h1 className="mt-2 text-3xl font-semibold">Request a reset link</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          In development, the reset link is printed to the server console. Connect email or SMS before production.
        </p>
        {params.sent ? (
          <div className="mt-5 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            If the account exists, a reset link has been generated.
          </div>
        ) : null}
        <form action={requestPasswordResetAction} className="mt-5 space-y-4">
          <input className="field" name="email" type="email" placeholder="owner@accra.test" required />
          <button className="w-full rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white">
            Generate reset link
          </button>
        </form>
        <Link className="mt-5 inline-flex text-sm font-semibold text-[#0f766e]" href="/login">
          Return to login
        </Link>
      </div>
    </main>
  );
}
