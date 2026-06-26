export type ProjectStatus =
  | 'pending_payment'
  | 'uploading'
  | 'in_review'
  | 'processing'
  | 'mixing'
  | 'review'
  | 'revision'
  | 'approved'
  | 'delivered'

export type FileType = 'stem' | 'master_ref' | 'mix' | 'deliverable'

export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export interface FileUploadItem {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'uploaded' | 'syncing' | 'synced' | 'failed'
  error?: string
}

export type DeliverableFormat = 'adm_bwf' | 'binaural_wav' | 'dolby_atmos_adm'

export type UserRole = 'client' | 'studio'

// Charge currency. D3: list prices are USD; CAD is the floor basis at a fixed
// internal rate. Stored on the project as the currency the customer was charged.
export type Currency = 'usd' | 'cad'

// Paid order add-ons (#19): an extra revision round and a 48-hour rush.
export type AddOn = 'extra_revision' | 'rush_48h'

export interface Project {
  id: string
  owner_id: string
  title: string
  status: ProjectStatus
  format: 'atmos' | 'binaural' | 'both'
  notes: string | null
  client_deleted_at: string | null
  studio_deleted_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string

  // Payment columns — live in DB since migration 20260422 (D1: order data
  // stays on the projects row). Present on every row; nullable per the schema.
  stripe_payment_intent_id: string | null
  paid_at: string | null
  amount_cents: number | null
  currency: Currency | null
  discount_applied: boolean

  // Order/lifecycle surface the pricing, checkout, T&C and purge slices will
  // add. Declared optional + nullable so current `select *` reads (whose rows
  // lack these columns) stay type-safe; each column lands in its owning slice.
  song_count?: number | null
  stem_count?: number | null
  service?: string | null // service/tier enum lands with the pricing slice (#16)
  add_ons?: AddOn[] | null
  subtotal_cents?: number | null
  tax_cents?: number | null
  applied_coupon_code?: string | null
  terms_accepted_at?: string | null // T&C accept (#23)
  terms_version?: string | null
  delivered_at?: string | null // final-masters delivery, drives 90-day purge (#27)
  files_purged_at?: string | null
}

export type DiscountKind = 'percent' | 'fixed'

// A redeemable discount code (#17 admin CRUD, #25 checkout redemption).
// Audience/cap/floor interaction (D4/D5) is refined in the pricing slices.
export interface DiscountCode {
  id: string
  code: string
  kind: DiscountKind
  value: number // percent: whole percent (15 = 15%); fixed: amount in cents
  single_use: boolean
  active: boolean
  expires_at: string | null
  created_at: string
}

// Computed quote breakdown produced by the pure pricing module (#22) and
// rendered at checkout (#16). All money in integer cents. Provisional shape
// until D4 fixes the exact cap/floor/stacking order of operations.
export interface PriceBreakdown {
  currency: Currency
  song_count: number
  list_unit_cents: number // per-song list price before any discount
  list_total_cents: number // song_count * list_unit_cents
  bulk_discount_cents: number // automatic album/EP tier (#18)
  code_discount_cents: number // public/private code (#22, #25)
  add_ons_cents: number // extra revision, 48h rush (#19)
  subtotal_cents: number // after discounts + add-ons, cap/floor applied
  tax_cents: number
  total_cents: number
}

export interface ProjectFile {
  id: string
  project_id: string
  file_name: string
  file_size: number
  mime_type: string
  file_type: FileType
  storage_path: string
  upload_status: UploadStatus
  uploaded_by: string
  created_at: string
}

export interface ProjectCommentAttachment {
  id: string
  comment_id: string
  project_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  created_at: string
  view_url?: string | null
  download_url?: string | null
}

export interface ProjectComment {
  id: string
  project_id: string
  track_id: string
  author_id: string
  body: string | null
  timestamp_ms: number | null
  timestamp_end_ms: number | null
  parent_id: string | null
  created_at: string
  author?: {
    display_name: string | null
    avatar_url: string | null
    role: UserRole
  }
  attachments?: ProjectCommentAttachment[]
}

export interface Deliverable {
  id: string
  project_id: string
  file_name: string
  file_size: number
  storage_path: string
  format: DeliverableFormat | null
  approved_at: string | null
  approved_by: string | null
  created_at: string
}
