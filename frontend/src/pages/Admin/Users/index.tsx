import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Phone, MapPin, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface VendorUser {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  plant: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const PLANTS = ["P1", "P2", "BK"];

// ── Add Vendor Modal ──────────────────────────────────────────────────────────

function AddVendorModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", password: "", plant: "P1" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post("/api/admin/users", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail ?? "Failed to create vendor.");
    },
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0F172A] px-6 py-4">
          <h2 className="text-base font-semibold text-white">Create Vendor Account</h2>
          <p className="text-xs text-white/40 mt-0.5">Vendor will log in with their phone number and password.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              placeholder="e.g. Canteen Services Sdn Bhd"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Phone Number</Label>
            <Input
              type="tel"
              placeholder="+60123456789"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">This is the vendor's login identifier.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Set a strong password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Plant</Label>
            <div className="flex gap-2">
              {PLANTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("plant", p)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm font-medium transition-all",
                    form.plant === p
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={!form.full_name.trim() || !form.phone.trim() || !form.password.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery<VendorUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await api.get<{ data: VendorUser[] }>("/api/admin/users");
      return res.data.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/admin/users/${id}/toggle-active`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Vendor Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage vendor logins. Vendors log in using their phone number.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : !data?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No vendors yet</p>
            <p className="text-sm text-muted-foreground">Click "Add Vendor" to create the first account.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((v) => (
                <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{v.full_name}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {v.phone ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {v.plant ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    {v.is_active ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleMutation.mutate(v.id)}
                      disabled={toggleMutation.isPending}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors disabled:opacity-50"
                    >
                      {v.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <AddVendorModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
