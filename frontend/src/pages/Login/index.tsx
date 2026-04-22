import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<"admin" | "vendor">(
    searchParams.get("role") === "vendor" ? "vendor" : "admin"
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(identifier, password, role);
      if (user.role === "vendor") {
        navigate("/vendor", { replace: true });
      } else {
        navigate("/admin", { replace: true });
      }
    } catch {
      setError(
        role === "vendor"
          ? "Invalid phone number or password."
          : "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-[#0F172A] p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
            HR
          </div>
          <span className="font-semibold tracking-tight">Feedback System</span>
        </div>

        <div className="space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <ShieldCheck className="h-7 w-7 text-primary" style={{ color: '#38BDF8' }} />
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Manage complaints<br />with confidence.
          </h1>
          <p className="text-sm leading-relaxed text-white/50">
            A centralized platform for HR teams to receive, track, and resolve
            employee feedback efficiently.
          </p>
        </div>

        <p className="text-xs text-white/30">Jabil HR Integrated Feedback System · {new Date().getFullYear()}</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile brand */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white text-xs font-bold">
            HR
          </div>
          <span className="font-semibold">Feedback System</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Enter your credentials to access the dashboard.</p>
          </div>

          {/* Dev quick-fill */}
          <div className="mb-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 space-y-2.5">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Dev — quick fill</p>

            {/* Superadmin + Vendors */}
            <div>
              <p className="text-[10px] text-amber-600 font-medium mb-1">Management</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Superadmin", id: "superadmin@jabil.com", pw: "Admin@1234", role: "admin" as const },
                  { label: "Vendor (Canteen)", id: "+60123456789", pw: "Vendor@1234", role: "vendor" as const },
                  { label: "Vendor (Transport)", id: "+60198887766", pw: "Vendor@1234", role: "vendor" as const },
                ].map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => { setRole(c.role); setIdentifier(c.id); setPassword(c.pw); setError(""); }}
                    className="rounded-md bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category admins per plant */}
            {[
              { plant: "P1", admins: [
                { label: "Canteen", id: "admin.canteen.p1@jabil.com" },
                { label: "Locker",  id: "admin.locker.p1@jabil.com" },
                { label: "ESD",     id: "admin.esd.p1@jabil.com" },
                { label: "Transport", id: "admin.transport.p1@jabil.com" },
              ]},
              { plant: "P2", admins: [
                { label: "Canteen", id: "admin.canteen.p2@jabil.com" },
                { label: "Locker",  id: "admin.locker.p2@jabil.com" },
                { label: "ESD",     id: "admin.esd.p2@jabil.com" },
                { label: "Transport", id: "admin.transport.p2@jabil.com" },
              ]},
              { plant: "BK", admins: [
                { label: "Canteen", id: "admin.canteen.bk@jabil.com" },
                { label: "Locker",  id: "admin.locker.bk@jabil.com" },
                { label: "ESD",     id: "admin.esd.bk@jabil.com" },
                { label: "Transport", id: "admin.transport.bk@jabil.com" },
              ]},
            ].map(({ plant, admins }) => (
              <div key={plant}>
                <p className="text-[10px] text-amber-600 font-medium mb-1">Admin — {plant}</p>
                <div className="flex flex-wrap gap-1.5">
                  {admins.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setRole("admin"); setIdentifier(a.id); setPassword("Admin@1234"); setError(""); }}
                      className="rounded-md bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Role toggle */}
          <div className="mb-6 flex rounded-lg border bg-muted/30 p-1 gap-1">
            {(["admin", "vendor"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setIdentifier(""); setError(""); }}
                className={cn(
                  "flex-1 rounded-md py-1.5 text-sm font-medium transition-all",
                  role === r
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r === "admin" ? "Admin / HR" : "Vendor"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">
                {role === "vendor" ? "Phone Number" : "Email address"}
              </Label>
              <Input
                id="identifier"
                type={role === "vendor" ? "tel" : "email"}
                placeholder={role === "vendor" ? "+60123456789" : "admin@company.com"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Authorized personnel only. Unauthorized access is prohibited.
          </p>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Not sure where to go?{" "}
              <Link to="/" className="font-medium text-primary hover:underline underline-offset-4">
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
