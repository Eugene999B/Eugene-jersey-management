import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createInviteAction } from "@/app/dashboard/staff/actions";
import { prisma } from "@/lib/db";
import { roleLabels } from "@/lib/rbac";
import { shortDate } from "@/lib/format";
import { getTenantContext } from "@/lib/tenant";

export default async function StaffPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  const [users, invites] = await Promise.all([
    prisma.user.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" } }),
    prisma.inviteToken.findMany({ where: { shopId: shop.id, usedAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
      <section className="panel p-5">
        <h1 className="text-xl font-semibold">Invite staff</h1>
        <p className="mt-2 text-sm text-slate-500">Owner and Manager roles can invite shop staff. Links print to the server console in dev.</p>
        <form action={createInviteAction} className="mt-5 space-y-3">
          <input className="field" name="email" type="email" placeholder="staff@example.com" required />
          <select className="field" name="role" defaultValue={Role.CASHIER}>
            {[Role.OWNER, Role.MANAGER, Role.CASHIER, Role.DESIGNER, Role.INVENTORY_CLERK, Role.ACCOUNTANT, Role.VIEWER].map((role) => (
              <option key={role} value={role}>{roleLabels[role]}</option>
            ))}
          </select>
          <Button className="w-full">Create invite</Button>
        </form>

        <h2 className="mt-6 text-sm font-semibold uppercase text-slate-500">Open invites</h2>
        <div className="mt-3 space-y-2">
          {invites.map((invite) => (
            <div key={invite.id} className="rounded-[8px] bg-white p-3 text-sm">
              <p className="font-semibold">{invite.email}</p>
              <p className="text-slate-500">{roleLabels[invite.role]} - expires {shortDate(invite.expiresAt)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#ded8cd] p-5">
          <h1 className="text-xl font-semibold">Staff directory</h1>
          <p className="text-sm text-slate-500">Role-based access controls are enforced in middleware, pages, and API routes.</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f6f4ef] text-xs uppercase text-slate-500">
            <tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Last login</th></tr>
          </thead>
          <tbody className="divide-y divide-[#ded8cd] bg-white">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="p-4">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-slate-500">{user.email}</p>
                </td>
                <td className="p-4"><Badge>{roleLabels[user.role]}</Badge></td>
                <td className="p-4"><Badge tone={user.isActive ? "green" : "red"}>{user.isActive ? "Active" : "Disabled"}</Badge></td>
                <td className="p-4 text-slate-500">{user.lastLoginAt ? shortDate(user.lastLoginAt) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
