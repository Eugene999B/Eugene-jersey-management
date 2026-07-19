"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type SalesPoint = {
  label: string;
  sales: number;
};

export function SalesChart({ data }: { data: SalesPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="salesTone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--shop-primary)" stopOpacity={0.36} />
              <stop offset="95%" stopColor="var(--shop-primary)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d7" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
          <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #ded8cd" }} />
          <Area type="monotone" dataKey="sales" stroke="var(--shop-primary)" fill="url(#salesTone)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
