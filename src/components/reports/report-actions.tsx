"use client";

import Link from "next/link";
import { Download, FileSpreadsheet, FileText, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportActions({ from, to, canDownload }: { from: string; to: string; canDownload: boolean }) {
  const exportPath = (format: string) => `/api/exports?module=pos&format=${format}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div className="flex flex-wrap gap-2">
      {canDownload ? <><a
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-[#f6f4ef]"
        href={exportPath("csv")}
      >
        <Download size={16} />
        Export CSV
      </a>
      <a
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-[#f6f4ef]"
        href={exportPath("excel")}
      >
        <FileSpreadsheet size={16} />
        Excel
      </a>
      <a
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-[#f6f4ef]"
        href={exportPath("word")}
      >
        <FileText size={16} />
        Word
      </a>
      <a
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-[#f6f4ef]"
        href={exportPath("pdf")}
      >
        <FileText size={16} />
        PDF
      </a>
      </> : null}
      <Button variant="outline" onClick={() => window.print()}>
        <FileText size={16} />
        Print
      </Button>
      {canDownload ? <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-slate-900 px-4 py-2 text-sm font-semibold text-white" href="/dashboard/exports">
        <SlidersHorizontal size={16} /> Export center
      </Link> : null}
    </div>
  );
}
