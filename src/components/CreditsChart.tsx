"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type Point = { label: string; earned: number; redeemed: number };
export function CreditsChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Credits earned and redeemed by month">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C6F432" stopOpacity={0.5} /><stop offset="100%" stopColor="#C6F432" stopOpacity={0} /></linearGradient>
            <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} /><stop offset="100%" stopColor="#60a5fa" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="#26302A" vertical={false} />
          <XAxis dataKey="label" stroke="#8A978F" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis stroke="#8A978F" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#121714", border: "1px solid #26302A", borderRadius: 12 }} labelStyle={{ color: "#fff" }} />
          <Area type="monotone" dataKey="earned" name="Earned" stroke="#C6F432" fill="url(#gE)" strokeWidth={2} />
          <Area type="monotone" dataKey="redeemed" name="Redeemed" stroke="#60a5fa" fill="url(#gR)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
