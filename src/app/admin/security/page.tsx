import Link from "next/link";
import { Role } from "@prisma/client";
import { AlertTriangle, KeyRound, LockKeyhole, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { prisma } from "@/lib/db";
import { compactNumber, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await requirePlatformPermission("security");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [currentAdmin, failedLoginEvents, failedLoginLogs, activeAdmins, suspendedAdmins] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.id } }),
    prisma.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gte: since } } }),
    prisma.auditLog.findMany({ where: { action: "auth.login_failed", createdAt: { gte: since } }, include: { user: true, shop: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.user.count({ where: { role: Role.SUPER_ADMIN, shopId: null, isActive: true } }),
    prisma.user.count({ where: { role: Role.SUPER_ADMIN, shopId: null, isActive: false } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Platform protection</p><h1 className="mt-2 text-3xl font-semibold">Security</h1><p className="mt-2 text-sm text-slate-600">Review authentication risk, administrator status and the controls protecting every tenant.</p></div><Link href="/admin/staff" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Manage admin access</Link></div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Failed logins · 24h" value={compactNumber(failedLoginEvents)} icon={<AlertTriangle size={20} />} /><StatCard label="Active administrators" value={compactNumber(activeAdmins)} icon={<UserCheck size={20} />} /><StatCard label="Suspended administrators" value={compactNumber(suspendedAdmins)} icon={<UserX size={20} />} /><StatCard label="Your session version" value={compactNumber(currentAdmin?.sessionVersion ?? 0)} icon={<KeyRound size={20} />} /></section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="panel p-5"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-cyan-700" /><h2 className="text-xl font-semibold">Current administrator</h2></div><dl className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Login ID</dt><dd className="mt-2 font-semibold">{currentAdmin?.adminLoginId ?? currentAdmin?.email ?? "Current admin"}</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Last login</dt><dd className="mt-2 font-semibold">{currentAdmin?.lastLoginAt ? shortDate(currentAdmin.lastLoginAt) : "No login recorded"}</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Account state</dt><dd className="mt-2 font-semibold">{currentAdmin?.isActive ? "Active" : "Suspended"}</dd></div><div className="rounded-xl bg-white p-4"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Self protection</dt><dd className="mt-2 font-semibold">Cannot suspend yourself</dd></div></dl></div>
        <div className="panel p-5"><div className="flex items-center gap-2"><LockKeyhole size={20} className="text-cyan-700" /><h2 className="text-xl font-semibold">Enforced safeguards</h2></div><div className="mt-5 space-y-3 text-sm leading-6 text-slate-600"><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Session revalidation:</strong> every authenticated request confirms account state, tenant state and session version against the database.</p><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Immediate revocation:</strong> suspending an administrator or tenant invalidates active sessions through session-version changes.</p><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Enumeration resistance:</strong> failed login responses do not reveal whether an account exists.</p><p className="rounded-xl bg-white p-4"><strong className="text-slate-900">Rate limiting:</strong> repeated login attempts are restricted by account and network source.</p></div></div>
      </section>

      <section className="panel overflow-hidden"><div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Recent failed sign-ins</h2><p className="mt-1 text-sm text-slate-500">Authentication failures recorded during the last 24 hours.</p></div><div className="divide-y divide-[#ded8cd] bg-white">{failedLoginLogs.map((log) => <article key={log.id} className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_auto]"><div><p className="font-semibold">Failed authentication attempt</p><p className="mt-1 text-slate-500">{log.shop?.name ?? "Platform login"} · {log.user?.email ?? "Unresolved account"}</p></div><p className="text-slate-500">{shortDate(log.createdAt)}</p></article>)}{!failedLoginLogs.length ? <p className="p-5 text-sm text-slate-500">No failed sign-ins were recorded in the last 24 hours.</p> : null}</div></section>
    </div>
  );
}
