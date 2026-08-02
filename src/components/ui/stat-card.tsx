import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <article className="panel stat-card p-4 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-2 break-words text-2xl font-semibold leading-tight text-slate-950">{value}</p>
        </div>
        {icon ? <div className="shrink-0 rounded-xl bg-[var(--surface-muted)] p-2.5 text-[var(--shop-primary)]">{icon}</div> : null}
      </div>
      {helper ? <p className="mt-3 text-sm leading-5 text-slate-500">{helper}</p> : null}
    </article>
  );
}
