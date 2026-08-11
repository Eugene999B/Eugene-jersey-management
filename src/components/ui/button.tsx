"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

const variants = {
  primary: "bg-[var(--shop-primary)] text-white shadow-sm hover:brightness-95 active:brightness-90",
  secondary: "bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-950",
  outline: "border border-[var(--line)] bg-white text-slate-800 hover:border-slate-400 hover:bg-[var(--surface-muted)]",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
};

const sizes = {
  sm: "min-h-10 rounded-lg px-3 py-2 text-xs",
  md: "min-h-11 rounded-xl px-4 py-2.5 text-sm",
  lg: "min-h-12 rounded-xl px-5 py-3 text-base",
  icon: "min-h-11 min-w-11 rounded-xl p-2.5 text-sm",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: ReactNode;
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", className, children, loading = false, disabled, type, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const effectiveLoading = loading || (type !== "button" && pending);

  return (
    <button
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--shop-primary),white_72%)] disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      type={type}
      disabled={disabled || effectiveLoading}
      aria-busy={effectiveLoading || undefined}
      {...props}
    >
      {effectiveLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: ReactNode;
};

export function LinkButton({ variant = "primary", size = "md", className, children, href, ...props }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--shop-primary),white_72%)]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
