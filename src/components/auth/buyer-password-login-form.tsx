"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { buyerPasswordLoginAction } from "@/app/buyer/login/actions";

export function BuyerPasswordLoginForm({ nextPath }: { nextPath: string }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const clear = () => {
      setPhone("");
      setPassword("");
      setShowPassword(false);
    };
    clear();
    window.addEventListener("pageshow", clear);
    return () => window.removeEventListener("pageshow", clear);
  }, []);

  return (
    <form action={buyerPasswordLoginAction} autoComplete="off" data-form-type="other" className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_70px_rgba(5,16,34,0.12)] backdrop-blur-xl">
      <input type="hidden" name="next" value={nextPath} />
      <div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Phone size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">Existing buyer</p><h3 className="font-bold">Phone and password</h3></div></div>
      <div className="mt-4 space-y-3">
        <input className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" name="phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" autoComplete="off" data-lpignore="true" data-1p-ignore="true" required />
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-11 pr-12 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100" name="password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder="Password" autoComplete="off" data-lpignore="true" data-1p-ignore="true" required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
        </div>
        <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#07111f] px-4 text-sm font-semibold text-white transition hover:bg-[#10243e]">Continue securely <ArrowRight size={16} /></button>
      </div>
    </form>
  );
}
