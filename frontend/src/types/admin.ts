import type { Category, ComplaintStatus, Priority } from "./complaint";

export interface ComplaintListItem {
  id: number;
  reference_id: string;
  category: Category;
  status: ComplaintStatus;
  priority: Priority;
  plant: string;
  submitter_name: string;
  submitter_employee_id: string;
  description: string;
  ai_classification: string | null;
  created_at: string;
  updated_at: string;
  attachment_count: number;
}

export interface ComplaintsListResponse {
  items: ComplaintListItem[];
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  page: number;
  pages: number;
}

export interface AuditLog {
  id: number;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ComplaintDetail {
  id: number;
  reference_id: string;
  tracking_token: string;
  category: Category;
  status: ComplaintStatus;
  priority: Priority;
  plant: string;
  submitter_name: string;
  submitter_employee_id: string;
  submitter_email: string | null;
  submitter_phone: string | null;
  description: string;
  category_data: Record<string, unknown> | null;
  ai_classification: string | null;
  ai_priority: string | null;
  ai_sentiment: number | null;
  assigned_admin_id: number | null;
  assigned_vendor_id: number | null;
  created_at: string;
  updated_at: string;
  attachments: { id: number; file_name: string; file_url: string; file_type: string; file_size_mb: number }[];
  audit_logs: AuditLog[];
}
