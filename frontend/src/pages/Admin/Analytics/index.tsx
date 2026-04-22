import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, RefreshCw, Sparkles,
  Search, ChevronUp, ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AnalyticsOverview, AnalyticsMetrics, TrendPoint,
  CategoryStat, PlantStat, ShiftCell, VendorPerf,
  SentimentData, Anomaly, RootCause, AIInsights,
  DateRange, Granularity,
} from "@/types/analytics";

import { MetricsRow }      from "./MetricsRow";
import { AnomaliesPanel }  from "./AnomaliesPanel";
import { TrendChart, StatusDonut, CategoryBar, PlantBar, VendorTable, ShiftHeatmap } from "./Charts";
import { RootCauseSection } from "./RootCause";
import { AIInsightsSection } from "./AIInsights";
import { SentimentPanel }  from "./SentimentPanel";

// ── Query helpers ──────────────────────────────────────────────────────────

function useAnalyticsQuery<T>(
  key: string[],
  path: string,
  params: Record<string, string>,
  refetchInterval?: number,
) {
  const search = new URLSearchParams(params).toString();
  return useQuery<T>({
    queryKey: [...key, params],
    queryFn: async () => {
      const res = await api.get<{ data: T }>(`${path}?${search}`);
      return res.data.data;
    },
    staleTime: 30_000,
    refetchInterval,
  });
}

// ── Department table ───────────────────────────────────────────────────────

type SortKey = "category" | "total" | "resolved" | "resolution_rate" | "avg_resolution_days";

