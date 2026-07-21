import { FileDown } from "lucide-react";
import { ExportCenter } from "@/components/exports/export-center";
import { getTenantContext } from "@/lib/tenant";

export default async function ExportsPage() {
  const { shop } = await getTenantContext();
  if (!shop) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-slate-950 p-3 text-white"><FileDown size={21} /></div>
        <div><h1 className="text-2xl font-semibold">Reports and exports</h1><p className="mt-1 text-sm text-slate-500">Choose a date range, filter the records, then download a focused operational report.</p></div>
      </div>
      <ExportCenter />
    </div>
  );
}
