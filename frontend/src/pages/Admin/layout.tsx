import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, Users, Building2, LogOut, ExternalLink,
  ShieldCheck, AlertTriangle, BarChart3, ClipboardList, UserCircle,
  Menu, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isSuperadmin = user?.role === "superadmin";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: approvalCountData } = useQuery<{ count: number }>({
    queryKey: ["approval-count"],
    queryFn: async () => {
      const res = await api.get<{ data: { count: number } }>("/api/superadmin/approvals/count");
      return res.data.data;
    },
    enabled: isSuperadmin,
    refetchInterval: 30_000,
  });
  const approvalCount = approvalCountData?.count ?? 0;

  const { data: urgentCountData } = useQuery<{ count: number }>({
    queryKey: ["urgent-count"],
    queryFn: async () => {
      const res = await api.get<{ data: { count: number } }>("/api/admin/complaints/urgent-count");
      return res.data.data;
    },
    refetchInterval: 60_000,
  });
  const urgentCount = urgentCountData?.count ?? 0;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[#0F172A] transition-transform duration-200 md:static md:translate-x-0 md:z-auto shrink-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-white/5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white text-[11px] font-bold">
            HR
          </div>
          <span className="text-sm font-semibold text-white/90 tracking-tight">Feedback System</span>
          <button
            className="ml-auto md:hidden text-white/40 hover:text-white/70"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Overview</p>
            <NavItem to="/admin" icon={LayoutDashboard} label="Dashboard" end onClick={() => setSidebarOpen(false)} />
          </div>
          <div>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Complaints</p>
            <NavItem to="/admin/complaints" icon={FileText} label="All Complaints" end onClick={() => setSidebarOpen(false)} />
            <NavItem to="/admin/complaints/urgent" icon={AlertTriangle} label="Urgent" badge={urgentCount > 0 ? String(urgentCount > 99 ? "99+" : urgentCount) : undefined} badgeColor="bg-red-500" onClick={() => setSidebarOpen(false)} />
          </div>
          <div>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Analytics</p>
            <NavItem to="/admin/analytics" icon={BarChart3} label="Analytics & Insights" onClick={() => setSidebarOpen(false)} />
            <SoonItem icon={ClipboardList} label="Reports" />
          </div>
          <div>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Management</p>
            <NavItem to="/admin/users" icon={Users} label="Users" onClick={() => setSidebarOpen(false)} />
            <SoonItem icon={Building2} label="Departments" />
            <SoonItem icon={UserCircle} label="Profile" />
          </div>
          {isSuperadmin && (
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">Superadmin</p>
              <NavItem
                to="/admin/approvals"
                icon={ShieldCheck}
                label="Approvals"
                badge={approvalCount > 0 ? String(approvalCount > 99 ? "99+" : approvalCount) : undefined}
                badgeColor="bg-amber-400 text-amber-900"
                onClick={() => setSidebarOpen(false)}
              />
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 p-3 space-y-1">
          <a
            href="/submit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/45 hover:bg-white/5 hover:text-white/80 transition-all duration-150"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Submit Form
          </a>
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white text-xs font-semibold">
              {user?.full_name?.[0] ?? "A"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white/80">{user?.full_name}</p>
              <p className="truncate text-[11px] text-white/35 capitalize">{user?.role}{user?.category ? ` · ${user.category}` : ""} · {user?.plant}</p>
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

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="flex h-12 items-center border-b bg-[#0F172A] px-4 md:hidden shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-white text-[10px] font-bold">HR</div>
            <span className="text-sm font-semibold text-white/90">Feedback System</span>
          </div>
          {urgentCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
              {urgentCount}
            </span>
          )}
        </div>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({
  to, icon: Icon, label, end = false, badge, badgeColor = "bg-amber-400 text-amber-900", onClick,
}: {
  to: string; icon: React.ElementType; label: string; end?: boolean;
  badge?: string; badgeColor?: string; onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
          isActive ? "bg-white/10 text-white font-medium" : "text-white/45 hover:bg-white/5 hover:text-white/80"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className={cn("flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold", badgeColor)}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function SoonItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/20 cursor-not-allowed select-none">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/30">Soon</span>
    </div>
  );
}
