import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        {icon ? <div className="rounded-[8px] bg-[#f6f4ef] p-2 text-[var(--shop-primary)]">{icon}</div> : null}
      </div>
      {helper ? <p className="mt-3 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}
