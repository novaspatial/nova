'use client'

import { useRef, useState, useTransition, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer'
import { PortalConfirmDialog } from '@/components/portal'
import { AuthorSelect } from './AuthorSelect'
import { uploadBlogImage } from './uploadBlogImage'
import { slugify } from '@/lib/blog/slug'
import type { BlogPost, BlogPostInput } from '@/lib/blog/types'

type Mode = 'create' | 'edit'

type FormState = {
  title: string
  slug: string
  description: string
  body: string
  author_key: string
  post_date: string
  publishedAt: string | null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function initialFromPost(post?: BlogPost): FormState {
  if (!post) {
    return {
      title: '',
      slug: '',
      description: '',
      body: '',
      author_key: '',
      post_date: todayIso(),
      publishedAt: null,
    }
  }
  return {
    title: post.title,
    slug: post.slug,
    description: post.description,
    body: post.body,
    author_key: post.author_key,
    post_date: post.post_date,
    publishedAt: post.published_at,
  }
}

export function BlogPostEditor({
  mode,
  initial,
}: {
  mode: Mode
  initial?: BlogPost
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => initialFromPost(initial))
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const mdInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  function onTitleChange(e: ChangeEvent<HTMLInputElement>) {
    const title = e.target.value
    update({
      title,
      slug: slugTouched ? form.slug : slugify(title),
    })
  }

  function onSlugChange(e: ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true)
    update({ slug: slugify(e.target.value) })
  }

  function insertAtCursor(text: string) {
    const ta = bodyRef.current
    if (!ta) {
      update({ body: form.body + text })
      return
    }
    const start = ta.selectionStart ?? form.body.length
    const end = ta.selectionEnd ?? start
    const next = form.body.slice(0, start) + text + form.body.slice(end)
    update({ body: next })
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + text.length
      ta.setSelectionRange(pos, pos)
    })
  }

  async function onMarkdownFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    update({ body: text })
  }

  async function onImageFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    const result = await uploadBlogImage(file)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    const alt = file.name.replace(/\.[^.]+$/, '')
    insertAtCursor(`\n\n![${alt}](${result.url})\n\n`)
  }

  function buildPayload(opts: { publish?: boolean; unpublish?: boolean }): BlogPostInput | null {
    if (!form.title.trim()) {
      setError('Title is required.')
      return null
    }
    if (!form.slug.trim()) {
      setError('Slug is required.')
      return null
    }
    if (!form.description.trim()) {
      setError('Description is required.')
      return null
    }
    if (!form.author_key) {
      setError('Pick an author.')
      return null
    }
    if (!form.body.trim()) {
      setError('Body cannot be empty.')
      return null
    }

    let published_at: string | null = form.publishedAt
    if (opts.publish) published_at = new Date().toISOString()
    if (opts.unpublish) published_at = null

    return {
      title: form.title.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      body: form.body,
      author_key: form.author_key,
      post_date: form.post_date,
      published_at,
    }
  }

  async function submit(
    payload: BlogPostInput,
    opts: { redirectTo?: string } = {},
  ) {
    setError(null)
    setBusy(true)
    try {
      const url =
        mode === 'create'
          ? '/api/blog/admin/blog/posts'
          : `/api/blog/admin/blog/posts/${initial!.id}`
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `Request failed (${res.status})`)
      }
      update({ publishedAt: payload.published_at })
      if (opts.redirectTo) {
        startTransition(() => {
          router.push(opts.redirectTo!)
          router.refresh()
        })
        return
      }
      if (mode === 'create') {
        const data = (await res.json().catch(() => ({}))) as { id?: string }
        if (data.id) {
          startTransition(() => {
            router.replace(`/blog/admin/blog/${data.id}/edit`)
            router.refresh()
          })
          return
        }
      }
      startTransition(() => {
        router.refresh()
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  function onSaveDraft() {
    const payload = buildPayload({ unpublish: true })
    if (payload) void submit(payload)
  }
  function onPublish() {
    const payload = buildPayload({ publish: true })
    if (payload) void submit(payload, { redirectTo: '/blog' })
  }
  function onUnpublish() {
    const payload = buildPayload({ unpublish: true })
    if (payload) void submit(payload)
  }

  async function onDeleteConfirmed() {
    if (mode !== 'edit' || !initial) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/blog/admin/blog/posts/${initial.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `Delete failed (${res.status})`)
      }
      setConfirmDelete(false)
      startTransition(() => {
        router.push('/blog/admin/blog')
        router.refresh()
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  const isPublished = form.publishedAt !== null
  const disabled = busy || isPending

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {mode === 'create' ? 'New post' : 'Edit post'}
          </h1>
        </div>
        <Link
          href={mode === 'edit' ? '/blog/admin/blog' : '/blog'}
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
        >
          ← {mode === 'edit' ? 'Edit Blog' : 'Blog'}
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-12">
        <Field label="Title" className="sm:col-span-6">
          <input
            type="text"
            value={form.title}
            onChange={onTitleChange}
            disabled={disabled}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
          />
        </Field>
        <Field label="Author" className="sm:col-span-6">
          <AuthorSelect
            value={form.author_key}
            onChange={(slug) => update({ author_key: slug })}
          />
        </Field>
        <Field label="Date" className="sm:col-span-3">
          <input
            type="date"
            value={form.post_date}
            onChange={(e) => update({ post_date: e.target.value })}
            disabled={disabled}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
          />
        </Field>
        <Field label="Markdown tools" className="sm:col-span-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => mdInputRef.current?.click()}
              disabled={disabled}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Upload .md
            </button>
            <input
              ref={mdInputRef}
              type="file"
              accept=".md,text/markdown"
              onChange={onMarkdownFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={disabled}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Insert image
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={onImageFile}
              className="hidden"
            />
          </div>
        </Field>
        <Field label="Description" className="sm:col-span-6">
          <textarea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/40"
          />
        </Field>
        {mode === 'create' && (
          <Field label="Slug" hint="URL: /blog/<slug>" className="sm:col-span-12">
            <input
              type="text"
              value={form.slug}
              onChange={onSlugChange}
              disabled={disabled}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-400/40"
            />
          </Field>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Body
          </label>
          <textarea
            ref={bodyRef}
            value={form.body}
            onChange={(e) => update({ body: e.target.value })}
            disabled={disabled}
            rows={28}
            spellCheck
            className="block h-[40rem] w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm leading-6 text-white outline-none focus:border-violet-400/40"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Preview
          </label>
          <div className="h-[40rem] overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/50 p-4">
            {form.body.trim() ? (
              <MarkdownRenderer>{form.body}</MarkdownRenderer>
            ) : (
              <p className="text-sm text-zinc-500">Preview appears here.</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {isPublished ? (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={disabled}
              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              disabled={disabled}
              className="rounded-xl bg-linear-to-r from-emerald-600 via-emerald-500 to-teal-400 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              Publish
            </button>
          )}
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={disabled}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            Save draft
          </button>
        </div>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={disabled}
            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      <PortalConfirmDialog
        isOpen={confirmDelete}
        title="Delete this post?"
        description="This permanently removes the post. Images uploaded for it stay in storage."
        confirmLabel="Delete"
        busyLabel="Deleting…"
        tone="danger"
        isBusy={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDeleteConfirmed}
      />
    </div>
  )
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {label}
        {hint && (
          <span className="text-[10px] font-normal normal-case text-zinc-600">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  )
}
