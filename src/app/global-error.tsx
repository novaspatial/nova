'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/observability/report'

/**
 * The last-resort boundary: it catches failures in the root layout
 * itself, which `error.tsx` cannot — those are the ones that render a
 * blank page, so they are exactly the ones worth reporting. It replaces
 * the whole document, hence its own <html>/<body>, and it cannot use the
 * app's layout, fonts, or Tailwind-styled primitives (the layout is what
 * failed), so the markup here is deliberately minimal and inline-styled.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest ?? null, boundary: 'global' })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: '#18181b',
          color: '#fafafa',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: '1.5rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: '0.5rem', color: '#a1a1aa' }}>
            An unexpected error stopped the page from loading.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: '2rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '9999px',
              border: 0,
              backgroundColor: '#fafafa',
              color: '#18181b',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
