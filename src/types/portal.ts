export type ProjectStatus =
  | 'uploading'
  | 'processing'
  | 'mixing'
  | 'review'
  | 'revision'
  | 'approved'
  | 'delivered'

export type FileType = 'stem' | 'master_ref' | 'mix' | 'deliverable'

export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export type DeliverableFormat = 'adm_bwf' | 'binaural_wav' | 'dolby_atmos_adm'

export type UserRole = 'client' | 'studio'

export interface Project {
  id: string
  owner_id: string
  title: string
  status: ProjectStatus
  format: 'atmos' | 'binaural' | 'both'
  notes: string | null
  created_at: string
  updated_at: string
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

export interface ProjectComment {
  id: string
  project_id: string
  author_id: string
  body: string
  timestamp_ms: number | null
  parent_id: string | null
  created_at: string
  author?: {
    display_name: string | null
    avatar_url: string | null
    role: UserRole
  }
}

export interface Deliverable {
  id: string
  project_id: string
  file_name: string
  file_size: number
  storage_path: string
  format: DeliverableFormat
  approved_at: string | null
  approved_by: string | null
  created_at: string
}
