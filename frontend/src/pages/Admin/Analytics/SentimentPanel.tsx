import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SentimentData } from "@/types/analytics";

const TREND_ICON = {
  improving: <TrendingUp className="h-3.5 w-3.5" />,
  stable:    <Minus className="h-3.5 w-3.5" />,
  declining: <TrendingDown className="h-3.5 w-3.5" />,
};
const TREND_STYLE = {
  improving: "bg-emerald-50 text-emerald-700 border-emerald-200",
  stable:    "bg-slate-50 text-slate-600 border-slate-200",
  declining: "bg-red-50 text-red-600 border-red-200",
};

export function SentimentPanel({ data }: { data: SentimentData }) {
  const pct = Math.round(((data.overall_score + 1) / 2) * 100);
  const barColor =
    data.overall_score >= 0.2 ? "bg-emerald-500" :
    data.overall_score >= -0.2 ? "bg-amber-400" : "bg-red-500";
  const emoji =
    data.overall_score >= 0.2 ? "😊" :
    data.overall_score >= -0.2 ? "😐" : "😟";

  // Keyword font sizes based on relative frequency
  const maxKwCount = Math.max(...data.trending_keywords.map((k) => k.count), 1);

  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="text-sm font-semibold mb-1">Sentiment &amp; Performance Intelligence</h3>
      <p className="text-xs text-muted-foreground mb-5">Employee mood analysis from complaint descriptions</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Overall Sentiment */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Overall Sentiment</p>
          <div className="flex flex-col items-center text-center">
            <span className="text-5xl mb-2">{emoji}</span>
            <p className="text-3xl font-bold text-foreground">
              {data.overall_score > 0 ? "+" : ""}{data.overall_score}
            </p>
            <div className="w-full mt-3 mb-2">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Distressed</span>
                <span>Neutral</span>
                <span>Positive</span>
              </div>
            </div>
            <span className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize mt-1",
              TREND_STYLE[data.trend]
            )}>
              {TREND_ICON[data.trend]} {data.trend}
            </span>
          </div>
        </div>

        {/* Trending Keywords */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Trending Issues</p>
          {data.trending_keywords.length === 0 ? (
            <p className="text-xs text-muted-foreground">No trending issues detected</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.trending_keywords.map((kw) => {
                const relSize = kw.count / maxKwCount;
                const fontSize = relSize > 0.7 ? "text-sm" : relSize > 0.4 ? "text-xs" : "text-[11px]";
                return (
                  <span
                    key={kw.word}
                    className={cn(
                      "rounded-full bg-violet-50 border border-violet-100 px-2.5 py-1 font-medium text-violet-700",
                      fontSize
                    )}
                  >
                    {kw.word}
                    <span className="ml-1 text-violet-400 text-[10px]">{kw.count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* At-Risk Departments */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">At-Risk Departments</p>
          {data.at_risk_departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <p className="text-xs">No departments at risk</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.at_risk_departments.map((dept) => (
                <div key={dept.department} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{dept.department}</p>
                    <p className="text-[11px] text-muted-foreground">{dept.plant} · {dept.backlog_count} open</p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold border",
                    dept.sla_rate >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    dept.sla_rate >= 50 ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {dept.sla_rate}% SLA
                  </span>
                  {dept.backlog_age_days >= 14 && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
