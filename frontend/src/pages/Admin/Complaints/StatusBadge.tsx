import { cn } from "@/lib/utils";
import type { ComplaintStatus, Priority } from "@/types/complaint";

const STATUS_CONFIG: Record<ComplaintStatus, { dot: string; label: string; ring: string; bg: string; text: string }> = {
  new:               { dot: "bg-sky-400",     label: "New",               ring: "ring-sky-200/80",    bg: "bg-sky-50",    text: "text-sky-700"    },
  in_progress:       { dot: "bg-blue-500",    label: "In Progress",       ring: "ring-blue-200/80",   bg: "bg-blue-50",   text: "text-blue-700"   },
  vendor_pending:    { dot: "bg-violet-500",  label: "Vendor Pending",    ring: "ring-violet-200/80", bg: "bg-violet-50", text: "text-violet-700" },
  awaiting_approval: { dot: "bg-amber-400",   label: "Awaiting Approval", ring: "ring-amber-200/80",  bg: "bg-amber-50",  text: "text-amber-700"  },
  escalated:         { dot: "bg-red-500",     label: "Escalated",         ring: "ring-red-200/80",    bg: "bg-red-50",    text: "text-red-700"    },
  resolved:          { dot: "bg-emerald-500", label: "Resolved",          ring: "ring-emerald-200/80",bg: "bg-emerald-50",text: "text-emerald-700"},
  closed:            { dot: "bg-gray-400",    label: "Closed",            ring: "ring-gray-200/80",   bg: "bg-gray-100",  text: "text-gray-500"   },
};

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const s = STATUS_CONFIG[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
      s.bg, s.text, s.ring
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot, status === "escalated" && "animate-pulse")} />
      {s.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "urgent") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 ring-1 ring-red-200/80">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
        Urgent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500 ring-1 ring-gray-200/80">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
      Normal
    </span>
  );
}
