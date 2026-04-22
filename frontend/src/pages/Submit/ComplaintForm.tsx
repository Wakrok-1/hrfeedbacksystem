import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileUpload, type LocalFile } from "@/components/forms/FileUpload";
import { CanteenFields, LockerFields, TransportationFields } from "@/components/forms/CategoryFields";

import { complaintFormSchema, type ComplaintFormValues } from "./schema";
import type { Category, ComplaintSubmitResult, UploadedFile } from "@/types/complaint";
import { api } from "@/lib/api";

interface ComplaintFormProps {
  category: Category;
  onBack: () => void;
  onSuccess: (result: ComplaintSubmitResult, emailProvided: boolean) => void;
}

const CATEGORY_LABELS: Record<Category, { en: string; ms: string }> = {
  Canteen: { en: "Canteen", ms: "Kantin" },
  Locker: { en: "Locker", ms: "Loker" },
  ESD: { en: "ESD", ms: "ESD" },
  Transportation: { en: "Transportation", ms: "Pengangkutan" },
};

// Upload files to backend, return UploadedFile[]
async function uploadFiles(localFiles: LocalFile[]): Promise<UploadedFile[]> {
  if (localFiles.length === 0) return [];
  const formData = new FormData();
  localFiles.forEach((lf) => formData.append("files", lf.file));
  const res = await api.post<{ success: boolean; data: UploadedFile[] }>("/api/upload/complaint", formData);
  return res.data.data;
}

