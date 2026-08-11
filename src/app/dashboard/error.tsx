"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="panel mx-auto max-w-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-red-50 p-3 text-red-700"><AlertTriangle size={22} /></span>
        <div>
          <h1 className="text-xl font-semibold">This action or page could not be completed</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Review the latest page state before repeating the action, because some operations can finish before a screen error is shown. Try the page again once; if the same problem repeats, return to Home and avoid repeating the business action until its current status is clear.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={reset}><RefreshCcw size={16} /> Try page again</Button>
        <LinkButton href="/dashboard" variant="outline">Return to Home</LinkButton>
      </div>
    </section>
  );
}