function DeptTable({ data }: { data: CategoryStat[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = data
    .filter((d) => d.category.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const v = (sortDir === "asc" ? 1 : -1);
      return ((a[sortKey] as number) - (b[sortKey] as number)) * v;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)
      : <ChevronDown className="h-3 w-3 opacity-20" />;

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Department Performance</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Resolution metrics by category</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="h-8 rounded-lg border bg-white pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {!filtered.length ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No data found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground/60">
                {([
                  { key: "category", label: "Category" },
                  { key: "total", label: "Total" },
                  { key: "resolved", label: "Resolved" },
                  { key: "resolution_rate", label: "Resolution %" },
                  { key: "avg_resolution_days", label: "Avg Days" },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className={cn(
                      "pb-2 font-semibold cursor-pointer select-none",
                      key === "category" ? "text-left" : "text-right"
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label} <SortIcon k={key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.category} className="hover:bg-slate-50/50">
                  <td className="py-2.5 font-medium">{row.category}</td>
                  <td className="py-2.5 text-right">{row.total}</td>
                  <td className="py-2.5 text-right">{row.resolved}</td>
                  <td className="py-2.5 text-right">
                    <span className={cn("rounded-md px-2 py-0.5 font-medium",
                      row.resolution_rate >= 80 ? "bg-emerald-50 text-emerald-700" :
                      row.resolution_rate >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                    )}>
                      {row.resolution_rate}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={cn("rounded-md px-2 py-0.5 font-medium",
                      row.avg_resolution_days <= 2 ? "bg-emerald-50 text-emerald-700" :
                      row.avg_resolution_days <= 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                    )}>
                      {row.avg_resolution_days}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<DateRange>("7d");
  const [isLive, setIsLive]             = useState(false);
  const [granularity, setGranularity]   = useState<Granularity>("day");
  const [aiGenAt, setAiGenAt]           = useState<Date | null>(null);

  const rangeParams = { range };
  const liveInterval = isLive ? 60_000 : undefined;

  const overview  = useAnalyticsQuery<AnalyticsOverview>(["analytics-overview"],  "/api/analytics/overview",  rangeParams, liveInterval);
  const metrics   = useAnalyticsQuery<AnalyticsMetrics>( ["analytics-metrics"],   "/api/analytics/metrics",   rangeParams, liveInterval);
  const trends    = useAnalyticsQuery<TrendPoint[]>(     ["analytics-trends"],     "/api/analytics/trends",    { range, granularity }, liveInterval);
  const byCategory= useAnalyticsQuery<CategoryStat[]>(  ["analytics-by-cat"],     "/api/analytics/by-category", rangeParams);
  const byPlant   = useAnalyticsQuery<PlantStat[]>(     ["analytics-by-plant"],   "/api/analytics/by-plant",  rangeParams);
  const heatmap   = useAnalyticsQuery<ShiftCell[]>(     ["analytics-heatmap"],    "/api/analytics/shift-heatmap", {});
  const vendorPerf= useAnalyticsQuery<VendorPerf[]>(    ["analytics-vendors"],    "/api/analytics/vendor-performance", {});
  const sentiment = useAnalyticsQuery<SentimentData>(   ["analytics-sentiment"],  "/api/analytics/sentiment", rangeParams);
  const anomalies = useAnalyticsQuery<Anomaly[]>(       ["analytics-anomalies"],  "/api/analytics/anomalies", {}, 120_000);

  const rootCause = useQuery<RootCause[]>({
    queryKey: ["analytics-root-cause", range],
    queryFn: async () => {
      const res = await api.get<{ data: RootCause[] }>(`/api/analytics/root-cause?range=${range}`);
      return res.data.data;
    },
    enabled: false,
    staleTime: 3600_000,
  });

  const aiInsights = useQuery<AIInsights>({
    queryKey: ["analytics-ai-insights", range],
    queryFn: async () => {
      const res = await api.get<{ data: AIInsights }>(`/api/analytics/ai-insights?range=${range}`);
      return res.data.data;
    },
    enabled: false,
    staleTime: 3600_000,
  });

  const handleRunAI = useCallback(() => {
    rootCause.refetch();
    aiInsights.refetch();
    setAiGenAt(new Date());
  }, [rootCause, aiInsights]);

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["analytics-overview"] });
    qc.invalidateQueries({ queryKey: ["analytics-metrics"] });
    qc.invalidateQueries({ queryKey: ["analytics-trends"] });
    qc.invalidateQueries({ queryKey: ["analytics-by-cat"] });
    qc.invalidateQueries({ queryKey: ["analytics-by-plant"] });
    qc.invalidateQueries({ queryKey: ["analytics-sentiment"] });
    qc.invalidateQueries({ queryKey: ["analytics-anomalies"] });
  };

  const isLoadingCore = overview.isLoading || metrics.isLoading;

  return (
    <div className="flex flex-col h-full bg-[#F7F8FA]">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b px-8 pt-7 pb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time insights · Predictive intelligence · Management dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Live toggle */}
            <button
              onClick={() => setIsLive((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                isLive ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white text-muted-foreground hover:bg-muted/40"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", isLive ? "bg-emerald-500 animate-pulse" : "bg-gray-300")} />
              Live
            </button>

            {/* Date range */}
            <div className="flex gap-1 rounded-lg border bg-white p-1">
              {(["today","7d","30d"] as DateRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                    range === r ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r === "today" ? "Today" : r === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            {/* Run AI */}
            <button
              onClick={handleRunAI}
              disabled={rootCause.isFetching || aiInsights.isFetching}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {rootCause.isFetching || aiInsights.isFetching
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5" />
              }
              Run AI Analysis
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-auto px-8 py-6 space-y-5">

        {/* Anomalies */}
        {anomalies.data && anomalies.data.length > 0 && (
          <AnomaliesPanel anomalies={anomalies.data} />
        )}

        {/* Metrics row */}
        {isLoadingCore ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics...
          </div>
        ) : overview.data && metrics.data ? (
          <MetricsRow overview={overview.data} metrics={metrics.data} />
        ) : null}

        {/* Trend chart */}
        {trends.data && (
          <TrendChart
            data={trends.data}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
        )}

        {/* Status donut + Category bar */}
        {overview.data && byCategory.data && (
          <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: "2fr 3fr" }}>
            <StatusDonut overview={overview.data as unknown as Record<string, number>} />
            <CategoryBar data={byCategory.data} />
          </div>
        )}

        {/* Plant bar + Vendor table */}
        {byPlant.data && vendorPerf.data && (
          <div className="grid grid-cols-2 gap-4">
            <PlantBar data={byPlant.data} />
            <VendorTable data={vendorPerf.data} />
          </div>
        )}

        {/* Shift heatmap */}
        {heatmap.data && <ShiftHeatmap data={heatmap.data} />}

        {/* Dept performance table */}
        {byCategory.data && <DeptTable data={byCategory.data} />}

        {/* Anomalies panel (no items = hidden) */}

        {/* Root cause */}
        <RootCauseSection
          data={rootCause.data ?? null}
          isLoading={rootCause.isFetching}
          onRun={handleRunAI}
        />

        {/* AI insights */}
        <AIInsightsSection
          data={aiInsights.data ?? null}
          isLoading={aiInsights.isFetching}
          onRun={handleRunAI}
          generatedAt={aiGenAt}
        />

        {/* Sentiment */}
        {sentiment.data && <SentimentPanel data={sentiment.data} />}
      </div>
    </div>
  );
}