export function ComplaintForm({ category, onBack, onSuccess }: ComplaintFormProps) {
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const form = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintFormSchema),
    defaultValues: {
      submitter_name: "",
      submitter_employee_id: "",
      submitter_email: "",
      submitter_phone: "",
      description: "",
      category_data: {},
    },
  });

  const descriptionValue = form.watch("description");

  const submitMutation = useMutation({
    mutationFn: async (values: ComplaintFormValues) => {
      // Validate files
      if (localFiles.length < 1) {
        setFileError("At least 1 file is required / Sekurang-kurangnya 1 fail diperlukan");
        throw new Error("files_required");
      }
      setFileError(null);

      // Upload files first
      const uploadedFiles = await uploadFiles(localFiles);

      // Submit complaint
      const res = await api.post<{ success: boolean; data: ComplaintSubmitResult }>("/api/submit", {
        ...values,
        category,
        submitter_email: values.submitter_email || undefined,
        submitter_phone: values.submitter_phone || undefined,
        attachment_urls: uploadedFiles,
      });

      return { result: res.data.data, emailProvided: !!values.submitter_email };
    },
    onSuccess: ({ result, emailProvided }) => {
      onSuccess(result, emailProvided);
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    submitMutation.mutate(values);
  });

  const label = CATEGORY_LABELS[category];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">
            {label.en} Complaint / Aduan {label.ms}
          </h1>
          <p className="text-sm text-muted-foreground">
            All fields marked <span className="text-destructive">*</span> are required /
            Semua medan bertanda <span className="text-destructive">*</span> adalah wajib
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-8">

        {/* ── Section 01: Personal Information ───────────────────────── */}
        <section className="rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold text-base">
            Section 01 — Personal Information / Maklumat Peribadi
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Full name */}
            <div className="sm:col-span-2">
              <Label htmlFor="submitter_name">
                Full Name / Nama Penuh <span className="text-destructive">*</span>
              </Label>
              <Input
                id="submitter_name"
                placeholder="Enter your full name / Masukkan nama penuh"
                {...form.register("submitter_name")}
              />
              {form.formState.errors.submitter_name && (
                <p className="mt-1 text-sm text-destructive">
                  {form.formState.errors.submitter_name.message}
                </p>
              )}
            </div>

            {/* Employee ID */}
            <div>
              <Label htmlFor="submitter_employee_id">
                Employee ID / ID Pekerja <span className="text-destructive">*</span>
              </Label>
              <Input
                id="submitter_employee_id"
                placeholder="e.g. JBL12345"
                {...form.register("submitter_employee_id")}
              />
              {form.formState.errors.submitter_employee_id && (
                <p className="mt-1 text-sm text-destructive">
                  {form.formState.errors.submitter_employee_id.message}
                </p>
              )}
            </div>

            {/* Plant */}
            <div>
              <Label>
                Plant / Kilang <span className="text-destructive">*</span>
              </Label>
              <Select
                onValueChange={(v) =>
                  form.setValue("plant", v as "P1" | "P2" | "BK", { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plant / Pilih kilang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P1">Plant 1</SelectItem>
                  <SelectItem value="P2">Plant 2</SelectItem>
                  <SelectItem value="BK">Plant BK</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.plant && (
                <p className="mt-1 text-sm text-destructive">
                  {form.formState.errors.plant.message}
                </p>
              )}
            </div>

            {/* Phone (optional) */}
            <div>
              <Label htmlFor="submitter_phone">
                Phone Number / Nombor Telefon{" "}
                <span className="text-muted-foreground text-xs">(Optional / Pilihan)</span>
              </Label>
              <Input
                id="submitter_phone"
                type="tel"
                placeholder="e.g. 012-3456789"
                {...form.register("submitter_phone")}
              />
            </div>

            {/* Email (optional) */}
            <div>
              <Label htmlFor="submitter_email">
                Email Address / Alamat E-mel{" "}
                <span className="text-muted-foreground text-xs">(Optional / Pilihan)</span>
              </Label>
              <Input
                id="submitter_email"
                type="email"
                placeholder="you@example.com"
                {...form.register("submitter_email")}
              />
              {form.formState.errors.submitter_email && (
                <p className="mt-1 text-sm text-destructive">
                  {form.formState.errors.submitter_email.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 02: Category-specific fields (hidden for ESD) ───── */}
        {category !== "ESD" && (
          <section className="rounded-xl border p-6 space-y-4">
            <h2 className="font-semibold text-base">
              Section 02 — {label.en} Details / Butiran {label.ms}
            </h2>
            {category === "Canteen" && <CanteenFields form={form} />}
            {category === "Locker" && <LockerFields form={form} />}
            {category === "Transportation" && <TransportationFields form={form} />}
          </section>
        )}

        {/* ── Section 03: Description ──────────────────────────────────── */}
        <section className="rounded-xl border p-6 space-y-3">
          <h2 className="font-semibold text-base">
            Section 03 — Complaint Details / Butiran Aduan
          </h2>
          <div>
            <Label htmlFor="description">
              Description / Penerangan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              rows={5}
              placeholder="Describe your complaint in detail / Terangkan aduan anda secara terperinci"
              maxLength={1000}
              {...form.register("description")}
            />
            <div className="mt-1 flex justify-between">
              {form.formState.errors.description ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.description.message}
                </p>
              ) : (
                <span />
              )}
              <span
                className={`text-xs ${
                  descriptionValue.length > 950 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {descriptionValue.length}/1000
              </span>
            </div>
          </div>
        </section>

        {/* ── Section 04: Supporting Evidence ─────────────────────────── */}
        <section className="rounded-xl border p-6 space-y-3">
          <h2 className="font-semibold text-base">
            Section 04 — Supporting Evidence / Bukti Sokongan
          </h2>
          <p className="text-xs text-muted-foreground">
            Upload photos or videos of the issue. At least 1 file required.
            <br />
            Muat naik foto atau video masalah tersebut. Sekurang-kurangnya 1 fail diperlukan.
          </p>
          <FileUpload files={localFiles} onChange={setLocalFiles} error={fileError ?? undefined} />
        </section>

        {/* Submit error */}
        {submitMutation.isError &&
          submitMutation.error instanceof Error &&
          submitMutation.error.message !== "files_required" && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Submission failed. Please try again. / Penghantaran gagal. Sila cuba lagi.
            </p>
          )}

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting... / Menghantar...
            </>
          ) : (
            "Submit Complaint / Hantar Aduan"
          )}
        </Button>
      </form>
    </div>
  );
}
