import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Paperclip, Loader2, ChevronRight, UserCheck, SendHorizonal, Send, CheckCircle2, Building2, Languages, Sparkles, Brain, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import type { ComplaintDetail as ComplaintDetailType } from "@/types/admin";
import type { ComplaintStatus, Priority } from "@/types/complaint";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface Vendor { id: number; full_name: string; email: string; plant: string; }

interface Props {
  id: number;
  onClose: () => void;
}

const STATUSES: ComplaintStatus[] = [
  "new", "in_progress", "vendor_pending", "escalated", "resolved", "closed",
];

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  vendor_pending: "Vendor Pending",
  awaiting_approval: "Awaiting Approval",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

const ACTION_LABELS: Record<string, string> = {
  complaint_submitted: "Complaint submitted",
  status_changed: "Status changed",
  priority_changed: "Priority changed",
  note_added: "Note added",
  vendor_assigned: "Vendor assigned",
  submitted_for_approval: "Submitted for superadmin approval",
  superadmin_approved: "Approved by superadmin",
  superadmin_rejected: "Rejected by superadmin",
  admin_replied: "Reply sent to employee",
};

function formatActivityDetail(log: ComplaintDetailType["audit_logs"][0]) {
  if (!log.details) return null;
  if (log.action === "status_changed") return `${log.details.from} → ${log.details.to}`;
  if (log.action === "note_added") return String(log.details.note);
  if (log.action === "priority_changed") return `Marked as ${log.details.to}`;
  if (log.action === "submitted_for_approval") return log.details.notes ? `Notes: ${log.details.notes}` : null;
  if (log.action === "superadmin_approved") return log.details.notes ? `Notes: ${log.details.notes}` : null;
  if (log.action === "superadmin_rejected") return log.details.notes ? `Reason: ${log.details.notes}` : null;
  return null;
}

