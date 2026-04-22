import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

interface ApprovalOut {
  id: number;
  complaint_id: number;
  admin_id: number | null;
  admin_notes: string | null;
  admin_approved_at: string | null;
  superadmin_decision: string | null;
  status: string;
}

interface PendingItem {
  id: number;
  reference_id: string;
  category: string;
  priority: string;
  plant: string;
  submitter_name: string;
  submitter_employee_id: string;
  description: string;
  created_at: string;
  updated_at: string;
  approval: ApprovalOut | null;
}

export function AdminApprovalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuperadmin = user?.role === "superadmin";

  const { data, isLoading } = useQuery<{ items: PendingItem[]; total: number }>({
    queryKey: ["superadmin-approvals"],
    queryFn: async () => {
      const res = await api.get<{ data: { items: PendingItem[]; total: number } }>(
        "/api/superadmin/approvals"
      );
      return res.data.data;
    },
    enabled: isSuperadmin,
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["superadmin-approvals"] });
    qc.invalidateQueries({ queryKey: ["approval-count"] });
    qc.invalidateQueries({ queryKey: ["admin-complaints"] });
  };

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) =>
      api.patch(`/api/superadmin/complaints/${id}/approve`, { notes }),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) =>
      api.patch(`/api/superadmin/complaints/${id}/reject`, { notes }),
    onSuccess: invalidate,
  });

  if (!isSuperadmin) {
    return (
      <div className="p-7">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          Superadmin access required.
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Approval Queue</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${data?.total ?? 0} complaint${data?.total !== 1 ? "s" : ""} awaiting your decision`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading approvals...
        </div>
      ) : !data?.items.length ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <ApprovalCard
              key={item.id}
              item={item}
              approving={approveMutation.isPending}
              rejecting={rejectMutation.isPending}
              onApprove={(notes) => approveMutation.mutate({ id: item.id, notes })}
              onReject={(notes) => rejectMutation.mutate({ id: item.id, notes })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  item,
  approving,
  rejecting,
  onApprove,
  onReject,
}: {
  item: PendingItem;
  approving: boolean;
  rejecting: boolean;
  onApprove: (notes?: string) => void;
  onReject: (notes: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectError, setRejectError] = useState("");

  function handleApprove() {
    onApprove(approveNotes || undefined);
  }

  function handleReject() {
    if (!rejectNotes.trim()) {
      setRejectError("Please provide rejection reason.");
      return;
    }
    setRejectError("");
    onReject(rejectNotes.trim());
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-200">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold tracking-wide">{item.reference_id}</span>
              <span className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                item.priority === "urgent"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              )}>
                {item.priority}
              </span>
              <span className="inline-flex items-center rounded-full border bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 border-blue-200">
                {item.category}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">{item.plant}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.submitter_name} · {item.submitter_employee_id}
            </p>
            {item.approval?.admin_notes && (
              <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                <span className="font-semibold">Admin note:</span> {item.approval.admin_notes}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expandable description */}
      {expanded && (
        <div className="px-5 pb-4">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap bg-muted/40 rounded-lg p-3 border">
            {item.description}
          </p>
        </div>
      )}

      {/* Action area */}
      <div className="border-t bg-muted/20 px-5 py-4 space-y-3">
        {/* Approve section */}
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
            placeholder="Approval notes (optional)"
            className="flex-1 h-8 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            onClick={handleApprove}
            disabled={approving || rejecting}
          >
            {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve
          </Button>
        </div>

        {/* Reject section */}
        {!rejectOpen ? (
          <button
            onClick={() => setRejectOpen(true)}
            className="flex items-center gap-1.5 text-xs text-destructive hover:underline underline-offset-2"
          >
            <XCircle className="h-3.5 w-3.5" />
            Reject with reason
          </button>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder="Rejection reason (required)"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="text-xs min-h-[72px] resize-none"
              autoFocus
            />
            {rejectError && <p className="text-xs text-destructive">{rejectError}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs gap-1.5"
                onClick={handleReject}
                disabled={approving || rejecting}
              >
                {rejecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Confirm reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setRejectOpen(false); setRejectNotes(""); setRejectError(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
      <div>
        <p className="font-semibold text-sm">All clear</p>
        <p className="text-sm text-muted-foreground mt-0.5">No complaints are awaiting your approval.</p>
      </div>
    </div>
  );
}
