'use client'

import { useState, useRef, useCallback } from 'react'
import {
  ArrowUpTrayIcon,
  DocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

export type FileUploadItem = {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'uploaded' | 'syncing' | 'synced' | 'failed'
  error?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function FileUploadRow({
  item,
  onRemove,
}: {
  item: FileUploadItem
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-3 py-3 sm:gap-4 sm:px-4">
      <DocumentIcon className="size-5 shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-white">{item.file.name}</p>
          <span className="shrink-0 text-xs text-zinc-500">
            {formatFileSize(item.file.size)}
          </span>
        </div>
        {item.status === 'uploading' && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {item.status === 'failed' && item.error && (
          <p className="mt-1 text-xs text-red-300">{item.error}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.status === 'synced' && (
          <CheckCircleIcon className="size-5 text-emerald-400" />
        )}
        {item.status === 'failed' && (
          <ExclamationCircleIcon className="size-5 text-red-400" />
        )}
        {item.status === 'uploading' && (
          <span className="text-xs text-zinc-400">{item.progress}%</span>
        )}
        {(item.status === 'pending' || item.status === 'failed') && (
          <button
            onClick={() => onRemove(item.id)}
            className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white"
          >
            <XMarkIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

export function FileUploader({
  files,
  onFilesAdded,
  onRemove,
  disabled,
}: {
  files: FileUploadItem[]
  onFilesAdded: (files: File[]) => void
  onRemove: (id: string) => void
  disabled?: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length > 0) {
        onFilesAdded(droppedFiles)
      }
    },
    [onFilesAdded, disabled],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      if (selectedFiles.length > 0) {
        onFilesAdded(selectedFiles)
      }
      e.target.value = ''
    },
    [onFilesAdded],
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-all duration-200 sm:py-12',
          disabled
            ? 'cursor-not-allowed border-white/5 bg-white/2 opacity-50'
            : isDragging
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/5',
        )}
      >
        <ArrowUpTrayIcon
          className={clsx(
            'size-8 sm:size-10',
            isDragging ? 'text-violet-400' : 'text-zinc-500',
          )}
        />
        <p className="mt-3 text-sm text-zinc-300 sm:text-base">
          {isDragging
            ? 'Drop files here'
            : 'Drag & drop files or click to browse'}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          WAV, AIFF, FLAC, or other audio formats
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="audio/*,.wav,.aiff,.aif,.flac,.mp3,.ogg,.m4a"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item) => (
            <FileUploadRow key={item.id} item={item} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  )
}
