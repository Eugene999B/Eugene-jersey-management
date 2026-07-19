import { clsx } from "clsx";
import type { ReactNode } from "react";

const toneClasses = {
  neutral: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-700",
};

type BadgeProps = {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
  className?: string;
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={clsx("inline-flex rounded-[8px] px-2 py-1 text-xs font-semibold", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
