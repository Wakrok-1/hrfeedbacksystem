import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, Paperclip, MessageSquare, ArrowLeft, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "@/pages/Admin/Complaints/StatusBadge";
import type { ComplaintStatus, Priority } from "@/types/complaint";
import { Button } from "@/components/ui/button";

interface CasePreviewData {
  id: number;
  reference_id: string;
  category: string;
  status: ComplaintStatus;
  priority: Priority;
  plant: string;
  description: string;
  created_at: string;
  updated_at: string;
  attachments: { file_name: string; file_url: string; file_type: string; file_size_mb: number }[];
  responses: { id: number; details: Record<string, unknown>; created_at: string }[];
}

async function fetchCasePreview(caseId: string): Promise<CasePreviewData> {
  const res = await api.get<{ success: boolean; data: CasePreviewData }>(
    `/api/vendor/case-preview/${caseId}`
  );
  return res.data.data;
}

export function VendorCasePreviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vendor-case-preview", caseId],
    queryFn: () => fetchCasePreview(caseId!),
    enabled: !!caseId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    const isAuthError = msg?.toLowerCase().includes("token");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">
          {isAuthError ? "Session Expired" : "Case Not Found"}
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          {isAuthError
            ? "Your trusted device session has expired. Please log in again to continue."
            : "This case could not be found or is not assigned to you."}
        </p>
        {isAuthError && (
          <Button onClick={() => navigate("/login")}>Log in</Button>
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/vendor")}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to portal
        </button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{data.reference_id}</p>
            <h1 className="text-xl font-bold mt-0.5">{data.category} Complaint</h1>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={data.priority} />
            <StatusBadge status={data.status} />
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="rounded-xl border bg-white p-5 space-y-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Details</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Plant</p>
            <p className="font-medium">{data.plant}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="font-medium">
              {new Date(data.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Description</p>
          <p className="text-sm leading-relaxed rounded-lg bg-muted/30 p-3 border">{data.description}</p>
        </div>
      </div>

      {/* Attachments */}
      {data.attachments.length > 0 && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Attachments ({data.attachments.length})
          </p>
          <div className="space-y-2">
            {data.attachments.map((a, i) => (
              <a
                key={i}
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                <span className="flex-1 truncate font-medium">{a.file_name}</span>
                <span className="text-xs text-muted-foreground">{a.file_size_mb.toFixed(2)} MB</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Your responses */}
      {data.responses.length > 0 && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your Responses ({data.responses.length})
          </p>
          <div className="space-y-3">
            {data.responses.map((r) => (
              <div key={r.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">Response submitted</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm">{String(r.details?.response ?? "")}</p>
                {r.details?.action_taken && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="font-medium">Action taken:</span> {String(r.details.action_taken)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved notice */}
      {["resolved", "closed"].includes(data.status) && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          This case has been {data.status}. No further action required.
        </div>
      )}

      {/* Go to full portal */}
      <div className="text-center">
        <Button variant="outline" onClick={() => navigate("/vendor")}>
          Go to Vendor Portal
        </Button>
      </div>
    </div>
  );
}
