"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLoginIdButton({ loginId, compact = false }: { loginId: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(loginId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copy} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 ${compact ? "min-h-8 px-2 text-xs" : "min-h-10 px-3 text-sm"}`} aria-label="Copy Login ID">
      {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : compact ? "Copy" : "Copy Login ID"}
    </button>
  );
}
