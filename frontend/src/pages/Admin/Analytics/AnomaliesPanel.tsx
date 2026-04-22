import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Flame, Info, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Anomaly } from "@/types/analytics";

const SEV: Record<string, { badge: string; icon: React.ReactNode; label: string }> = {
  critical: { badge: "bg-red-600 text-white",    icon: <Flame className="h-3.5 w-3.5" />,         label: "CRITICAL" },
  high:     { badge: "bg-orange-500 text-white",  icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "HIGH"     },
  medium:   { badge: "bg-amber-500 text-white",   icon: <AlertTriangle className="h-3.5 w-3.5" />, label: "MEDIUM"   },
  low:      { badge: "bg-blue-500 text-white",    icon: <Info className="h-3.5 w-3.5" />,          label: "LOW"      },
};

export function AnomaliesPanel({ anomalies }: { anomalies: Anomaly[] }) {
  const qc = useQueryClient();

  const dismiss = useMutation({
    mutationFn: (id: string) => api.post(`/api/analytics/anomalies/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics-anomalies"] }),
  });

  if (!anomalies.length) return null;

  const sorted = [...anomalies].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="rounded-xl border border-red-200 border-l-[4px] border-l-red-500 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-red-100 bg-red-50/50">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700">Critical Anomalies Detected</span>
          <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-2 py-0.5">{anomalies.length}</span>
        </div>
        <span className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Requires Immediate Attention</span>
      </div>

      <div className="divide-y divide-red-50">
        {sorted.map((a) => {
          const sev = SEV[a.severity] ?? SEV.medium;
          return (
            <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-red-50/20 transition-colors">
              <span className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold shrink-0", sev.badge)}>
                {sev.icon} {sev.label}
              </span>
              <span className="text-xs font-semibold text-foreground/60 w-20 shrink-0">{a.category}</span>
              <p className="flex-1 text-sm text-foreground">{a.message}</p>
              <button
                onClick={() => dismiss.mutate(a.id)}
                className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" /> Dismiss
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-2.5 bg-red-50/30 border-t border-red-100">
        <p className="text-[11px] text-red-500">
          These items are showing unusual patterns and may require immediate intervention.
        </p>
      </div>
    </div>
  );
}
