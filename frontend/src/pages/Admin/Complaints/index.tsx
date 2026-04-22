import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Paperclip, Download, Inbox, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { ComplaintDetail } from "./ComplaintDetail";
import type { ComplaintsListResponse, ComplaintListItem } from "@/types/admin";
import type { ComplaintStatus, Category, Priority } from "@/types/complaint";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_TABS: { value: ComplaintStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "vendor_pending", label: "Vendor" },
  { value: "awaiting_approval", label: "Approval" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const CATEGORIES: { value: Category | ""; label: string }[] = [
  { value: "", label: "All Categories" },
  { value: "Canteen", label: "Canteen" },
  { value: "Locker", label: "Locker" },
  { value: "ESD", label: "ESD" },
  { value: "Transportation", label: "Transportation" },
];

// Category: dot colour only — no icon boxes, no borders
const CAT_DOT: Record<string, string> = {
  Canteen: "bg-orange-400",
  Locker: "bg-blue-400",
  ESD: "bg-yellow-400",
  Transportation: "bg-teal-400",
};

// Status: single source of truth for colour + label
const STATUS: Record<ComplaintStatus, { color: string; label: string }> = {
  new:               { color: "text-sky-600 bg-sky-50 ring-sky-200/60",       label: "New"               },
  in_progress:       { color: "text-blue-600 bg-blue-50 ring-blue-200/60",    label: "In Progress"       },
  vendor_pending:    { color: "text-violet-600 bg-violet-50 ring-violet-200/60", label: "Vendor Pending" },
  awaiting_approval: { color: "text-amber-600 bg-amber-50 ring-amber-200/60", label: "Awaiting Approval" },
  escalated:         { color: "text-red-600 bg-red-50 ring-red-200/60",       label: "Escalated"         },
  resolved:          { color: "text-emerald-600 bg-emerald-50 ring-emerald-200/60", label: "Resolved"    },
  closed:            { color: "text-gray-500 bg-gray-100 ring-gray-200/60",   label: "Closed"            },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

// ── Page ───────────────────────────────────────────────────────────────────

export function AdminComplaintsPage({ initialPriority = "" }: { initialPriority?: Priority | "" } = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">(initialPriority);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const res = await api.get(`/api/admin/complaints/export?${params}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `complaints_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const { data, isLoading } = useQuery<ComplaintsListResponse>({
    queryKey: ["admin-complaints", page, search, statusFilter, categoryFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const res = await api.get<{ data: ComplaintsListResponse }>(`/api/admin/complaints?${params}`);
      return res.data.data;
    },
    staleTime: 30_000,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="shrink-0 border-b bg-white px-8 pt-7 pb-0">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Complaints</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data ? `${data.total} total` : "—"}
              {priorityFilter === "urgent" && " · urgent only"}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mb-0.5 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </button>
        </div>

        {/* Underline tabs */}
        <div className="flex gap-0 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value as ComplaintStatus | ""); setPage(1); }}
              className={cn(
                "shrink-0 px-4 py-2.5 text-sm border-b-2 transition-colors duration-150",
                statusFilter === tab.value
                  ? "border-foreground text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground font-medium"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="shrink-0 bg-white border-b px-8 py-3 flex items-center gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search name, ID, reference, description..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as Category | ""); setPage(1); }}
            className="h-9 rounded-lg border bg-white px-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value as Priority | ""); setPage(1); }}
            className="h-9 rounded-lg border bg-white px-3 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Priority</option>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-auto bg-[#F7F8FA] px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2.5 py-32 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white border">
              <Inbox className="h-5 w-5 opacity-30" />
            </div>
            <p className="text-sm font-medium">No complaints found</p>
            <p className="text-xs opacity-50 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            {/* Column header */}
            <div className="mb-2 flex items-center px-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              <span className="flex-1">Complaint</span>
              <span className="w-36 text-right">Submitter</span>
              <span className="w-36 text-right">Status</span>
              <span className="w-20 text-right">Time</span>
            </div>

            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              {data.items.map((c, i) => (
                <ComplaintRow
                  key={c.id}
                  complaint={c}
                  isLast={i === data.items.length - 1}
                  onClick={() => setSelectedId(c.id)}
                />
              ))}
            </div>

            {data.pages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {data.page} of {data.pages} · {data.total} results
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border bg-white px-4 py-1.5 text-xs font-medium shadow-sm disabled:opacity-40 hover:bg-muted/40 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === data.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border bg-white px-4 py-1.5 text-xs font-medium shadow-sm disabled:opacity-40 hover:bg-muted/40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selectedId !== null && (
        <ComplaintDetail id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────

function ComplaintRow({
  complaint: c,
  isLast,
  onClick,
}: {
  complaint: ComplaintListItem;
  isLast: boolean;
  onClick: () => void;
}) {
  const st = STATUS[c.status];
  const isUrgent = c.priority === "urgent";
  const dotColor = CAT_DOT[c.category] ?? "bg-gray-300";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/80 group",
        !isLast && "border-b border-border/50",
        isUrgent && "bg-red-50/30 hover:bg-red-50/50",
      )}
    >
      {/* Category dot */}
      <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", dotColor)} />

      {/* Main — description + meta */}
      <div className="flex-1 min-w-0 pr-4">
        {/* Description — the thing admins actually read */}
        <p className={cn(
          "text-[14px] leading-snug line-clamp-2 mb-1",
          isUrgent ? "font-semibold text-foreground" : "font-medium text-foreground"
        )}>
          {c.description}
        </p>
        {/* Sub-line: classification + ref + plant */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {c.ai_classification ? (
            <span className="font-medium text-foreground/60 truncate max-w-[200px]">{c.ai_classification}</span>
          ) : (
            <span className="text-foreground/40">{c.category}</span>
          )}
          <span className="opacity-30">·</span>
          <span className="font-mono opacity-50">{c.reference_id}</span>
          <span className="opacity-30">·</span>
          <span>Plant {c.plant}</span>
          {isUrgent && (
            <>
              <span className="opacity-30">·</span>
              <span className="font-semibold text-red-500">Urgent</span>
            </>
          )}
          {c.attachment_count > 0 && (
            <>
              <span className="opacity-30">·</span>
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />{c.attachment_count}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Submitter */}
      <div className="w-36 shrink-0 text-right">
        <p className="text-sm font-medium text-foreground/80 truncate">{c.submitter_name.split(" ")[0]}&nbsp;{c.submitter_name.split(" ").slice(-1)[0]}</p>
        <p className="text-xs text-muted-foreground">{c.submitter_employee_id}</p>
      </div>

      {/* Status */}
      <div className="w-36 shrink-0 flex justify-end">
        <span className={cn(
          "inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
          st.color,
        )}>
          {st.label}
        </span>
      </div>

      {/* Time */}
      <div className="w-20 shrink-0 text-right">
        <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 opacity-50" />
          {timeAgo(c.created_at)}
        </span>
      </div>
    </button>
  );
}
