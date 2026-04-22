export type Category = "Canteen" | "Locker" | "ESD" | "Transportation";
export type Plant = "P1" | "P2" | "BK";
export type Priority = "normal" | "urgent";
export type ComplaintStatus =
  | "new"
  | "in_progress"
  | "vendor_pending"
  | "awaiting_approval"
  | "escalated"
  | "resolved"
  | "closed";

export interface UploadedFile {
  file_name: string;
  file_url: string;
  file_type: string;
  file_size_mb: number;
}

export interface ComplaintSubmitPayload {
  submitter_name: string;
  submitter_employee_id: string;
  submitter_email?: string;
  submitter_phone?: string;
  plant: Plant;
  category: Category;
  description: string;
  category_data?: Record<string, unknown>;
  attachment_urls?: UploadedFile[];
}

export interface ComplaintSubmitResult {
  reference_id: string;
  tracking_token: string;
  tracking_url: string;
}

export interface TrackingStep {
  key: ComplaintStatus;
  label: string;
  completed: boolean;
  active: boolean;
}

export interface TrackingReply {
  id: number;
  content: string;
  sent_at: string;
}

export interface TrackingData {
  reference_id: string;
  category: Category;
  status: ComplaintStatus;
  priority: Priority;
  plant: string;
  submitted_at: string;
  steps: TrackingStep[];
  reply: TrackingReply | null;
  timeline: { action: string; details: Record<string, unknown>; timestamp: string }[];
  attachments: { file_name: string; file_url: string; file_type: string }[];
}
