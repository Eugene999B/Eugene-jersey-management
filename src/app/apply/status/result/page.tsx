import { BusinessApplicationStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock3, FileWarning, ShieldCheck, XCircle } from "lucide-react";
import { withdrawBusinessApplicationAction } from "@/app/apply/actions";
import { ApplicationShell } from "@/components/applications/application-shell";
import { findPublicApplicationByCredentials, readApplicationAccessCookie } from "@/lib/business-applications";
import { shortDate, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { searchParams?: Promise<{ error?: string; withdrawn?: string }> };

function statusPresentation(status: BusinessApplicationStatus) {
  switch (status) {
    case BusinessApplicationStatus.APPROVED:
      return { Icon: CheckCircle2, label: "Approved", classes: "border-emerald-200 bg-emerald-50 text-emerald-900" };
    case BusinessApplicationStatus.REJECTED:
      return { Icon: XCircle, label: "Not approved", classes: "border-red-200 bg-red-50 text-red-900" };
    case BusinessApplicationStatus.CHANGES_REQUESTED:
      return { Icon: FileWarning, label: "Changes requested", classes: "border-amber-200 bg-amber-50 text-amber-900" };
    case BusinessApplicationStatus.WITHDRAWN:
      return { Icon: XCircle, label: "Withdrawn", classes: "border-slate-200 bg-slate-100 text-slate-800" };
    default:
      return { Icon: Clock3, label: status === BusinessApplicationStatus.UNDER_REVIEW ? "Under review" : "Submitted", classes: "border-cyan-200 bg-cyan-50 text-cyan-900" };
  }
}

function publicStatusMessage(status: BusinessApplicationStatus) {
  switch (status) {
    case BusinessApplicationStatus.SUBMITTED:
      return "Your application is in the administrator queue and has not yet entered active review.";
    case BusinessApplicationStatus.UNDER_REVIEW:
      return "An administrator is reviewing the submitted business and contact information.";
    case BusinessApplicationStatus.CHANGES_REQUESTED:
      return "Corrected or additional information is required before the review can continue.";
    case BusinessApplicationStatus.APPROVED:
      return "The application has been approved. Onboarding details will be delivered through a separate secure channel.";
    case BusinessApplicationStatus.REJECTED:
      return "The application was not approved. The administrator message appears below when one was provided.";
    case BusinessApplicationStatus.WITHDRAWN:
      return "This application was withdrawn and is no longer being reviewed.";
  }
}

export default async function ApplicationStatusResultPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const access = await readApplicationAccessCookie();
  if (!access) redirect("/apply/status?error=expired");
  const application = await findPublicApplicationByCredentials(access.reference, access.token);
  if (!application) redirect("/apply/status?error=expired");

  const presentation = statusPresentation(application.status);
  const Icon = presentation.Icon;
  const canWithdraw = application.status === BusinessApplicationStatus.SUBMITTED || application.status === BusinessApplicationStatus.CHANGES_REQUESTED;

  return (
    <ApplicationShell>
      <section className="mx-auto max-w-3xl">
        <Link href="/apply/status" className="text-sm font-semibold text-slate-500 hover:text-slate-950">Check another application</Link>
        <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 sm:p-9">
          <div className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3 font-bold ${presentation.classes}`}><Icon size={21} /> {presentation.label}</div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{application.reference}</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">{application.businessName}</h1>
          <p className="mt-3 text-sm text-slate-500">{titleCase(application.type)} application · submitted {shortDate(application.submittedAt)} · last updated {shortDate(application.updatedAt)}</p>
          <div className="mt-7 rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">{publicStatusMessage(application.status)}</div>
          {application.decisionReason ? <div className="mt-5 rounded-2xl border border-slate-200 p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Administrator message</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{application.decisionReason}</p></div> : null}
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900"><ShieldCheck className="mt-0.5 shrink-0" size={18} /><p>This view contains only the public application status and applicant-facing decision message.</p></div>
          {params.withdrawn ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold">The application was withdrawn.</div> : null}
          {params.error ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">The requested status change was not applied because the application changed or is already in a final state.</div> : null}
          {canWithdraw ? <form action={withdrawBusinessApplicationAction} className="mt-6"><button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700">Withdraw application</button></form> : null}
        </div>
      </section>
    </ApplicationShell>
  );
}
