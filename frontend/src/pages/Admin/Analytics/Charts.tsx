import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { TrendPoint, CategoryStat, PlantStat, ShiftCell, VendorPerf } from "@/types/analytics";

// ── Empty state ────────────────────────────────────────────────────────────

function Empty({ message = "No data for selected period" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
        <svg className="h-5 w-5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <p className="text-xs">{message}</p>
    </div>
  );
}

// ── Ticket Volume Trend ────────────────────────────────────────────────────

type Granularity = "day" | "week" | "month";

export function TrendChart({
  data, granularity, onGranularityChange,
}: {
  data: TrendPoint[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}) {
  const formatX = (date: string) => {
    if (granularity === "month") return date.slice(0, 7);
    return date.slice(5); // MM-DD
  };

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Ticket Volume Trend</h3>
          <p className="text-xs text-muted-foreground">Complaints submitted vs resolved over time</p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
          {(["day","week","month"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => onGranularityChange(g)}
              className={cn(
                "rounded-md px-3 py-1 text-[11px] font-medium transition-all capitalize",
                granularity === g ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      {!data.length ? <Empty /> : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tickFormatter={formatX} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(v: number, name: string) => [v, name === "complaints_count" ? "Submitted" : "Resolved"]}
            />
            <Legend formatter={(v) => v === "complaints_count" ? "Submitted" : "Resolved"} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="complaints_count" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="resolved_count" stroke="#14b8a6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Status Distribution Donut ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new:               "#0ea5e9",
  in_progress:       "#3b82f6",
  vendor_pending:    "#8b5cf6",
  awaiting_approval: "#f59e0b",
  escalated:         "#ef4444",
  resolved:          "#10b981",
  closed:            "#94a3b8",
};
const STATUS_LABELS: Record<string, string> = {
  new: "New", in_progress: "In Progress", vendor_pending: "Vendor Pending",
  awaiting_approval: "Awaiting Approval", escalated: "Escalated",
  resolved: "Resolved", closed: "Closed",
};

export function StatusDonut({ overview }: { overview: Record<string, number> }) {
  const data = Object.entries(STATUS_COLORS)
    .map(([key, color]) => ({ name: key, value: overview[key] ?? 0, color }))
    .filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border bg-white p-5 h-full">
      <h3 className="text-sm font-semibold mb-1">Status Distribution</h3>
      <p className="text-xs text-muted-foreground mb-4">Current breakdown by status</p>
      {!total ? <Empty /> : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={78}
                paddingAngle={2} dataKey="value"
              >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: number) => [`${v} (${Math.round(v/total*100)}%)`, ""]}
                labelFormatter={(label) => STATUS_LABELS[label] ?? label}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-muted-foreground truncate">{STATUS_LABELS[d.name]}</span>
                <span className="font-semibold ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Category Breakdown Bar ─────────────────────────────────────────────────

export function CategoryBar({ data }: { data: CategoryStat[] }) {
  return (
    <div className="rounded-xl border bg-white p-5 h-full">
      <h3 className="text-sm font-semibold mb-1">Category Breakdown</h3>
      <p className="text-xs text-muted-foreground mb-4">Volume and resolution rate by category</p>
      {!data.length ? <Empty /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={90} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(v: number, name: string) => [
                name === "total" ? `${v} complaints` : `${v} resolved`,
                name === "total" ? "Total" : "Resolved",
              ]}
            />
            <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={14} />
            <Bar dataKey="resolved" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Plant Comparison ──────────────────────────────────────────────────────

export function PlantBar({ data }: { data: PlantStat[] }) {
  return (
    <div className="rounded-xl border bg-white p-5 h-full">
      <h3 className="text-sm font-semibold mb-1">Plant Comparison</h3>
      <p className="text-xs text-muted-foreground mb-4">Complaint volume by plant and status</p>
      {!data.length ? <Empty /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="plant" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="resolved"    name="Resolved"    fill="#14b8a6" radius={[3,3,0,0]} barSize={18} />
            <Bar dataKey="in_progress" name="In Progress" fill="#3b82f6" radius={[3,3,0,0]} barSize={18} />
            <Bar dataKey="pending"     name="Pending"     fill="#f59e0b" radius={[3,3,0,0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Vendor Performance Table ───────────────────────────────────────────────

const BAND_STYLES = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red:   "bg-red-50 text-red-700 border-red-200",
};

export function VendorTable({ data }: { data: VendorPerf[] }) {
  return (
    <div className="rounded-xl border bg-white p-5 h-full">
      <h3 className="text-sm font-semibold mb-1">Vendor Performance</h3>
      <p className="text-xs text-muted-foreground mb-4">Response rate and SLA compliance by vendor</p>
      {!data.length ? <Empty message="No vendors assigned" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground/60">
                <th className="text-left pb-2 font-semibold">Vendor</th>
                <th className="text-right pb-2 font-semibold">Assigned</th>
                <th className="text-right pb-2 font-semibold">Resolved</th>
                <th className="text-right pb-2 font-semibold">Avg Resp.</th>
                <th className="text-right pb-2 font-semibold">SLA Breach</th>
                <th className="text-right pb-2 font-semibold">Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((v) => (
                <tr key={v.vendor_id} className="hover:bg-slate-50/50">
                  <td className="py-2 font-medium">{v.vendor_name}</td>
                  <td className="py-2 text-right">{v.cases_assigned}</td>
                  <td className="py-2 text-right">{v.cases_resolved}</td>
                  <td className="py-2 text-right">{v.avg_response_time_hours}h</td>
                  <td className="py-2 text-right">
                    {v.sla_breaches > 0 ? (
                      <span className="text-red-600 font-semibold">{v.sla_breaches}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <span className={cn("inline-block rounded-md border px-2 py-0.5 font-semibold text-[11px]", BAND_STYLES[v.color_band])}>
                      {v.reliability_score}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shift Heatmap ──────────────────────────────────────────────────────────

const DAYS   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SHIFTS = ["Morning","Lunch","Tea Break","Dinner","Night Shift","Other"];

export function ShiftHeatmap({ data }: { data: ShiftCell[] }) {
  const [tooltip, setTooltip] = useState<{ cell: ShiftCell; x: number; y: number } | null>(null);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getCell = (day: string, shift: string) =>
    data.find((d) => d.day === day && d.shift_period === shift) ?? { day, shift_period: shift, count: 0, top_category: "" };

  const getBg = (count: number) => {
    if (count === 0) return "bg-slate-50 border-slate-100";
    const intensity = count / maxCount;
    if (intensity > 0.8) return "bg-violet-700 text-white border-violet-600";
    if (intensity > 0.6) return "bg-violet-500 text-white border-violet-400";
    if (intensity > 0.4) return "bg-violet-300 border-violet-200";
    if (intensity > 0.2) return "bg-violet-200 border-violet-100";
    return "bg-violet-100 border-violet-50";
  };

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold mb-1">Complaint Pattern by Day &amp; Shift</h3>
      <p className="text-xs text-muted-foreground mb-4">Volume heatmap — darker = more complaints</p>
      <div className="overflow-x-auto relative">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="pb-2 w-24 text-left text-muted-foreground font-medium">Shift</th>
              {DAYS.map((d) => (
                <th key={d} className="pb-2 text-center font-semibold text-muted-foreground/70 w-[calc((100%-6rem)/7)]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift) => (
              <tr key={shift}>
                <td className="py-1 pr-3 text-muted-foreground font-medium text-[11px] whitespace-nowrap">{shift}</td>
                {DAYS.map((day) => {
                  const cell = getCell(day, shift);
                  return (
                    <td key={day} className="p-0.5">
                      <div
                        className={cn(
                          "rounded-md border text-center font-semibold cursor-default transition-all h-9 flex items-center justify-center",
                          getBg(cell.count)
                        )}
                        onMouseEnter={(e) => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({ cell, x: rect.left, y: rect.bottom });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {cell.count > 0 ? cell.count : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tooltip */}
        {tooltip && tooltip.cell.count > 0 && (
          <div
            className="fixed z-50 rounded-lg border bg-white shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{ top: tooltip.y + 8, left: tooltip.x }}
          >
            <p className="font-semibold">{tooltip.cell.day} · {tooltip.cell.shift_period}</p>
            <p className="text-muted-foreground">{tooltip.cell.count} complaints</p>
            {tooltip.cell.top_category && (
              <p className="text-muted-foreground">Top: {tooltip.cell.top_category}</p>
            )}
          </div>
        )}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px] text-muted-foreground">Low</span>
        {["bg-violet-100","bg-violet-200","bg-violet-300","bg-violet-500","bg-violet-700"].map((c) => (
          <span key={c} className={cn("h-3 w-6 rounded", c)} />
        ))}
        <span className="text-[11px] text-muted-foreground">High</span>
      </div>
    </div>
  );
}
