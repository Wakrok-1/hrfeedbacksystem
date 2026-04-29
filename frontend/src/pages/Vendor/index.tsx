import { useQuery } from "@tanstack/react-query";
import {
  FileText, Clock, TrendingUp, CheckCircle2, ArrowRight, Loader2,
  AlertTriangle, BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface Stats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  urgent_open: number;
  forecast_this_month: number;
  this_month_count: number;
}

function StatCard({ icon: Icon, label, value, iconBg, iconColor, badge }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconBg: string;
  iconColor: string;
  badge?: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm relative">
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-3 right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
      <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function VendorDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["vendor-stats"],
    queryFn: async () => {
      const res = await api.get<{ data: Stats }>("/api/vendor/stats");
      return res.data.data;
    },
  });

  const forecast = data?.forecast_this_month ?? 0;
  const thisMonth = data?.this_month_count ?? 0;
  const progressPct = forecast > 0 ? Math.min(Math.round((thisMonth / forecast) * 100), 100) : 0;

  return (
    <div className="p-7 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Vendor Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome, {user?.full_name} · Plant {user?.plant}
          </p>
        </div>
        <Link
          to="/vendor/complaints"
          className="flex items-center gap-1.5 rounded-lg border bg-white px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-muted/50 transition-colors"
        >
          View complaints <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Urgent alert strip */}
      {!isLoading && (data?.urgent_open ?? 0) > 0 && (
        <Link
          to="/vendor/complaints?priority=urgent"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{data!.urgent_open} urgent ticket{data!.urgent_open !== 1 ? "s" : ""}</span>
          <span className="text-red-600">require immediate attention</span>
          <ArrowRight className="h-3.5 w-3.5 ml-auto" />
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Assigned to Me"
          value={isLoading ? "—" : (data?.total ?? 0)}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={isLoading ? "—" : (data?.pending ?? 0)}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          badge={data?.urgent_open}
        />
        <StatCard
          icon={TrendingUp}
          label="In Progress"
          value={isLoading ? "—" : (data?.in_progress ?? 0)}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Resolved"
          value={isLoading ? "—" : (data?.resolved ?? 0)}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Monthly forecast */}
      {!isLoading && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <BarChart3 className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Monthly Forecast</p>
              <p className="text-xs text-muted-foreground">Based on your last 3 months average</p>
            </div>
          </div>

          {forecast === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Not enough history to forecast yet — check back after your first few months.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold">{thisMonth}</span>
                <span className="text-sm text-muted-foreground">of ~{forecast} predicted</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    progressPct >= 90 ? "bg-red-500" : progressPct >= 60 ? "bg-amber-500" : "bg-sky-500"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progressPct >= 90
                  ? "Running at or above predicted volume this month"
                  : progressPct >= 60
                  ? "On track for the month"
                  : "Below average pace so far this month"}
              </p>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading stats...
        </div>
      )}

      {!isLoading && data?.total === 0 && (
        <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/25 mb-3" />
          <p className="font-medium text-muted-foreground">No complaints assigned yet</p>
          <p className="text-sm text-muted-foreground/60 mt-1">The admin will assign complaints to you</p>
        </div>
      )}
    </div>
  );
}
