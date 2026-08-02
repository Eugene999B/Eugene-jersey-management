"use client";

import { CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type SelectionCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  title: ReactNode;
  description?: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
  selectedLabel?: string;
  leading?: ReactNode;
};

export function SelectionCard({
  title,
  description,
  detail,
  selected = false,
  selectedLabel = "Selected",
  leading,
  className,
  disabled,
  role,
  ...props
}: SelectionCardProps) {
  return (
    <button
      type="button"
      role={role}
      aria-pressed={role === "radio" ? undefined : selected}
      disabled={disabled}
      className={clsx("selection-card", selected && "is-selected", className)}
      {...props}
    >
      {leading ? <span className="selection-leading">{leading}</span> : null}
      <span className="min-w-0 flex-1 text-left">
        <span className="selection-title">{title}</span>
        {description ? <span className="selection-description">{description}</span> : null}
        {detail ? <span className="selection-detail">{detail}</span> : null}
      </span>
      <span className="selection-status" aria-hidden={!selected}>
        {selected ? <><CheckCircle2 size={18} /><span>{selectedLabel}</span></> : null}
      </span>
    </button>
  );
}
