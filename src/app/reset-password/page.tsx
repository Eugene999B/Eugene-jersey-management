import Link from "next/link";
import { resetPasswordAction } from "@/app/reset-password/actions";

type Props = {
  searchParams?: Promise<{ token?: string; error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ef] p-5">
      <div className="panel w-full max-w-md p-6">
        <p className="text-sm font-semibold uppercase text-[#0f766e]">Reset password</p>
        <h1 className="mt-2 text-3xl font-semibold">Create a new password</h1>
        {params.error ? (
          <div className="mt-5 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            The reset token is invalid or expired.
          </div>
        ) : null}
        <form action={resetPasswordAction} className="mt-5 space-y-4">
          <input type="hidden" name="token" value={params.token ?? ""} />
          <input className="field" name="password" type="password" minLength={8} placeholder="New password" required />
          <button className="w-full rounded-[8px] bg-[#111827] px-4 py-3 text-sm font-semibold text-white">
            Save password
          </button>
        </form>
        <Link className="mt-5 inline-flex text-sm font-semibold text-[#0f766e]" href="/login">
          Return to login
        </Link>
      </div>
    </main>
  );
}
