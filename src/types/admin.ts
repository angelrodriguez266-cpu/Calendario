export type AdminContentType =
  | 'letter'
  | 'video'
  | 'audio'
  | 'gallery'
  | 'coupon'
  | 'special';

export type SurpriseStatus = 'draft' | 'scheduled' | 'published';

export type MediaRole =
  | 'primary'
  | 'cover'
  | 'gallery_item'
  | 'attachment_image'
  | 'pdf_document'
  | 'extra';

export type StorageBucketName = 'surprise-media' | 'surprise-documents';

export interface CalendarDayRow {
  id: string;
  day_number: number;
  unlock_at: string;
  created_at: string;
  updated_at: string;
}

export interface SurpriseFileRow {
  id: string;
  surprise_id: string;
  bucket_name: StorageBucketName;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  media_role: MediaRole;
  display_order: number;
  created_at: string;
}

export interface SurpriseFileWithUrl extends SurpriseFileRow {
  signed_url: string | null;
  day_number?: number;
  surprise_title?: string;
}

export interface SurpriseRow {
  id: string;
  calendar_day_id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  content_type: AdminContentType;
  content_data: Record<string, unknown>;
  status: SurpriseStatus;
  created_at: string;
  updated_at: string;
}

export interface AdminDaySummary {
  day_id: string;
  day_number: number;
  unlock_at: string;
  date_label: string;
  surprise: (SurpriseRow & { files_count: number }) | null;
  display_status: 'empty' | SurpriseStatus;
}

export interface AdminDayDetail {
  day: CalendarDayRow;
  surprise: SurpriseRow | null;
  files: SurpriseFileWithUrl[];
}

export interface AdminDashboardStats {
  totalDays: number;
  createdCount: number;
  publishedCount: number;
  scheduledCount: number;
  draftCount: number;
  pendingCount: number;
  nextPublication: {
    day_number: number;
    title: string;
    unlock_at: string;
  } | null;
}

export interface AdminSessionUser {
  uid: string;
  email: string;
}
