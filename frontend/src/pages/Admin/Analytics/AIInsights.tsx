import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AIInsights } from "@/types/analytics";

const CAP_STYLES = {
  low:        "bg-emerald-100 text-emerald-700",
  manageable: "bg-blue-100 text-blue-700",
  high:       "bg-amber-100 text-amber-700",
  critical:   "bg-red-100 text-red-700",
};

const INSIGHT_STYLES = {
  pattern: { dot: "bg-violet-500", bg: "bg-violet-50 border-violet-100" },
  warning: { dot: "bg-amber-500",  bg: "bg-amber-50 border-amber-100"  },
  info:    { dot: "bg-blue-500",   bg: "bg-blue-50 border-blue-100"    },
};

export function AIInsightsSection({
  data, isLoading, onRun, generatedAt,
}: {
  data: AIInsights | null;
  isLoading: boolean;
  onRun: () => void;
  generatedAt?: Date | null;
}) {
  const sentColor = (score: number) =>
    score >= 0.2 ? "text-emerald-600 bg-emerald-50" :
    score <= -0.2 ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50";

  const trendIcon = (t: string) =>
    t === "up" ? <TrendingUp className="h-3.5 w-3.5 text-red-500" /> :
    t === "down" ? <TrendingDown className="h-3.5 w-3.5 text-emerald-500" /> :
    <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1,2].map((i) => (
          <div key={i} className="rounded-xl border bg-white p-5 animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center gap-2 mb-5">
          <h3 className="text-sm font-semibold">AI-Powered Insights</h3>
          <span className="flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
            <Sparkles className="h-3 w-3" /> AI Generated
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Sparkles className="h-8 w-8 text-violet-200 mb-3" />
          <p className="text-sm font-medium">Run AI Analysis to generate insights</p>
          <button
            onClick={onRun}
            className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" /> Run AI Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Performance Matrix */}
      {data.category_matrix.length > 0 && (
        <div className="rounded-xl border bg-white p-5">
          <h3 className="text-sm font-semibold mb-1">Category Performance Matrix</h3>
          <p className="text-xs text-muted-foreground mb-4">AI-analyzed performance across complaint categories</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground/60">
                  <th className="text-left pb-2 font-semibold">Category</th>
                  <th className="text-right pb-2 font-semibold">Avg Resolution (days)</th>
                  <th className="text-right pb-2 font-semibold">SLA Breach %</th>
                  <th className="text-right pb-2 font-semibold">Sentiment</th>
                  <th className="text-right pb-2 font-semibold">Volume Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.category_matrix.map((row) => (
                  <tr key={row.category} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-medium">{row.category}</td>
                    <td className="py-2.5 text-right">
                      <span className={cn("rounded-md px-2 py-0.5 font-medium",
                        row.avg_resolution_days <= 2 ? "bg-emerald-50 text-emerald-700" :
                        row.avg_resolution_days <= 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                      )}>
                        {row.avg_resolution_days}d
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={cn("rounded-md px-2 py-0.5 font-medium",
                        row.sla_breach_rate <= 10 ? "bg-emerald-50 text-emerald-700" :
                        row.sla_breach_rate <= 25 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                      )}>
                        {row.sla_breach_rate}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={cn("rounded-md px-2 py-0.5 font-medium", sentColor(row.sentiment_score))}>
                        {row.sentiment_score > 0 ? "+" : ""}{row.sentiment_score}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="flex items-center justify-end gap-1">
                        {trendIcon(row.volume_trend)}
                        <span className="capitalize text-muted-foreground">{row.volume_trend}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Smart Insights + Predictive Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Smart Insights */}
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold">AI-Powered Recommendations</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Smart insights based on pattern analysis</p>
          <div className="space-y-2.5">
            {data.smart_insights.map((ins, i) => {
              const s = INSIGHT_STYLES[ins.type] ?? INSIGHT_STYLES.info;
              return (
                <div key={i} className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5", s.bg)}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.dot)} />
                  <p className="text-xs text-foreground leading-relaxed">{ins.message}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground/60">
            {generatedAt && <span>Analyzed {generatedAt.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}</span>}
            <span className="ml-auto">AI Confidence: High</span>
          </div>
        </div>

        {/* Predictive Forecast */}
        {data.predictive_forecast && (
          <div className="rounded-xl border bg-white p-5">
            <h3 className="text-sm font-semibold mb-1">7-Day Workload Forecast</h3>
            <p className="text-xs text-muted-foreground mb-4">Predictive analytics for resource planning</p>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Expected Ticket Volume</p>
                <p className="text-3xl font-bold text-foreground">
                  {data.predictive_forecast.expected_min}–{data.predictive_forecast.expected_max}
                  <span className="text-sm font-normal text-muted-foreground ml-2">tickets</span>
                </p>
              </div>

              {/* Capacity bar */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">Capacity Status</span>
                  <span className={cn("capitalize font-semibold rounded-md px-2 py-0.5 text-[10px]",
                    CAP_STYLES[data.predictive_forecast.capacity_status] ?? CAP_STYLES.manageable
                  )}>
                    {data.predictive_forecast.capacity_status}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      data.predictive_forecast.capacity_status === "critical" ? "bg-red-500" :
                      data.predictive_forecast.capacity_status === "high" ? "bg-amber-500" :
                      data.predictive_forecast.capacity_status === "manageable" ? "bg-blue-500" : "bg-emerald-500"
                    )}
                    style={{
                      width: `${
                        data.predictive_forecast.capacity_status === "critical" ? 95 :
                        data.predictive_forecast.capacity_status === "high" ? 75 :
                        data.predictive_forecast.capacity_status === "manageable" ? 50 : 25
                      }%`
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-violet-300 pl-3">
                {data.predictive_forecast.recommendation}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
