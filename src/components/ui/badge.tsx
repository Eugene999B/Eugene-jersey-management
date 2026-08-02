import { clsx } from "clsx";
import type { ReactNode } from "react";

const toneClasses = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  orange: "border-orange-200 bg-orange-50 text-orange-800",
  red: "border-red-200 bg-red-50 text-red-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
  purple: "border-violet-200 bg-violet-50 text-violet-800",
};

type BadgeProps = {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
  className?: string;
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={clsx("inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
