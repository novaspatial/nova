import { useEffect, useState } from 'react'

const STUDIO_SEEN_KEY = 'studio:seen_projects'
const CLIENT_STATUSES_KEY = 'client:seen_statuses'

function getStudioSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STUDIO_SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function getClientSeenStatuses(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLIENT_STATUSES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function markClientStatusesSeen(
  projects: { id: string; status: string }[],
) {
  try {
    const current = getClientSeenStatuses()
    for (const p of projects) {
      current[p.id] = p.status
    }
    localStorage.setItem(CLIENT_STATUSES_KEY, JSON.stringify(current))
  } catch {
    // ignore storage errors
  }
}

/**
 * Returns the number of projects with updates the user hasn't seen yet.
 * - Studio: unseen in_review projects (same logic as ProjectList).
 * - Client: projects whose status changed since last visit to the portal.
 */
export function useNewProjectCount(enabled = true) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }

    let cancelled = false

    fetch('/api/portal/projects/new-count', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json() as Promise<{
          role: 'studio' | 'client'
          projects: { id: string; status: string }[]
        }>
      })
      .catch(() => null)
      .then((data) => {
        if (cancelled || !data) return

        if (data.role === 'studio') {
          const seen = getStudioSeenIds()
          setCount(data.projects.filter((p) => !seen.has(p.id)).length)
        } else {
          const seenStatuses = getClientSeenStatuses()
          const unseen = data.projects.filter((p) => {
            const lastSeen = seenStatuses[p.id]
            // No record means first time — don't count initial "uploading"
            if (lastSeen === undefined) return false
            return lastSeen !== p.status
          })
          setCount(unseen.length)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return count
}
