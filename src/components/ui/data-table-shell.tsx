import { clsx } from "clsx";
import type { ReactNode } from "react";

type DataTableShellProps = {
  children: ReactNode;
  label: string;
  className?: string;
};

export function DataTableShell({ children, label, className }: DataTableShellProps) {
  return (
    <section className={clsx("table-shell", className)} aria-label={label}>
      {children}
    </section>
  );
}
