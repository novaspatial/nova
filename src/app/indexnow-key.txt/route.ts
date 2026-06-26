/**
 * Serves the IndexNow verification key at `/indexnow-key.txt`.
 *
 * IndexNow requires the key to be retrievable from the host that owns the URLs;
 * we point engines here via `keyLocation` so the key lives in exactly one place
 * (the `INDEXNOW_KEY` env var). Returns 404 when no key is configured, which is
 * the correct signal in dev/preview where pinging is disabled anyway.
 */
export function GET(): Response {
  const key = process.env.INDEXNOW_KEY
  if (!key) {
    return new Response('Not Found', { status: 404 })
  }
  return new Response(key, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
