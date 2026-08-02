import { clsx } from "clsx";
import type { ReactNode } from "react";

type DataTableShellProps = {
  children: ReactNode;
  label: string;
  className?: string;
};

export function DataTableShell({ children, label, className }: DataTableShellProps) {
  return (
    <div className={clsx("table-shell", className)} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
