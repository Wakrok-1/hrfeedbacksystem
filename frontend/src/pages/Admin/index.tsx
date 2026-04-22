import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, TrendingUp, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge, PriorityBadge } from "./Complaints/StatusBadge";
import { ComplaintDetail } from "./Complaints/ComplaintDetail";
import type { ComplaintsListResponse, ComplaintListItem } from "@/types/admin";

function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconBg: string;
  iconColor: string;
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

export function AdminDashboard() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<ComplaintsListResponse>({
    queryKey: ["admin-complaints", 1, "", "", "", ""],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ComplaintsListResponse }>("/api/admin/complaints?page_size=5");
      return res.data.data;
    },
  });

  return (
    <div className="p-7 space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome back, {user?.full_name} · Plant {user?.plant}
          </p>
        </div>
        <Link
          to="/admin/complaints"
          className="flex items-center gap-1.5 rounded-lg border bg-white px-3.5 py-2 text-sm font-medium shadow-sm hover:bg-muted/50 transition-colors"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total Complaints" value={isLoading ? "—" : (data?.total ?? 0)} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard icon={Clock} label="Pending" value={isLoading ? "—" : (data?.pending ?? 0)} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard icon={TrendingUp} label="In Progress" value={isLoading ? "—" : (data?.in_progress ?? 0)} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatCard icon={CheckCircle2} label="Resolved" value={isLoading ? "—" : (data?.resolved ?? 0)} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {/* Recent table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-sm">Recent Complaints</h2>
          <Link to="/admin/complaints" className="text-xs text-primary hover:underline font-medium">
            See all →
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !data?.items?.length ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2 opacity-25" />
            <p className="text-sm font-medium">No complaints yet</p>
            <p className="text-xs mt-1 opacity-60">Submitted complaints will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Submitter</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((c: ComplaintListItem) => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)} className="cursor-pointer hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-primary">{c.reference_id}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{c.submitter_name}</p>
                    <p className="text-xs text-muted-foreground">{c.submitter_employee_id}</p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{c.category}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId !== null && <ComplaintDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
