import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, Paperclip, MessageSquare } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/pages/Admin/Complaints/StatusBadge";
import { VendorComplaintDetail } from "./VendorComplaintDetail";
import type { ComplaintStatus } from "@/types/complaint";
import { cn } from "@/lib/utils";

interface VendorComplaintItem {
  id: number;
  reference_id: string;
  category: string;
  status: ComplaintStatus;
  priority: string;
  plant: string;
  submitter_name: string;
  description: string;
  created_at: string;
  attachment_count: number;
  response_count: number;
}

interface VendorComplaintListResponse {
  items: VendorComplaintItem[];
  total: number;
  page: number;
  pages: number;
}

const STATUS_TABS: { value: ComplaintStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "vendor_pending", label: "Action Needed" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

export function VendorComplaintsPage() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "">("");
  const [urgentOnly, setUrgentOnly] = useState(searchParams.get("priority") === "urgent");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Sync urgentOnly with URL param on mount
  useEffect(() => {
    if (searchParams.get("priority") === "urgent") setUrgentOnly(true);
  }, []);

  const { data, isLoading } = useQuery<VendorComplaintListResponse>({
    queryKey: ["vendor-complaints", page, statusFilter, urgentOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (urgentOnly) params.set("priority", "urgent");
      const res = await api.get<{ data: VendorComplaintListResponse }>(`/api/vendor/complaints?${params}`);
      return res.data.data;
    },
  });

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">My Complaints</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {data
            ? `${data.total} complaint${data.total !== 1 ? "s" : ""} assigned to you${urgentOnly ? " · urgent only" : ""}`
            : "Loading..."}
        </p>
      </div>

      {/* Status tabs + urgent toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value as ComplaintStatus | ""); setPage(1); }}
              className={cn(
                "shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
                statusFilter === tab.value
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setUrgentOnly((v) => !v); setPage(1); }}
          className={cn(
            "shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
            urgentOnly
              ? "bg-red-500 text-white shadow-sm"
              : "border border-red-200 text-red-600 hover:bg-red-50"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Urgent only
        </button>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-25" />
            <p className="text-sm font-medium">No complaints found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Files</th>
                  <th className="px-5 py-3 font-medium">Responses</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "cursor-pointer hover:bg-muted/20 transition-colors",
                      c.priority === "urgent" && "bg-red-50/30 hover:bg-red-50/50"
                    )}
                  >
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-primary">{c.reference_id}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{c.category}</td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <p className="truncate text-xs">{c.description}</p>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3.5"><PriorityBadge priority={c.priority as any} /></td>
                    <td className="px-5 py-3.5">
                      {c.attachment_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3" /> {c.attachment_count}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {c.response_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <MessageSquare className="h-3 w-3" /> {c.response_count}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.pages > 1 && (
              <div className="flex items-center justify-between border-t px-5 py-3">
                <p className="text-xs text-muted-foreground">Page {data.page} of {data.pages}</p>
                <div className="flex gap-1.5">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-muted/50">Previous</button>
                  <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-muted/50">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedId !== null && (
        <VendorComplaintDetail id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
