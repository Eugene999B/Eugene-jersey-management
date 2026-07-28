import { BookOpen, Download, Palette, Store, Truck } from "lucide-react";
import { getAllowedPlatformPermissions, requirePlatformPermission } from "@/lib/platform-admin";
import { redirect } from "next/navigation";

export default async function AdminHelpPage() {
  const session = await requirePlatformPermission();
  const allowed = await getAllowedPlatformPermissions(session.id);
  if (allowed !== null) redirect("/admin?error=permission");

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Main administrator learning centre</p><h1 className="mt-2 text-3xl font-semibold">Help and downloadable handbooks</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Use these guides to learn each platform page, how shop teams operate, supplier workflows and the safe order for important actions.</p></div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <a href="/api/guides/admin-handbook" className="panel p-5 transition hover:border-cyan-300"><BookOpen size={24} /><h2 className="mt-4 text-xl font-semibold">Complete administrator handbook</h2><p className="mt-2 text-sm leading-6 text-slate-600">Every main-admin page plus shops, staff, customers, suppliers, billing, messaging, security and daily operations.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"><Download size={16} /> Download DOCX</span></a>
        <a href="/api/guides/admin-page?page=/admin/shops" className="panel p-5 transition hover:border-cyan-300"><Store size={24} /><h2 className="mt-4 text-xl font-semibold">Shops and marketplace</h2><p className="mt-2 text-sm leading-6 text-slate-600">Registration, owner Login IDs, verification, suspension and voluntary online visibility.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"><Download size={16} /> Download guide</span></a>
        <a href="/api/guides/admin-page?page=/admin/support" className="panel p-5 transition hover:border-cyan-300"><Truck size={24} /><h2 className="mt-4 text-xl font-semibold">Shop and supplier operations</h2><p className="mt-2 text-sm leading-6 text-slate-600">How tenant workers, supplier records, supplier orders and support workflows fit together.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"><Download size={16} /> Download guide</span></a>
        <a href="/api/guides/design-studio" className="panel p-5 transition hover:border-cyan-300"><Palette size={24} /><h2 className="mt-4 text-xl font-semibold">Design Studio quick guide</h2><p className="mt-2 text-sm leading-6 text-slate-600">Selection, layers, transforms, history, machine profiles and safe production export.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800"><Download size={16} /> Download guide</span></a>
      </section>
    </div>
  );
}
