export interface AnalyticsOverview {
  total: number;
  open: number;
  new: number;
  in_progress: number;
  vendor_pending: number;
  awaiting_approval: number;
  escalated: number;
  resolved: number;
  closed: number;
  urgent_count: number;
  sla_breach_count: number;
}

export interface AnalyticsMetrics {
  resolution_rate: number;
  avg_response_time_hours: number;
  avg_resolution_time_days: number;
  sla_compliance_rate: number;
  vendor_response_rate: number;
}

export interface TrendPoint {
  date: string;
  complaints_count: number;
  resolved_count: number;
}

export interface CategoryStat {
  category: string;
  total: number;
  resolved: number;
  resolution_rate: number;
  avg_resolution_days: number;
  sentiment_avg: number;
}

export interface PlantStat {
  plant: string;
  total: number;
  resolved: number;
  in_progress: number;
  pending: number;
}

export interface ShiftCell {
  day: string;
  shift_period: string;
  count: number;
  top_category: string;
}

export interface VendorPerf {
  vendor_id: number;
  vendor_name: string;
  vendor_phone: string;
  cases_assigned: number;
  cases_resolved: number;
  avg_response_time_hours: number;
  sla_breaches: number;
  reliability_score: number;
  color_band: "green" | "amber" | "red";
}

export interface SentimentData {
  overall_score: number;
  overall_label: "positive" | "neutral" | "negative";
  trend: "improving" | "stable" | "declining";
  by_category: { category: string; score: number; label: string }[];
  by_plant: { plant: string; score: number; label: string }[];
  trending_keywords: { word: string; count: number }[];
  at_risk_departments: {
    department: string; plant: string; sla_rate: number;
    backlog_age_days: number; backlog_count: number;
  }[];
}

export interface Anomaly {
  id: string;
  type: string;
  category: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
  detected_at: string;
}

export interface RootCause {
  title: string;
  confidence: number;
  complaint_count: number;
  severity: "low" | "medium" | "high" | "critical";
  suggested_action: string;
  categories_involved: string[];
}

export interface AIInsights {
  category_matrix: {
    category: string;
    avg_resolution_days: number;
    sla_breach_rate: number;
    sentiment_score: number;
    volume_trend: "up" | "down" | "stable";
  }[];
  smart_insights: { message: string; type: "pattern" | "warning" | "info" }[];
  predictive_forecast: {
    expected_min: number;
    expected_max: number;
    capacity_status: "low" | "manageable" | "high" | "critical";
    recommendation: string;
  } | null;
}

export type DateRange = "live" | "today" | "7d" | "30d" | "custom";
export type Granularity = "day" | "week" | "month";
