import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, Clock, Loader2, AlertCircle,
  FileText, MessageSquare, Package,
} from "lucide-react";
import { api } from "@/lib/api";
import type { TrackingData } from "@/types/complaint";

// ─── API calls ───────────────────────────────────────────────────────────────

async function fetchTracking(token: string): Promise<TrackingData> {
  const res = await api.get<{ success: boolean; data: TrackingData }>(`/api/track/${token}`);
  return res.data.data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new: "text-sky-600 bg-sky-50 border-sky-200",
  in_progress: "text-blue-600 bg-blue-50 border-blue-200",
  vendor_pending: "text-purple-600 bg-purple-50 border-purple-200",
  awaiting_approval: "text-orange-600 bg-orange-50 border-orange-200",
  escalated: "text-red-600 bg-red-50 border-red-200",
  resolved: "text-green-600 bg-green-50 border-green-200",
  closed: "text-gray-600 bg-gray-50 border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Received / Diterima",
  in_progress: "In Review / Dalam Semakan",
  vendor_pending: "In Progress / Dalam Proses",
  awaiting_approval: "Awaiting Approval / Menunggu Kelulusan",
  escalated: "Escalated / Dipertingkatkan",
  resolved: "Resolved / Diselesaikan",
  closed: "Closed / Ditutup",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ steps }: { steps: TrackingData["steps"] }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          {/* Circle */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                step.active
                  ? "border-primary bg-primary text-white"
                  : step.completed
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted-foreground/30 bg-white text-muted-foreground/40"
              }`}
            >
              {step.completed && !step.active ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span className="text-xs font-bold">{i + 1}</span>
              )}
            </div>
            <span
              className={`hidden text-[10px] text-center w-16 sm:block ${
                step.active ? "font-semibold text-primary" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 sm:w-12 mx-0.5 transition-colors ${
                steps[i + 1].completed ? "bg-primary" : "bg-muted-foreground/20"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ReplyCard({ reply }: { reply: NonNullable<TrackingData["reply"]> }) {
  return (
    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">
          Response from HR / Maklum Balas daripada HR
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">{formatDate(reply.sent_at)}</p>
      <div className="rounded-lg bg-white p-4 text-sm leading-relaxed whitespace-pre-wrap border">
        {reply.content}
      </div>
    </div>
  );
}

function Timeline({ events }: { events: TrackingData["timeline"] }) {
  return (
    <div className="space-y-1">
      {events.map((event, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
            {i < events.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium">{formatAction(event.action)}</p>
            <p className="text-xs text-muted-foreground">{formatDate(event.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function TrackPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tracking", token],
    queryFn: () => fetchTracking(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Complaint not found / Aduan tidak dijumpai</h1>
        <p className="text-muted-foreground text-sm">
          Check your tracking link and try again.
          <br />
          Semak pautan penjejakan anda dan cuba lagi.
        </p>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[data.status] ?? "text-gray-600 bg-gray-50 border-gray-200";
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mb-2 inline-flex items-center justify-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          Jabil HR Feedback System
        </div>
        <h1 className="mt-2 text-2xl font-bold">Complaint Status / Status Aduan</h1>
      </div>

      {/* Reference + Status card */}
      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Reference ID</p>
            <p className="text-2xl font-bold text-primary">{data.reference_id}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Category</p>
            <p className="font-medium">{data.category}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Plant</p>
            <p className="font-medium">{data.plant}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Priority</p>
            <p className={`font-medium ${data.priority === "urgent" ? "text-destructive" : ""}`}>
              {data.priority === "urgent" ? "Urgent" : "Normal"}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-muted-foreground">Submitted / Dihantar</p>
            <p className="font-medium">{formatDate(data.submitted_at)}</p>
          </div>
        </div>
      </div>

      {/* Step progress indicator */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Progress / Kemajuan
        </h2>
        <div className="flex justify-center overflow-x-auto pb-2">
          <StepIndicator steps={data.steps} />
        </div>
        <p className="mt-4 text-center text-sm font-medium text-primary sm:hidden">
          {data.steps.find((s) => s.active)?.label ?? ""}
        </p>
      </div>

      {/* HR Reply */}
      {data.reply && <ReplyCard reply={data.reply} />}

      {/* Attachments */}
      {data.attachments.length > 0 && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Your Attachments / Lampiran Anda
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.attachments.map((att, i) => (
              <a
                key={i}
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate text-xs">{att.file_name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Activity Timeline / Garis Masa Aktiviti
          </h2>
          <Timeline events={data.timeline} />
        </div>
      )}

      {/* Auto-refresh notice */}
      <p className="text-center text-xs text-muted-foreground">
        Page refreshes automatically every 30 seconds.
        <br />
        Halaman ini dimuat semula secara automatik setiap 30 saat.
      </p>
    </div>
  );
}
