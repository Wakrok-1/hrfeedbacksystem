import { UseFormReturn, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ComplaintFormValues } from "@/pages/Submit/schema";

// ─── Canteen ────────────────────────────────────────────────────────────────

const CANTEEN_ISSUE_TYPES = [
  "Variety of food / Variasi makanan",
  "Food pricing / Harga makanan",
  "Hygiene / Kebersihan",
  "Food quality / Kualiti makanan",
  "Long waiting time / Masa menunggu lama",
  "Staff attitude / Sikap kakitangan",
  "Food portion size / Saiz bahagian makanan",
  "Others / Lain-lain",
];

const TIME_PERIODS = [
  "Morning 6am–10am / Pagi 6pg–10pg",
  "Lunch 10am–2pm / Tengahari 10pg–2ptg",
  "Tea Break 2pm–4pm / Rehat 2ptg–4ptg",
  "Dinner 4pm–8pm / Makan malam 4ptg–8mlm",
  "Night Shift / Syif malam",
  "Other / Lain-lain",
];

export function CanteenFields({ form }: { form: UseFormReturn<ComplaintFormValues> }) {
  const issueType = useWatch({ control: form.control, name: "category_data.issue_type" });

  return (
    <div className="space-y-4">
      {/* Issue type — radio-style buttons */}
      <div>
        <Label className="mb-2 block">
          Issue Type / Jenis Masalah <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {CANTEEN_ISSUE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => form.setValue("category_data.issue_type", type, { shouldValidate: true })}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                issueType === type
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-input hover:border-primary/50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        {form.formState.errors.category_data?.issue_type && (
          <p className="mt-1 text-sm text-destructive">
            {form.formState.errors.category_data.issue_type.message}
          </p>
        )}
      </div>

      {/* Others free text */}
      {issueType?.startsWith("Others") && (
        <div>
          <Label htmlFor="others_detail">
            Please specify / Sila nyatakan <span className="text-destructive">*</span>
          </Label>
          <Input
            id="others_detail"
            placeholder="Describe the issue / Terangkan masalah"
            {...form.register("category_data.others_detail")}
          />
        </div>
      )}

      {/* Date of incident */}
      <div>
        <Label htmlFor="incident_date">
          Date of Incident / Tarikh Kejadian <span className="text-destructive">*</span>
        </Label>
        <Input
          id="incident_date"
          type="date"
          max={new Date().toISOString().split("T")[0]}
          {...form.register("category_data.incident_date")}
        />
        {form.formState.errors.category_data?.incident_date && (
          <p className="mt-1 text-sm text-destructive">
            {form.formState.errors.category_data.incident_date.message}
          </p>
        )}
      </div>

      {/* Time period */}
      <div>
        <Label>Time Period / Waktu <span className="text-destructive">*</span></Label>
        <Select
          onValueChange={(v) => form.setValue("category_data.time_period", v, { shouldValidate: true })}
          defaultValue={form.getValues("category_data.time_period")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select time period / Pilih waktu" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Specific time (optional) */}
      <div>
        <Label htmlFor="specific_time">
          Specific Time / Masa Tepat{" "}
          <span className="text-muted-foreground text-xs">(Optional / Pilihan)</span>
        </Label>
        <Input
          id="specific_time"
          placeholder="e.g. 12:30 PM"
          {...form.register("category_data.specific_time")}
        />
      </div>
    </div>
  );
}

// ─── Locker ─────────────────────────────────────────────────────────────────

const LOCKER_ISSUE_TYPES = [
  "Locker damage / Loker rosak",
  "Cannot lock / Tidak boleh dikunci",
  "Key missing / Kunci hilang",
  "Safety concern / Kebimbangan keselamatan",
  "Cleanliness / Kebersihan",
  "Allocation problem / Masalah peruntukan",
  "Others / Lain-lain",
];

export function LockerFields({ form }: { form: UseFormReturn<ComplaintFormValues> }) {
  const issueType = useWatch({ control: form.control, name: "category_data.issue_type" });

  return (
    <div className="space-y-4">
      <div>
        <Label>Issue Type / Jenis Masalah <span className="text-destructive">*</span></Label>
        <Select
          onValueChange={(v) => form.setValue("category_data.issue_type", v, { shouldValidate: true })}
          defaultValue={form.getValues("category_data.issue_type")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select issue type / Pilih jenis masalah" />
          </SelectTrigger>
          <SelectContent>
            {LOCKER_ISSUE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.category_data?.issue_type && (
          <p className="mt-1 text-sm text-destructive">
            {form.formState.errors.category_data.issue_type.message}
          </p>
        )}
      </div>

      {issueType?.startsWith("Others") && (
        <div>
          <Label htmlFor="others_detail">
            Please specify / Sila nyatakan <span className="text-destructive">*</span>
          </Label>
          <Input
            id="others_detail"
            placeholder="Describe the issue / Terangkan masalah"
            {...form.register("category_data.others_detail")}
          />
        </div>
      )}
    </div>
  );
}

// ─── Transportation ──────────────────────────────────────────────────────────

const DRIVER_ATTITUDE_SUBS = [
  "Smoking / Merokok",
  "Indecent behaviour / Kelakuan tidak senonoh",
  "Scolding / Memarahi",
  "Dangerous driving / Memandu merbahaya",
  "Late pickup / Lewat menjemput",
  "Others / Lain-lain",
];

const VEHICLE_ISSUE_SUBS = [
  "No AC / Tiada penghawa dingin",
  "Hygiene / Kebersihan",
  "Damaged seat / Tempat duduk rosak",
  "Overcrowded / Terlalu sesak",
  "Others / Lain-lain",
];

const TRANSPORT_COMPANIES = ["Icon Trans", "Siva Jaya", "Sudi Jaya", "SH Liew"];

export function TransportationFields({ form }: { form: UseFormReturn<ComplaintFormValues> }) {
  const category = useWatch({ control: form.control, name: "category_data.transport_category" });
  const subIssue = useWatch({ control: form.control, name: "category_data.sub_issue" });

  const subOptions = category === "Driver Attitude" ? DRIVER_ATTITUDE_SUBS : VEHICLE_ISSUE_SUBS;

  return (
    <div className="space-y-4">
      {/* Category */}
      <div>
        <Label>Category / Kategori <span className="text-destructive">*</span></Label>
        <Select
          onValueChange={(v) => {
            form.setValue("category_data.transport_category", v, { shouldValidate: true });
            form.setValue("category_data.sub_issue", ""); // reset sub-issue on category change
          }}
          defaultValue={form.getValues("category_data.transport_category")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category / Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Driver Attitude">Driver Attitude / Sikap Pemandu</SelectItem>
            <SelectItem value="Vehicle Issue">Vehicle Issue / Masalah Kenderaan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sub-issue */}
      {category && (
        <div>
          <Label>Specific Issue / Masalah Spesifik <span className="text-destructive">*</span></Label>
          <Select
            onValueChange={(v) => form.setValue("category_data.sub_issue", v, { shouldValidate: true })}
            defaultValue={form.getValues("category_data.sub_issue")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select issue / Pilih masalah" />
            </SelectTrigger>
            <SelectContent>
              {subOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Others free text */}
      {subIssue?.startsWith("Others") && (
        <div>
          <Label htmlFor="others_detail">
            Please specify / Sila nyatakan <span className="text-destructive">*</span>
          </Label>
          <Input
            id="others_detail"
            placeholder="Describe the issue / Terangkan masalah"
            {...form.register("category_data.others_detail")}
          />
        </div>
      )}

      {/* Driver name */}
      <div>
        <Label htmlFor="driver_name">
          Driver Name / Nama Pemandu <span className="text-destructive">*</span>
        </Label>
        <Input
          id="driver_name"
          placeholder="Full name / Nama penuh"
          {...form.register("category_data.driver_name")}
        />
        {form.formState.errors.category_data?.driver_name && (
          <p className="mt-1 text-sm text-destructive">
            {form.formState.errors.category_data.driver_name.message}
          </p>
        )}
      </div>

      {/* Vehicle plate */}
      <div>
        <Label htmlFor="vehicle_plate">
          Vehicle Plate / Plat Kenderaan <span className="text-destructive">*</span>
        </Label>
        <Input
          id="vehicle_plate"
          placeholder="e.g. WXX 1234"
          className="uppercase"
          {...form.register("category_data.vehicle_plate")}
        />
        {form.formState.errors.category_data?.vehicle_plate && (
          <p className="mt-1 text-sm text-destructive">
            {form.formState.errors.category_data.vehicle_plate.message}
          </p>
        )}
      </div>

      {/* Transport company */}
      <div>
        <Label>Transport Company / Syarikat Pengangkutan <span className="text-destructive">*</span></Label>
        <Select
          onValueChange={(v) => form.setValue("category_data.transport_company", v, { shouldValidate: true })}
          defaultValue={form.getValues("category_data.transport_company")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select company / Pilih syarikat" />
          </SelectTrigger>
          <SelectContent>
            {TRANSPORT_COMPANIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.category_data?.transport_company && (
          <p className="mt-1 text-sm text-destructive">
            {form.formState.errors.category_data.transport_company.message}
          </p>
        )}
      </div>
    </div>
  );
}
