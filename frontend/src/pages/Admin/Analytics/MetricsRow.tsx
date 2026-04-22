import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, CheckCircle2, Users, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyticsMetrics, AnalyticsOverview } from "@/types/analytics";

function MetricCard({
  label, value, sub, trend, trendLabel, icon, valueColor, bg,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon: React.ReactNode;
  valueColor?: string;
  bg?: string;
}) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border bg-white px-5 py-4">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", bg ?? "bg-slate-100")}>
          {icon}
        </div>
        {trend && trendLabel && (
          <span className={cn(
            "flex items-center gap-0.5 text-[11px] font-medium",
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"
          )}>
            {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trendLabel}
          </span>
        )}
      </div>
      <p className={cn("text-2xl font-bold leading-none mb-1", valueColor ?? "text-foreground")}>{value}</p>
      <p className="text-xs font-medium text-foreground/70">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function MetricsRow({
  overview, metrics,
}: {
  overview: AnalyticsOverview;
  metrics: AnalyticsMetrics;
}) {
  const slaColor =
    metrics.sla_compliance_rate >= 90 ? "text-emerald-600" :
    metrics.sla_compliance_rate >= 70 ? "text-amber-600" : "text-red-600";
  const vrColor =
    metrics.vendor_response_rate >= 90 ? "text-emerald-600" :
    metrics.vendor_response_rate >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex gap-3 flex-wrap">
      <MetricCard
        label="Total Complaints"
        value={overview.total}
        sub={`${overview.open} still open`}
        icon={<BarChart2 className="h-4 w-4 text-slate-600" />}
        bg="bg-slate-100"
      />
      <MetricCard
        label="Resolution Rate"
        value={`${metrics.resolution_rate}%`}
        sub={`${overview.resolved + overview.closed} resolved`}
        trend={metrics.resolution_rate >= 70 ? "up" : "down"}
        trendLabel={metrics.resolution_rate >= 70 ? "On track" : "Below target"}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        bg="bg-emerald-50"
        valueColor="text-emerald-700"
      />
      <MetricCard
        label="Urgent Cases"
        value={overview.urgent_count}
        sub={overview.sla_breach_count > 0 ? `${overview.sla_breach_count} past SLA` : "All within SLA"}
        icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
        bg="bg-red-50"
        valueColor={overview.urgent_count > 0 ? "text-red-600" : "text-foreground"}
      />
      <MetricCard
        label="Avg Response Time"
        value={`${metrics.avg_response_time_hours}h`}
        sub="complaint → in progress"
        trend={metrics.avg_response_time_hours <= 4 ? "up" : "down"}
        trendLabel={metrics.avg_response_time_hours <= 4 ? "Fast" : "Slow"}
        icon={<Clock className="h-4 w-4 text-blue-600" />}
        bg="bg-blue-50"
      />
      <MetricCard
        label="SLA Compliance"
        value={`${metrics.sla_compliance_rate}%`}
        sub="urgent resolved in time"
        icon={<CheckCircle2 className="h-4 w-4 text-violet-600" />}
        bg="bg-violet-50"
        valueColor={slaColor}
      />
      <MetricCard
        label="Vendor Response"
        value={`${metrics.vendor_response_rate}%`}
        sub="responded within 48h"
        icon={<Users className="h-4 w-4 text-teal-600" />}
        bg="bg-teal-50"
        valueColor={vrColor}
      />
    </div>
  );
}
