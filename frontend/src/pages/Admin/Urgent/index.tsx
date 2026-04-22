import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, AlertTriangle, Clock, Flame, ShieldAlert,
  ArrowRight, UserCheck, MessageSquare, PhoneCall, CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { ComplaintDetail } from "@/pages/Admin/Complaints/ComplaintDetail";
import { StatusBadge } from "@/pages/Admin/Complaints/StatusBadge";
import type { ComplaintsListResponse, ComplaintListItem } from "@/types/admin";
import type { ComplaintStatus } from "@/types/complaint";
import { cn } from "@/lib/utils";

const SLA_HOURS = 72;

type UrgencyLevel = "overdue-critical" | "overdue-high" | "overdue-low" | "warning" | "ok";

function getUrgency(createdAt: string): {
  level: UrgencyLevel;
  hoursElapsed: number;
  label: string;
  timeDisplay: string;
  pct: number;
} {
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  const remaining = SLA_HOURS - elapsed;
  const pct = Math.min(Math.round((elapsed / SLA_HOURS) * 100), 100);

  if (remaining <= 0) {
    const over = Math.abs(remaining);
    const level: UrgencyLevel =
      over > 72 ? "overdue-critical" : over > 24 ? "overdue-high" : "overdue-low";
    return { level, hoursElapsed: elapsed, label: "OVERDUE", timeDisplay: formatDuration(over), pct };
  }

  return {
    level: remaining < 12 ? "warning" : "ok",
    hoursElapsed: elapsed,
    label: "REMAINING",
    timeDisplay: formatDuration(remaining),
    pct,
  };
}

