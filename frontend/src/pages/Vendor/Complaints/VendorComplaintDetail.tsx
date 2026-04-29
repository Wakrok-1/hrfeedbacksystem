import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Paperclip, Loader2, MessageSquare, CheckCircle2, ImagePlus, Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { StatusBadge, PriorityBadge } from "@/pages/Admin/Complaints/StatusBadge";
import type { ComplaintDetail } from "@/types/admin";

interface UploadedFile {
  file_name: string;
  file_url: string;
  file_type: string;
  file_size_mb: number;
}

interface Props {
  id: number;
  onClose: () => void;
}

export function VendorComplaintDetail({ id, onClose }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [response, setResponse] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading } = useQuery<ComplaintDetail>({
    queryKey: ["vendor-complaint", id],
    queryFn: async () => {
      const res = await api.get<{ data: ComplaintDetail }>(`/api/vendor/complaints/${id}`);
      return res.data.data;
    },
  });

  const responseMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/vendor/complaints/${id}/response`, {
        content: response.trim(),
        action_taken: actionTaken.trim() || undefined,
        attachment_urls: uploadedFiles.map((f) => f.file_url),
      }),
    onSuccess: () => {
      setSubmitted(true);
      setResponse("");
      setActionTaken("");
      setUploadedFiles([]);
      qc.invalidateQueries({ queryKey: ["vendor-complaint", id] });
      qc.invalidateQueries({ queryKey: ["vendor-complaints"] });
      qc.invalidateQueries({ queryKey: ["vendor-stats"] });
      setTimeout(() => setSubmitted(false), 3000);
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      const res = await api.post<{ data: UploadedFile[] }>("/api/upload/vendor-response", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadedFiles((prev) => [...prev, ...res.data.data]);
    } catch {
      // silently ignore upload errors — user can retry
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const vendorResponses = data?.audit_logs?.filter((l: any) => l.action === "vendor_response") ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="relative flex h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between bg-[#0F172A] px-6 py-4">
          <div>
            <p className="font-mono text-xs text-white/40">{data?.reference_id ?? "..."}</p>
            <h2 className="text-base font-semibold text-white mt-0.5">{data?.category ?? "..."} Complaint</h2>
          </div>
          <div className="flex items-center gap-3">
            {data && <StatusBadge status={data.status} />}
            <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Details */}
            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Complaint Details</p>
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <PriorityBadge priority={data.priority} />
                  <span className="text-xs text-muted-foreground">Plant: {data.plant}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(data.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{data.description}</p>
              </div>
            </section>

            {/* Complaint attachments (submitted by worker) */}
            {data.attachments.length > 0 && (
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Worker Attachments ({data.attachments.length})
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
                      <span className="text-xs text-muted-foreground">{a.file_size_mb.toFixed(2)} MB</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Previous vendor responses */}
            {vendorResponses.length > 0 && (
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Your Responses ({vendorResponses.length})
                </p>
                <div className="space-y-3">
                  {vendorResponses.map((log: any) => (
                    <div key={log.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700">Response submitted</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{String(log.details?.response ?? "")}</p>
                      {log.details?.action_taken && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          <span className="font-medium">Action taken:</span> {String(log.details.action_taken)}
                        </p>
                      )}
                      {log.details?.attachment_urls?.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-[11px] font-medium text-muted-foreground">Evidence photos:</p>
                          {(log.details.attachment_urls as string[]).map((url: string, i: number) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                            const filename = url.split("/").pop() ?? `File ${i + 1}`;
                            return isImage ? (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt={filename}
                                  className="max-h-40 rounded-lg border object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                />
                              </a>
                            ) : (
                              <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs hover:border-primary transition-all"
                              >
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{filename}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Submit response */}
            {!["resolved", "closed"].includes(data.status) && (
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Submit Response
                </p>
                <div className="rounded-xl border bg-white p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Your Response <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      rows={4}
                      placeholder="Describe what you found and what steps you are taking..."
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      className="resize-none text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Action Taken <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <Input
                      placeholder="e.g. Repaired the locker, Cleaned the canteen area..."
                      value={actionTaken}
                      onChange={(e) => setActionTaken(e.target.value)}
                      className="text-sm h-9"
                    />
                  </div>

                  {/* Evidence upload */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Evidence Photos / Files <span className="text-muted-foreground/50">(optional)</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-all w-full justify-center"
                    >
                      {isUploading ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</>
                      ) : (
                        <><ImagePlus className="h-3.5 w-3.5" /> Attach photos or files</>
                      )}
                    </button>

                    {uploadedFiles.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {uploadedFiles.map((f, i) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(f.file_url);
                          return isImage ? (
                            <div key={i} className="relative inline-block">
                              <img
                                src={f.file_url}
                                alt={f.file_name}
                                className="max-h-32 rounded-lg border object-contain"
                              />
                              <button
                                onClick={() => removeFile(i)}
                                className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-white"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1 truncate">{f.file_name}</span>
                              <span className="text-muted-foreground">{f.file_size_mb.toFixed(2)} MB</span>
                              <button onClick={() => removeFile(i)} className="text-destructive hover:opacity-70">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {submitted ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Response submitted successfully!
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      disabled={!response.trim() || responseMutation.isPending || isUploading}
                      onClick={() => responseMutation.mutate()}
                    >
                      {responseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Response"}
                    </Button>
                  )}
                </div>
              </section>
            )}

            {["resolved", "closed"].includes(data.status) && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                This complaint has been {data.status}. No further action required.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
