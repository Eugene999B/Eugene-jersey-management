import { CheckCircle2, CircleAlert, CircleX, Info, LoaderCircle, PackageOpen } from "lucide-react";
import { clsx } from "clsx";
import type { ReactNode } from "react";

const stateConfig = {
  empty: { icon: PackageOpen, className: "feedback-empty" },
  info: { icon: Info, className: "feedback-info" },
  success: { icon: CheckCircle2, className: "feedback-success" },
  warning: { icon: CircleAlert, className: "feedback-warning" },
  error: { icon: CircleX, className: "feedback-error" },
  loading: { icon: LoaderCircle, className: "feedback-loading" },
} as const;

type FeedbackStateProps = {
  title: string;
  description?: string;
  state?: keyof typeof stateConfig;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function FeedbackState({ title, description, state = "info", action, compact = false, className }: FeedbackStateProps) {
  const config = stateConfig[state];
  const Icon = config.icon;
  const live = state === "error" ? "assertive" : state === "loading" || state === "success" ? "polite" : undefined;

  return (
    <section
      className={clsx("feedback-state", config.className, compact && "feedback-compact", className)}
      role={state === "error" ? "alert" : "status"}
      aria-live={live}
      aria-busy={state === "loading" || undefined}
    >
      <Icon className={clsx("feedback-icon", state === "loading" && "animate-spin")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="feedback-title">{title}</p>
        {description ? <p className="feedback-description">{description}</p> : null}
      </div>
      {action ? <div className="feedback-action">{action}</div> : null}
    </section>
  );
}