function formatDuration(hours: number): string {
  if (hours >= 24) {
    const d = Math.floor(hours / 24);
    const h = Math.floor(hours % 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// What the admin should do next — per status
type NextAction = { label: string; icon: React.ReactNode; style: string };

function getNextAction(status: ComplaintStatus): NextAction {
  switch (status) {
    case "new":
      return {
        label: "Assign vendor & open case",
        icon: <UserCheck className="h-3.5 w-3.5" />,
        style: "bg-sky-50 text-sky-700 border-sky-200",
      };
    case "in_progress":
      return {
        label: "Send progress update to employee",
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        style: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "vendor_pending":
      return {
        label: "Follow up — vendor has not responded",
        icon: <PhoneCall className="h-3.5 w-3.5" />,
        style: "bg-violet-50 text-violet-700 border-violet-200",
      };
    case "escalated":
      return {
        label: "Escalated — review and reassign",
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        style: "bg-red-50 text-red-700 border-red-200",
      };
    case "awaiting_approval":
      return {
        label: "Pending superadmin approval",
        icon: <Clock className="h-3.5 w-3.5" />,
        style: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "resolved":
    case "closed":
      return {
        label: "Resolved — no action needed",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        style: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    default:
      return {
        label: "Review complaint",
        icon: <ArrowRight className="h-3.5 w-3.5" />,
        style: "bg-gray-50 text-gray-600 border-gray-200",
      };
  }
}

const URGENCY_STYLES: Record<UrgencyLevel, {
  badge: string; bar: string; cardBorder: string; text: string; groupLabel: string; groupDot: string;
}> = {
  "overdue-critical": {
    badge: "bg-red-600 text-white",
    bar: "bg-red-500",
    cardBorder: "border-red-200 border-l-red-500",
    text: "text-red-700",
    groupLabel: "Critical — severely overdue",
    groupDot: "bg-red-500",
  },
  "overdue-high": {
    badge: "bg-orange-500 text-white",
    bar: "bg-orange-400",
    cardBorder: "border-orange-200 border-l-orange-400",
    text: "text-orange-700",
    groupLabel: "High — overdue 24–72h",
    groupDot: "bg-orange-400",
  },
  "overdue-low": {
    badge: "bg-amber-500 text-white",
    bar: "bg-amber-400",
    cardBorder: "border-amber-200 border-l-amber-400",
    text: "text-amber-700",
    groupLabel: "Overdue — just past SLA",
    groupDot: "bg-amber-400",
  },
  "warning": {
    badge: "bg-yellow-500 text-white",
    bar: "bg-yellow-400",
    cardBorder: "border-yellow-200 border-l-yellow-400",
    text: "text-yellow-700",
    groupLabel: "Due soon — under 12h left",
    groupDot: "bg-yellow-400",
  },
  "ok": {
    badge: "bg-blue-500 text-white",
    bar: "bg-blue-400",
    cardBorder: "border-border border-l-blue-300",
    text: "text-blue-700",
    groupLabel: "Within SLA",
    groupDot: "bg-blue-400",
  },
};

const URGENCY_ORDER: UrgencyLevel[] = [
  "overdue-critical", "overdue-high", "overdue-low", "warning", "ok",
];

// ── Page ───────────────────────────────────────────────────────────────────

export function AdminUrgentPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<ComplaintsListResponse>({
    queryKey: ["admin-complaints-urgent"],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", page_size: "100", priority: "urgent" });
      const res = await api.get<{ data: ComplaintsListResponse }>(`/api/admin/complaints?${params}`);
      return res.data.data;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const sorted = [...(data?.items ?? [])].sort((a, b) =>
    getUrgency(b.created_at).hoursElapsed - getUrgency(a.created_at).hoursElapsed
  );

  // Group by urgency level in priority order
  const groups = URGENCY_ORDER
    .map((level) => ({
      level,
      items: sorted.filter((c) => getUrgency(c.created_at).level === level),
    }))
    .filter((g) => g.items.length > 0);

  const overdueCount = sorted.filter((c) => getUrgency(c.created_at).level.startsWith("overdue")).length;
  const criticalCount = sorted.filter((c) => getUrgency(c.created_at).level === "overdue-critical").length;
  const activeCount = sorted.filter((c) => ["new", "in_progress", "vendor_pending"].includes(c.status)).length;
  const needsVendor = sorted.filter((c) => c.status === "new").length;

  return (
    <div className="flex flex-col h-full bg-[#F7F8FA]">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b">
        <div className="px-8 pt-7 pb-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
              <Flame className="h-4 w-4 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Urgent Complaints</h1>
            {!isLoading && data && (
              <span className="ml-1 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-bold text-red-600">
                {data.total}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            72-hour SLA per case. Sorted by most overdue — act on critical cases first.
          </p>
        </div>

        {!isLoading && data && (
          <div className="grid grid-cols-4 border-t divide-x">
            <StatCell
              value={overdueCount}
              label="Past SLA"
              sub="need immediate action"
              icon={<AlertTriangle className="h-4 w-4" />}
              color="text-red-600"
              bg="bg-red-50"
            />
            <StatCell
              value={criticalCount}
              label="Critical"
              sub=">72h overdue"
              icon={<Flame className="h-4 w-4" />}
              color="text-red-600"
              bg="bg-red-50"
            />
            <StatCell
              value={needsVendor}
              label="Unassigned"
              sub="no vendor yet"
              icon={<UserCheck className="h-4 w-4" />}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <StatCell
              value={activeCount}
              label="Active cases"
              sub="in progress"
              icon={<Clock className="h-4 w-4" />}
              color="text-blue-600"
              bg="bg-blue-50"
            />
          </div>
        )}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-32 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading urgent complaints...</span>
          </div>
        ) : !sorted.length ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100">
              <ShieldAlert className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">All clear</p>
            <p className="text-xs mt-1 opacity-60">No urgent complaints right now</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(({ level, items }) => {
              const styles = URGENCY_STYLES[level];
              return (
                <div key={level}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", styles.groupDot)} />
                    <p className={cn("text-xs font-semibold uppercase tracking-widest", styles.text)}>
                      {styles.groupLabel}
                    </p>
                    <span className={cn("ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold", styles.badge)}>
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((c) => (
                      <UrgentCard
                        key={c.id}
                        complaint={c}
                        onClick={() => setSelectedId(c.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedId !== null && (
        <ComplaintDetail id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ── Stat cell ──────────────────────────────────────────────────────────────

function StatCell({ value, label, sub, icon, color, bg }: {
  value: number; label: string; sub: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-4">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bg, color)}>
        {icon}
      </div>
      <div>
        <p className={cn("text-2xl font-bold leading-none", color)}>{value}</p>
        <p className="text-xs font-medium text-foreground/70 mt-0.5">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

// ── Urgent card ────────────────────────────────────────────────────────────

function UrgentCard({ complaint: c, onClick }: { complaint: ComplaintListItem; onClick: () => void }) {
  const urg = getUrgency(c.created_at);
  const styles = URGENCY_STYLES[urg.level];
  const isOverdue = urg.level.startsWith("overdue");
  const nextAction = getNextAction(c.status);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-xl border border-l-[4px] bg-white overflow-hidden",
        "transition-all duration-150 hover:shadow-md hover:-translate-y-px cursor-pointer",
        styles.cardBorder,
      )}
    >
      {/* SLA bar */}
      <div className="h-1 w-full bg-muted/40">
        <div className={cn("h-full transition-all", styles.bar)} style={{ width: `${urg.pct}%` }} />
      </div>

      <div className="px-5 py-4">
        {/* Top row: time badge + description + status */}
        <div className="flex items-start gap-4">
          {/* Time badge */}
          <div className={cn("shrink-0 rounded-xl px-3.5 py-3 text-center min-w-[76px]", styles.badge)}>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-0.5">
              {urg.label}
            </p>
            <p className="text-[22px] font-extrabold leading-none tracking-tight">
              {urg.timeDisplay.split(" ")[0]}
            </p>
            {urg.timeDisplay.split(" ")[1] && (
              <p className="text-xs font-semibold opacity-80 mt-0.5">
                {urg.timeDisplay.split(" ")[1]}
              </p>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[14px] font-semibold text-foreground leading-snug line-clamp-2 mb-1.5">
              {c.description}
            </p>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {c.ai_classification && (
                <span className="font-medium text-foreground/60">{c.ai_classification}</span>
              )}
              {c.ai_classification && <span className="opacity-30">·</span>}
              <span className="font-mono opacity-50">{c.reference_id}</span>
              <span className="opacity-30">·</span>
              <span>{c.category}</span>
              <span className="opacity-30">·</span>
              <span>{c.submitter_name}</span>
              <span className="opacity-30">·</span>
              <span>Plant {c.plant}</span>
            </div>
          </div>

          {/* Status */}
          <div className="shrink-0 pt-0.5">
            <StatusBadge status={c.status} />
          </div>
        </div>

        {/* Bottom action strip */}
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <div className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
            nextAction.style,
          )}>
            {nextAction.icon}
            {nextAction.label}
          </div>
          <div className={cn(
            "flex items-center gap-1 text-xs font-semibold transition-all",
            "opacity-0 group-hover:opacity-100",
            isOverdue ? "text-red-500" : "text-muted-foreground",
          )}>
            Open case <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
}
