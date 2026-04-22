import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, TrendingUp, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Stats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
}

function StatCard({ icon: Icon, label, value, iconBg, iconColor }: {
  icon: React.ElementType; label: string; value: number | string; iconBg: string; iconColor: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Assigned to Me" value={isLoading ? "—" : (data?.total ?? 0)} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard icon={Clock} label="Pending" value={isLoading ? "—" : (data?.pending ?? 0)} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard icon={TrendingUp} label="In Progress" value={isLoading ? "—" : (data?.in_progress ?? 0)} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatCard icon={CheckCircle2} label="Resolved" value={isLoading ? "—" : (data?.resolved ?? 0)} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

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
