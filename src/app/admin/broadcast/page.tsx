import { Megaphone, MessageSquareText, UsersRound } from "lucide-react";
import { createGlobalAnnouncementAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { prisma } from "@/lib/db";
import { compactNumber, shortDate } from "@/lib/format";
import { requirePlatformPermission } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

type BroadcastPageProps = { searchParams?: Promise<{ error?: string }> };

export default async function BroadcastPage({ searchParams }: BroadcastPageProps) {
  const params = (await searchParams) ?? {};
  await requirePlatformPermission("broadcast");
  const [announcements, activeShops, activeUsers] = await Promise.all([
    prisma.announcement.findMany({
      where: { isGlobal: true },
      include: { _count: { select: { dismissals: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.shop.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true, shopId: { not: null } } }),
  ]);

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Platform communication</p><h1 className="mt-2 text-3xl font-semibold">Broadcast</h1><p className="mt-2 text-sm text-slate-600">Publish platform-wide operational notices without granting access to tenant administration.</p></div>
      {params.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">The announcement was not published. Add a clear title and message, then try again.</div> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Published notices" value={compactNumber(announcements.length)} icon={<Megaphone size={20} />} />
        <StatCard label="Active shops" value={compactNumber(activeShops)} icon={<UsersRound size={20} />} />
        <StatCard label="Active tenant users" value={compactNumber(activeUsers)} icon={<MessageSquareText size={20} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-semibold">Publish announcement</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">The notice appears on every tenant dashboard. Do not include passwords, secret keys or private customer information.</p>
          <form action={createGlobalAnnouncementAction} className="mt-5 space-y-3">
            <input className="field" name="title" minLength={2} maxLength={120} placeholder="Announcement title" required />
            <textarea className="field min-h-40" name="body" minLength={2} maxLength={2000} placeholder="Write the platform notice" required />
            <Button variant="secondary" className="w-full">Publish to all shops</Button>
          </form>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#ded8cd] p-5"><h2 className="text-xl font-semibold">Announcement history</h2><p className="mt-1 text-sm text-slate-500">Recent global notices and the number of tenant users who dismissed each one.</p></div>
          <div className="divide-y divide-[#ded8cd] bg-white">
            {announcements.map((announcement) => <article key={announcement.id} className="p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{announcement.title}</p><p className="mt-2 max-w-3xl whitespace-pre-wrap leading-6 text-slate-600">{announcement.body}</p></div><div className="text-right text-xs text-slate-500"><p>{shortDate(announcement.createdAt)}</p><p className="mt-1 font-semibold">{compactNumber(announcement._count.dismissals)} dismissed</p></div></div></article>)}
            {!announcements.length ? <p className="p-6 text-sm text-slate-500">No global announcement has been published yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
