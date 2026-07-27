import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPlatformWorkerAction, togglePlatformWorkerAction, updatePlatformWorkerPermissionsAction } from "@/app/admin/actions";
import { prisma } from "@/lib/db";
import { compactNumber, shortDate } from "@/lib/format";
import { parsePlatformPermissions, platformPermissionOptions, requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type StaffPageProps = { searchParams?: Promise<{ error?: string }> };

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = (await searchParams) ?? {};
  const session = await requirePlatformPermission("workers");
  const workers = await prisma.user.findMany({
    where: { role: Role.SUPER_ADMIN, shopId: null },
    include: { auditLogs: { orderBy: { createdAt: "desc" }, take: 4 }, _count: { select: { auditLogs: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Workforce administration</p><h1 className="mt-2 text-3xl font-semibold">Admin staff</h1><p className="mt-2 text-sm text-slate-600">Create platform workers, assign responsibilities, review activity and revoke access safely.</p></div>
      {params.error === "worker-exists" ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">That email already belongs to an account. Platform workers must use a unique email.</div> : null}
      {params.error === "permissions" ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Permission changes require another platform worker and at least one selected responsibility.</div> : null}
      {params.error && params.error !== "worker-exists" && params.error !== "permissions" ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">The worker action could not be completed. Check required fields and permissions.</div> : null}

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-semibold">Create platform worker</h2><p className="mt-2 text-sm text-slate-500">Workers receive only the platform areas selected below. At least one responsibility is required.</p>
          <form action={createPlatformWorkerAction} className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2"><input className="field" name="name" placeholder="Worker full name" required /><input className="field uppercase" name="adminLoginId" placeholder="Login ID, e.g. ADM-SUPPORT-01" /><input className="field" name="email" type="email" placeholder="worker@example.com" required /><input className="field" name="phone" placeholder="Phone" /><input className="field" name="staffTitle" placeholder="Role/title" /><input className="field" name="department" placeholder="Department" /><input className="field" name="emergencyContact" placeholder="Emergency contact" /><input className="field" name="password" type="password" minLength={12} autoComplete="new-password" placeholder="Temporary password (12+ characters)" required /></div>
            <textarea className="field min-h-24" name="staffNotes" placeholder="Internal notes, assigned queues, training status, or restrictions" />
            <fieldset className="rounded-xl border border-slate-200 bg-white p-3"><legend className="px-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Platform access</legend><div className="grid grid-cols-2 gap-2 text-sm">{platformPermissionOptions.map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" name="adminPermissions" value={key} /><span>{label}</span></label>)}</div></fieldset>
            <Button variant="secondary" className="w-full">Save worker profile</Button>
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Platform team</h2><p className="mt-1 text-sm text-slate-500">{workers.length} administrator account{workers.length === 1 ? "" : "s"}. Permission changes invalidate that worker&apos;s current sessions immediately.</p></div>
          <div className="divide-y divide-[#ded8cd] bg-white">{workers.map((worker) => {
            const workerPermissions = parsePlatformPermissions(worker.adminPermissions);
            const unrestricted = workerPermissions.length === 0;
            return <article key={worker.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{worker.name}</p><Badge tone={worker.isActive ? "green" : "red"}>{worker.isActive ? "Active" : "Suspended"}</Badge>{worker.id === session.id ? <Badge tone="blue">Current account</Badge> : null}{unrestricted ? <Badge tone="green">Unrestricted</Badge> : null}</div><p className="mt-1 text-slate-500">{worker.email}</p><p className="mt-1 text-xs font-semibold text-slate-600">ID: {worker.adminLoginId ?? "Not assigned"}</p><p className="text-xs text-slate-500">{worker.staffTitle ?? "Admin worker"}{worker.department ? ` · ${worker.department}` : ""}</p></div><form action={togglePlatformWorkerAction}><input type="hidden" name="userId" value={worker.id} /><Button disabled={worker.id === session.id} variant={worker.isActive ? "outline" : "primary"} className="min-h-8 px-2 py-1 text-xs">{worker.id === session.id ? "Protected" : worker.isActive ? "Suspend" : "Activate"}</Button></form></div>
              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><p>Last login: <span className="font-semibold text-slate-700">{worker.lastLoginAt ? shortDate(worker.lastLoginAt) : "Never"}</span></p><p>Recorded actions: <span className="font-semibold text-slate-700">{compactNumber(worker._count.auditLogs)}</span></p><p>Phone: <span className="font-semibold text-slate-700">{worker.phone ?? "None"}</span></p><p>Emergency: <span className="font-semibold text-slate-700">{worker.emergencyContact ?? "None"}</span></p></div>
              <div className="mt-3 flex flex-wrap gap-1">{(workerPermissions.length ? workerPermissions : ["full-access"]).map((permission) => <Badge key={permission} tone={permission === "full-access" ? "green" : "blue"}>{permission}</Badge>)}</div>
              {worker.id !== session.id ? <form action={updatePlatformWorkerPermissionsAction} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><input type="hidden" name="userId" value={worker.id} /><fieldset><legend className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Edit responsibilities</legend><div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{platformPermissionOptions.map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" name="adminPermissions" value={key} defaultChecked={workerPermissions.includes(key)} /><span>{label}</span></label>)}</div></fieldset><Button variant="outline" className="mt-3 min-h-9 px-3 py-1 text-xs">Save access</Button></form> : null}
              {worker.auditLogs.length ? <div className="mt-3 rounded-xl bg-[#f6f4ef] p-3 text-xs text-slate-600"><p className="font-semibold text-slate-800">Recent actions</p>{worker.auditLogs.map((log) => <p key={log.id} className="mt-1">{log.action} · {shortDate(log.createdAt)}</p>)}</div> : null}
              {worker.staffNotes ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{worker.staffNotes}</p> : null}
            </article>})}{!workers.length ? <p className="p-5 text-sm text-slate-500">No platform workers have been created.</p> : null}</div>
        </div>
      </section>
    </div>
  );
}
