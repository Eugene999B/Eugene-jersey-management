import Link from "next/link";
import { clsx } from "clsx";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary: "bg-[var(--shop-primary)] text-white hover:brightness-95",
  secondary: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-[#ded8cd] bg-white text-slate-800 hover:bg-[#f6f4ef]",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  children: ReactNode;
};

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: keyof typeof variants;
  children: ReactNode;
};

export function LinkButton({ variant = "primary", className, children, href, ...props }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold transition",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
