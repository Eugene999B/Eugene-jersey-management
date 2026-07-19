"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportActions({ csv, range }: { csv: string; range: string }) {
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  const exportPath = (format: string) => `/api/reports/export?format=${format}&range=${encodeURIComponent(range)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#ded8cd] bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-[#f6f4ef]"
        href={csvHref}
        download="sports-shop-report.csv"
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
      <Button variant="outline" onClick={() => window.print()}>
        <FileText size={16} />
        Print
      </Button>
    </div>
  );
}