export function ComplaintDetail({ id, onClose }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showApprovalForm, setShowApprovalForm] = useState(false);

  const { data, isLoading } = useQuery<ComplaintDetailType>({
    queryKey: ["complaint", id],
    queryFn: async () => {
      const res = await api.get<{ data: ComplaintDetailType }>(`/api/admin/complaints/${id}`);
      return res.data.data;
    },
    staleTime: 15_000,
  });

  const statusMutation = useMutation({
    mutationFn: (status: ComplaintStatus) =>
      api.patch(`/api/admin/complaints/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaint", id] });
      qc.invalidateQueries({ queryKey: ["admin-complaints"] });
    },
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: Priority) =>
      api.patch(`/api/admin/complaints/${id}/priority`, { priority }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaint", id] });
      qc.invalidateQueries({ queryKey: ["admin-complaints"] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/admin/complaints/${id}/note`, { content }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["complaint", id] });
    },
  });

  const assignVendorMutation = useMutation({
    mutationFn: (vendor_id: number | null) =>
      api.patch(`/api/admin/complaints/${id}/assign-vendor`, { vendor_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaint", id] });
      qc.invalidateQueries({ queryKey: ["admin-complaints"] });
    },
  });

  const submitApprovalMutation = useMutation({
    mutationFn: (notes: string | undefined) =>
      api.post(`/api/admin/complaints/${id}/submit-approval`, { notes }),
    onSuccess: () => {
      setShowApprovalForm(false);
      setApprovalNotes("");
      qc.invalidateQueries({ queryKey: ["complaint", id] });
      qc.invalidateQueries({ queryKey: ["admin-complaints"] });
      qc.invalidateQueries({ queryKey: ["approval-count"] });
    },
  });

  const autoOpenMutation = useMutation({
    mutationFn: () => api.patch(`/api/admin/complaints/${id}/auto-open`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["complaint", id] });
      qc.invalidateQueries({ queryKey: ["admin-complaints"] });
    },
  });

  // Auto-open when complaint is "new"
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (data?.status === "new" && prevStatusRef.current !== "new") {
      autoOpenMutation.mutate();
    }
    if (data) prevStatusRef.current = data.status;
  }, [data?.status]);

  const [replyContent, setReplyContent] = useState("");
  const [replySent, setReplySent] = useState(false);

  const replyMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/admin/complaints/${id}/reply`, { content }),
    onSuccess: () => {
      setReplyContent("");
      setReplySent(true);
      qc.invalidateQueries({ queryKey: ["complaint", id] });
      setTimeout(() => setReplySent(false), 4000);
    },
  });

  // Translation
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translateMeta, setTranslateMeta] = useState<{ detected: string; target: string } | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const translateMutation = useMutation({
    mutationFn: async (target: "en" | "ms") => {
      const res = await api.post<{ data: { detected_lang: string; translated: string } }>(
        `/api/admin/complaints/${id}/translate`, { target }
      );
      return { ...res.data.data, target };
    },
    onSuccess: (d) => {
      setTranslatedText(d.translated);
      setTranslateMeta({ detected: d.detected_lang, target: d.target });
      setTranslateError(null);
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setTranslateError(e.response?.data?.detail ?? "Translation failed");
    },
  });

  // AI Explain
  type AIExplain = { summary: string; key_issue: string; severity_reason: string; suggested_action: string };
  const [aiExplain, setAiExplain] = useState<AIExplain | null>(null);
  const [aiExplainError, setAiExplainError] = useState<string | null>(null);

  const aiExplainMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get<{ data: AIExplain }>(`/api/admin/complaints/${id}/ai-explain`);
      return res.data.data;
    },
    onSuccess: (d) => { setAiExplain(d); setAiExplainError(null); },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setAiExplainError(e.response?.data?.detail ?? "Analysis failed");
    },
  });

  // AI Draft reply
  const [aiDraftError, setAiDraftError] = useState<string | null>(null);

  const aiDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { draft: string } }>(`/api/admin/complaints/${id}/ai-draft`, {});
      return res.data.data.draft;
    },
    onSuccess: (draft) => { setReplyContent(draft); setAiDraftError(null); },
    onError: (e: { response?: { data?: { detail?: string } } }) => {
      setAiDraftError(e.response?.data?.detail ?? "Draft generation failed");
    },
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: async () => {
      const res = await api.get<{ data: Vendor[] }>("/api/admin/vendors");
      return res.data.data;
    },
    staleTime: 300_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-start justify-between px-7 py-5 border-b bg-white">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground/60 tracking-wide">{data?.reference_id ?? "…"}</span>
              {data && <StatusBadge status={data.status} />}
              {data && <PriorityBadge priority={data.priority} />}
            </div>
            <h2 className="mt-1.5 text-base font-semibold text-foreground">
              {data?.category ?? "…"} Complaint
              {data?.ai_classification && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">— {data.ai_classification}</span>
              )}
            </h2>
            {data && (
              <p className="mt-1 text-xs text-muted-foreground">
                {data.submitter_name}
                <span className="mx-1.5 opacity-40">·</span>
                {data.submitter_employee_id}
                <span className="mx-1.5 opacity-40">·</span>
                Plant {data.plant}
                <span className="mx-1.5 opacity-40">·</span>
                {new Date(data.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : data ? (
          <div className="flex flex-1 overflow-hidden">

            {/* Left — main content */}
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-7 py-6">

              {/* Contact details — compact, only if email/phone present */}
              {(data.submitter_email || data.submitter_phone) && (
                <div className="flex items-center gap-4 rounded-xl bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  {data.submitter_email && <span>{data.submitter_email}</span>}
                  {data.submitter_phone && <span>{data.submitter_phone}</span>}
                </div>
              )}

              {/* Description */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Complaint</p>
                <div className="rounded-xl border bg-slate-50 px-5 py-4 text-[14px] leading-relaxed text-foreground">
                  {translatedText ?? data.description}
                </div>

                {/* Translation toolbar */}
                <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-0.5 rounded-lg border bg-white p-0.5 shadow-sm">
                    <button
                      onClick={() => { setTranslatedText(null); setTranslateMeta(null); }}
                      className={cn(
                        "rounded-md px-3 py-1 text-[11px] font-medium transition-all",
                        !translateMeta ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => translateMutation.mutate("en")}
                      disabled={translateMutation.isPending}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium transition-all disabled:opacity-60",
                        translateMeta?.target === "en" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {translateMutation.isPending && translateMeta?.target === "en"
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Languages className="h-3 w-3" />}
                      EN
                    </button>
                    <button
                      onClick={() => translateMutation.mutate("ms")}
                      disabled={translateMutation.isPending}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium transition-all disabled:opacity-60",
                        translateMeta?.target === "ms" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {translateMutation.isPending && translateMeta?.target === "ms"
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Languages className="h-3 w-3" />}
                      BM
                    </button>
                  </div>
                  {translateMutation.isPending && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Translating...
                    </span>
                  )}
                  {translateMeta && !translateMutation.isPending && (
                    <span className="text-[11px] text-muted-foreground">
                      Detected: {translateMeta.detected === "ms" ? "BM" : translateMeta.detected.toUpperCase()}
                    </span>
                  )}
                </div>
                {translateError && (
                  <p className="mt-1.5 text-[11px] text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {translateError}
                  </p>
                )}
              </section>

              {/* AI Insight */}
              <section>
                {!aiExplain && !aiExplainMutation.isPending && !aiExplainError && (
                  <button
                    onClick={() => aiExplainMutation.mutate()}
                    className="group w-full flex items-center gap-4 rounded-xl border border-dashed border-violet-200 bg-violet-50/30 px-5 py-4 text-left transition-all hover:border-violet-300 hover:bg-violet-50/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 group-hover:bg-violet-200 transition-colors">
                      <Brain className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">AI Insight</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Get an AI-powered analysis of this complaint</p>
                    </div>
                    <Sparkles className="ml-auto h-4 w-4 text-violet-300 group-hover:text-violet-500 transition-colors" />
                  </button>
                )}

                {aiExplainMutation.isPending && (
                  <div className="flex items-center gap-4 rounded-xl border border-violet-200 bg-violet-50/50 px-5 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                      <Loader2 className="h-4 w-4 text-violet-600 animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-violet-700">Analysing complaint...</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Llama 3.3 is reading the details</p>
                    </div>
                  </div>
                )}

                {aiExplainError && !aiExplain && (
                  <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{aiExplainError}</span>
                    <button onClick={() => { setAiExplainError(null); }} className="text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors">Dismiss</button>
                  </div>
                )}

                {aiExplain && (
                  <div className="rounded-xl border border-violet-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50 border-b border-violet-100">
                      <div className="flex items-center gap-2">
                        <Brain className="h-3.5 w-3.5 text-violet-600" />
                        <span className="text-xs font-semibold text-violet-700">AI Insight</span>
                        <span className="text-[10px] bg-violet-100 text-violet-500 rounded-full px-2 py-0.5 font-medium">Llama 3.3</span>
                      </div>
                      <button
                        onClick={() => setAiExplain(null)}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                    <div className="p-4 space-y-3 bg-white">
                      <p className="text-[14px] text-foreground leading-relaxed">{aiExplain.summary}</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-lg bg-slate-50 border px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Root Issue</p>
                          <p className="font-medium text-xs text-foreground leading-snug">{aiExplain.key_issue}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 border px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Severity</p>
                          <p className="text-xs text-foreground leading-snug">{aiExplain.severity_reason}</p>
                        </div>
                      </div>
                      {aiExplain.suggested_action && (
                        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-1">Suggested Action</p>
                          <p className="text-xs text-foreground">{aiExplain.suggested_action}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Attachments */}
              {data.attachments.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Attachments ({data.attachments.length})
                  </p>
                  <div className="space-y-2">
                    {data.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:border-primary hover:bg-primary/5 transition-all group"
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                        <span className="flex-1 truncate font-medium">{a.file_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{a.file_size_mb.toFixed(2)} MB</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Vendor Responses */}
              {data.audit_logs.filter(l => l.action === "vendor_response").length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Vendor Responses ({data.audit_logs.filter(l => l.action === "vendor_response").length})
                  </p>
                  <div className="space-y-3">
                    {data.audit_logs
                      .filter(l => l.action === "vendor_response")
                      .map(log => (
                        <div key={log.id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="h-3.5 w-3.5 text-violet-600" />
                            <span className="text-xs font-semibold text-violet-700">
                              {String(log.details?.by ?? "Vendor")}
                            </span>
                            <span className="ml-auto text-[11px] text-muted-foreground">
                              {new Date(log.created_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{String(log.details?.response ?? "")}</p>
                          {log.details?.action_taken != null && (
                            <p className="mt-2 text-xs bg-white rounded-md px-2.5 py-1.5 border text-muted-foreground">
                              <span className="font-semibold text-foreground">Action taken:</span> {String(log.details.action_taken as string)}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Add note */}
              <section>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Internal Note</p>
                <Textarea
                  rows={3}
                  placeholder="Add an internal note visible only to admins..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="resize-none text-sm"
                />
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={!note.trim() || noteMutation.isPending}
                  onClick={() => noteMutation.mutate(note.trim())}
                >
                  {noteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Note"}
                </Button>
              </section>

              {/* Reply to User */}
              <section>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Reply to Employee</p>
                <div className="rounded-xl border bg-white p-4 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This reply will be visible to the employee on their tracking page.
                  </p>

                  {/* AI Draft CTA — shown when textarea is empty and not loading */}
                  {!replyContent && !aiDraftMutation.isPending && (
                    <button
                      onClick={() => aiDraftMutation.mutate()}
                      disabled={aiDraftMutation.isPending}
                      className="group w-full flex items-center gap-3 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-4 py-3 text-left transition-all hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 group-hover:bg-amber-200 transition-colors">
                        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Generate with AI</p>
                        <p className="text-[11px] text-muted-foreground">Draft a professional reply in seconds</p>
                      </div>
                    </button>
                  )}

                  {aiDraftMutation.isPending && (
                    <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                      <Loader2 className="h-4 w-4 text-amber-600 animate-spin shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Generating reply draft...</p>
                        <p className="text-[11px] text-muted-foreground">AI is crafting a professional response</p>
                      </div>
                    </div>
                  )}

                  {aiDraftError && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {aiDraftError}
                    </div>
                  )}

                  {replyContent && (
                    <div className="flex items-center justify-between">
                      {aiDraftMutation.isSuccess && (
                        <span className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
                          <Sparkles className="h-3 w-3" /> AI Generated — edit before sending
                        </span>
                      )}
                      <button
                        onClick={() => aiDraftMutation.mutate()}
                        disabled={aiDraftMutation.isPending}
                        className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-amber-600 transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3" /> Regenerate
                      </button>
                    </div>
                  )}

                  <Textarea
                    rows={4}
                    placeholder="Write your response... or use AI to generate a draft above."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="resize-none text-sm"
                  />

                  {replySent ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Reply sent — employee can see it on the tracking page.
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      disabled={!replyContent.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate(replyContent.trim())}
                    >
                      {replyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Reply to Employee
                    </Button>
                  )}
                </div>
              </section>

              {/* Activity */}
              {data.audit_logs.length > 0 && (
                <section>
                  <p className="mb-3 text-xs font-semibold text-muted-foreground">Activity</p>
                  <div className="space-y-3">
                    {[...data.audit_logs].reverse().map((log) => {
                      const detail = formatActivityDetail(log);
                      return (
                        <div key={log.id} className="flex gap-3">
                          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                          <div>
                            <p className="text-sm font-medium">{ACTION_LABELS[log.action] ?? log.action}</p>
                            {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                              {new Date(log.created_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Right — actions panel */}
            <div className="w-56 shrink-0 space-y-5 border-l bg-[#F8F9FB] px-5 py-6 overflow-y-auto">

              {/* Status */}
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Change Status</p>
                <div className="space-y-1">
                  {STATUSES.filter((s) => s !== data.status).map((s) => (
                    <button
                      key={s}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate(s)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-xs font-medium transition-all",
                        "hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                      )}
                    >
                      {STATUS_LABELS[s]}
                      <ChevronRight className="h-3 w-3 opacity-40" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Priority</p>
                <div className="mb-2"><PriorityBadge priority={data.priority} /></div>
                <button
                  disabled={priorityMutation.isPending}
                  onClick={() => priorityMutation.mutate(data.priority === "urgent" ? "normal" : "urgent")}
                  className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs font-medium hover:border-primary hover:bg-primary/5 hover:text-primary transition-all disabled:opacity-50"
                >
                  Mark as {data.priority === "urgent" ? "Normal" : "Urgent"}
                  <ChevronRight className="h-3 w-3 opacity-40" />
                </button>
              </div>

              {/* AI Analysis */}
              {(data.ai_classification || data.ai_priority || data.ai_sentiment != null) && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">AI Analysis</p>
                  <div className="rounded-lg border bg-white p-3 space-y-2.5 text-xs">
                    {data.ai_classification && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">Classification</p>
                        <p className="font-medium leading-snug">{data.ai_classification}</p>
                      </div>
                    )}
                    {data.ai_priority && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">AI Priority</p>
                        <span className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                          data.ai_priority === "urgent"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        )}>
                          {data.ai_priority}
                        </span>
                      </div>
                    )}
                    {data.ai_sentiment != null && (() => {
                      const s = data.ai_sentiment;
                      const pct = Math.round(((s + 1) / 2) * 100);
                      const label = s < -0.5 ? "Very Distressed" : s < -0.2 ? "Frustrated" : s < 0 ? "Unhappy" : "Neutral";
                      const barColor = s < -0.5 ? "bg-red-400" : s < -0.2 ? "bg-orange-400" : s < 0 ? "bg-amber-400" : "bg-emerald-400";
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-muted-foreground">Sentiment</p>
                            <p className="font-medium">{label}</p>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Assign Vendor */}
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  <span className="flex items-center gap-1.5"><UserCheck className="h-3 w-3" /> Assign Vendor</span>
                </p>
                {vendors?.length ? (
                  <div className="space-y-1">
                    {vendors.map((v) => (
                      <button
                        key={v.id}
                        disabled={assignVendorMutation.isPending || data.assigned_vendor_id === v.id}
                        onClick={() => assignVendorMutation.mutate(v.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all",
                          data.assigned_vendor_id === v.id
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "bg-white hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                        )}
                      >
                        <span>{v.full_name}</span>
                        {data.assigned_vendor_id === v.id && <span className="text-[10px]">Assigned</span>}
                      </button>
                    ))}
                    {data.assigned_vendor_id && (
                      <button
                        disabled={assignVendorMutation.isPending}
                        onClick={() => assignVendorMutation.mutate(null)}
                        className="w-full rounded-lg border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        Remove vendor
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No vendors available</p>
                )}
              </div>

              {/* Submit for Approval — shown to admins when complaint is actionable */}
              {user?.role === "admin" && data && !["awaiting_approval", "resolved", "closed"].includes(data.status) && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5"><SendHorizonal className="h-3 w-3" /> Submit for Approval</span>
                  </p>
                  {!showApprovalForm ? (
                    <button
                      onClick={() => setShowApprovalForm(true)}
                      className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs font-medium hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 transition-all"
                    >
                      Request superadmin sign-off
                      <ChevronRight className="h-3 w-3 opacity-40" />
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Notes for superadmin (optional)"
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        className="w-full rounded-md border bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                          disabled={submitApprovalMutation.isPending}
                          onClick={() => submitApprovalMutation.mutate(approvalNotes || undefined)}
                        >
                          {submitApprovalMutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : "Submit"
                          }
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => { setShowApprovalForm(false); setApprovalNotes(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Details</p>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <p className="text-muted-foreground">Submitted</p>
                    <p className="font-medium">{new Date(data.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last updated</p>
                    <p className="font-medium">{new Date(data.updated_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
