import { LogOut } from "lucide-react";
import { clsx } from "clsx";

type LogoutButtonProps = {
  buyer?: boolean;
  className?: string;
  label?: string;
};

export function LogoutButton({ buyer = false, className, label = "Sign out" }: LogoutButtonProps) {
  return (
    <form action={buyer ? "/buyer/logout" : "/logout"} method="post" className="contents" autoComplete="off">
      <button
        type="submit"
        className={clsx(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-slate-300/50",
          className,
        )}
      >
        <LogOut size={16} aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
