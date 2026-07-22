import Link from "next/link";
import { requestPasswordResetAction } from "@/app/forgot-password/actions";
import { isSmsDeliveryConfigured } from "@/lib/messaging";

type Props = {
  searchParams?: Promise<{ sent?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const smsReady = isSmsDeliveryConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-5">
      <div className="panel w-full max-w-md p-6">
        <p className="text-sm font-semibold uppercase text-[#0f766e]">Password recovery</p>
        <h1 className="mt-2 text-3xl font-semibold">Request a reset code</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter the phone number on the staff account. The system sends a short SMS code for the new password screen.
        </p>
        {params.sent ? (
          <div className="mt-5 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            If the account exists, a reset code has been sent.
          </div>
        ) : null}
        {!smsReady ? (
          <div className="mt-5 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            SMS recovery is not configured. Ask the platform administrator to restore the SMS provider before requesting a code.
          </div>
        ) : null}
        <form action={requestPasswordResetAction} className="mt-5 space-y-4">
          <input className="field" name="emailOrPhone" placeholder="+233200000000 or owner@accra.test" required disabled={!smsReady} />
          <button disabled={!smsReady} className="w-full rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            Send reset code
          </button>
        </form>
        <Link className="mt-5 inline-flex text-sm font-semibold text-[#0f766e]" href="/login">
          Return to login
        </Link>
      </div>
    </main>
  );
}
