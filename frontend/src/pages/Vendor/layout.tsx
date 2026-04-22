import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, LogOut, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/vendor", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/vendor/complaints", label: "My Complaints", icon: FileText, end: false },
];

export function VendorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-56 flex-col bg-[#0F172A]">
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-white/5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-white text-[11px] font-bold">
            V
          </div>
          <span className="text-sm font-semibold text-white/90 tracking-tight">Vendor Portal</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Menu</p>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                  isActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <a
            href="/submit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/45 hover:bg-white/5 hover:text-white/80 transition-all duration-150 mb-1"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Submit Form
          </a>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 mb-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              {user?.full_name?.[0] ?? "V"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white/80">{user?.full_name}</p>
              <p className="truncate text-[11px] text-white/35">Vendor · {user?.plant}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/35 hover:bg-white/5 hover:text-white/70 transition-all duration-150"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
