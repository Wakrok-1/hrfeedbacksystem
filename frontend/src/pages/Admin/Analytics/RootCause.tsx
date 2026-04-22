import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RootCause } from "@/types/analytics";

const SEV_STYLES = {
  low:      { badge: "bg-gray-100 text-gray-600 border-gray-200",    bar: "bg-gray-300"    },
  medium:   { badge: "bg-amber-100 text-amber-700 border-amber-200",  bar: "bg-amber-400"   },
  high:     { badge: "bg-red-100 text-red-700 border-red-200",        bar: "bg-red-500"     },
  critical: { badge: "bg-red-900 text-white border-red-800",           bar: "bg-red-600"    },
};

export function RootCauseSection({
  data, isLoading, onRun,
}: {
  data: RootCause[] | null;
  isLoading: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold">Root Cause Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">AI-generated patterns from complaint descriptions</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
          <Sparkles className="h-3 w-3" /> AI Generated
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map((i) => (
            <div key={i} className="rounded-xl border bg-slate-50 p-4 animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-1.5 bg-slate-200 rounded w-full" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="h-12 w-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-3">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <p className="text-sm font-medium">Run AI Analysis to generate insights</p>
          <p className="text-xs mt-1 opacity-60">Analyzes complaint patterns using Llama 3.3</p>
          <button
            onClick={onRun}
            className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Run Analysis
          </button>
        </div>
      ) : !data.length ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          No root causes detected for the selected period.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.map((rc, i) => {
            const sev = SEV_STYLES[rc.severity] ?? SEV_STYLES.medium;
            return (
              <div key={i} className="rounded-xl border p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground leading-snug">{rc.title}</p>
                  <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase", sev.badge)}>
                    {rc.severity}
                  </span>
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Confidence</span>
                    <span className="font-semibold">{rc.confidence}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full", sev.bar)} style={{ width: `${rc.confidence}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">{rc.complaint_count} complaints</span>
                  {rc.categories_involved.map((cat) => (
                    <span key={cat} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{cat}</span>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">{rc.suggested_action}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
