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

// Charge currency. D3: list prices and the per-song floor are natively USD.
// Stored on the project as the currency the customer was charged.
export type Currency = 'usd' | 'cad'

// Paid order add-ons (#19): an extra revision round and a 48-hour rush.
export type AddOn = 'extra_revision' | 'rush_48h'

// Canadian province/territory postal abbreviations — the place-of-supply key
// for GST/HST (D2, 2026-07-13). The DB CHECK on projects.buyer_province
// mirrors this list.
export type CAProvince =
  | 'AB'
  | 'BC'
  | 'MB'
  | 'NB'
  | 'NL'
  | 'NS'
  | 'NT'
  | 'NU'
  | 'ON'
  | 'PE'
  | 'QC'
  | 'SK'
  | 'YT'

// Order-form billing country. Matches the DB CHECK on projects.buyer_country.
export type BuyerCountry = 'CA' | 'US' | 'OTHER'

// Billing location collected at checkout (#31). Feeds the pricing module's
// GST/HST computation and is persisted on the order row.
export interface BuyerLocation {
  country: BuyerCountry
  // Required (route-validated) when country === 'CA'; null/ignored otherwise.
  province?: CAProvince | null
}

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

  // Order columns — live in DB since migration 20260702 (S1 #16). Nullable:
  // rows created before the priced checkout have no order fields.
  song_count: number | null
  stem_count: number | null
  subtotal_cents: number | null
  reference_tracks: string | null

  // T&C consent — live in DB since migration 20260704 (S7 #23). Captured at
  // checkout; nullable for rows created before consent capture existed.
  terms_accepted_at: string | null
  terms_version: string | null

  // Tax + buyer location — live in DB since migration 20260713 (S21 #31; D2:
  // GST/HST computed in-module from the billing country + province collected
  // at checkout). Null = created before tax existed (charge contained no
  // tax); 0 = computed, zero-rated (non-CA buyer).
  tax_cents: number | null
  buyer_country: BuyerCountry | null
  buyer_province: CAProvince | null

  // Redeemed discount code — live in DB since migration 20260713 (S4b #25).
  // The normalized code the charge was priced with ('WELCOME' or a catalog
  // code); null for no-code orders and pre-#25 rows. Distinct from
  // discount_applied, which still means the first-mix flag was reserved.
  applied_coupon_code: string | null

  // Order add-ons — live in DB since migration 20260724 (S6 #19). Null =
  // created before add-ons existed; [] = post-#19 order with none selected.
  // Stored de-duplicated in canonical order (extra_revision, rush_48h).
  add_ons: AddOn[] | null

  // Lifecycle surface the purge slice will add. Declared optional + nullable
  // so current `select *` reads (whose rows lack these columns) stay
  // type-safe; each column lands in its owning slice.
  delivered_at?: string | null // final-masters delivery, drives 90-day purge (#27)
  files_purged_at?: string | null
}

export type DiscountKind = 'percent' | 'fixed'

// A redeemable discount code — lives in DB since migration 20260704 (#17
// admin CRUD; #25 wires checkout redemption; #26 consumes per D6).
// is_public maps to the pricing CodeScope: public stacks with bulk, private
// suppresses it. Returning-vs-new eligibility semantics are D5.
export interface DiscountCode {
  id: string
  code: string
  kind: DiscountKind
  value: number // percent: whole percent (15 = 15%); fixed: amount in cents
  is_public: boolean
  single_use: boolean
  usage_limit: number | null
  new_clients_only: boolean
  returning_clients_only: boolean
  active: boolean
  expires_at: string | null
  // Consumption counters + the below-floor override — live in DB since
  // migration 20260715 (#26). reserved_count = checkout holds not yet
  // finalized; redeemed_count = consumed on confirmed payment (D6).
  // Capacity = single_use ? 1 : usage_limit (null = unlimited).
  // allow_below_floor (D-floor-private) is private-only by DB CHECK and
  // set at creation only.
  reserved_count: number
  redeemed_count: number
  allow_below_floor: boolean
  created_by: string
  created_at: string
  updated_at: string
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
  tax_cents: number // GST/HST on the subtotal per D2 (#31); 0 when untaxed
  tax_rate_pct: number // whole percent applied; 0 when untaxed
  tax_label: string | null // render-ready, e.g. 'HST (13%)' / 'GST (5%)'
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
