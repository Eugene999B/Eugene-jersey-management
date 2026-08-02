import { clsx } from "clsx";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, actions, aside, className }: PageHeaderProps) {
  return (
    <header className={clsx("page-header", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {aside ? <div className="page-header-aside">{aside}</div> : null}
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
