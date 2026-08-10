import { Clock3, Laptop, LogOut, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import {
  revokeAccountSessionAction,
  revokeOtherAccountSessionsAction,
} from "@/app/account/security/session-actions";
import { describeAccountSession } from "@/lib/account-sessions";

type SessionRecord = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
};

type Props = {
  currentSessionId: string;
  sessions: SessionRecord[];
};

const dateTime = new Intl.DateTimeFormat("en-GH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Accra",
});

function sessionState(session: SessionRecord, now: Date) {
  if (session.revokedAt) return "revoked" as const;
  if (session.expiresAt <= now) return "expired" as const;
  return "active" as const;
}

function stateLabel(state: ReturnType<typeof sessionState>, isCurrent: boolean) {
  if (isCurrent) return "Current device";
  if (state === "active") return "Active";
  if (state === "revoked") return "Signed out";
  return "Expired";
}

export function SessionSecurityPanel({ currentSessionId, sessions }: Props) {
  const now = new Date();
  const activeOtherSessions = sessions.filter((session) => (
    session.id !== currentSessionId && sessionState(session, now) === "active"
  ));

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShieldCheck size={21} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">Your devices</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Review recent signed-in devices and end a single session without changing your password or signing out everywhere.
              </p>
            </div>
          </div>
          {activeOtherSessions.length > 0 ? (
            <form action={revokeOtherAccountSessionsAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
              >
                <LogOut size={16} />
                Sign out other devices
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {sessions.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-600 sm:px-6">
            No session history is available yet. New sign-ins will appear here.
          </div>
        ) : sessions.map((session) => {
          const details = describeAccountSession(session.userAgent);
          const isCurrent = session.id === currentSessionId;
          const state = sessionState(session, now);
          const active = state === "active";
          const MobileIcon = /mobile|Android|iPhone|iPad/i.test(`${details.device} ${session.userAgent ?? ""}`)
            ? Smartphone
            : Laptop;

          return (
            <article key={session.id} className="px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                    <MobileIcon size={19} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-950">{details.browser} · {details.device}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        isCurrent
                          ? "bg-emerald-100 text-emerald-800"
                          : active
                            ? "bg-cyan-100 text-cyan-800"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {stateLabel(state, isCurrent)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1.5 text-xs leading-5 text-slate-500 sm:grid-cols-2 sm:gap-x-6">
                      <span className="inline-flex items-center gap-1.5"><Clock3 size={13} />Last active {dateTime.format(session.lastSeenAt)}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin size={13} />IP {session.ipAddress ?? "Unavailable"}</span>
                      <span>Signed in {dateTime.format(session.createdAt)}</span>
                      <span>{active ? `Expires ${dateTime.format(session.expiresAt)}` : session.revokedAt ? `Signed out ${dateTime.format(session.revokedAt)}` : `Expired ${dateTime.format(session.expiresAt)}`}</span>
                    </div>
                    {session.revokedReason && state === "revoked" ? (
                      <p className="mt-2 text-xs text-slate-500">Reason: {session.revokedReason.replaceAll("-", " ")}</p>
                    ) : null}
                  </div>
                </div>

                {active ? (
                  <form action={revokeAccountSessionAction} className="shrink-0">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <button
                      type="submit"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <LogOut size={15} />
                      {isCurrent ? "Sign out this device" : "Sign out"}
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
