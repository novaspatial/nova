/**
 * Sanitize a `?next=` redirect target (#56).
 *
 * Every `next` reaching the app is attacker-controllable — it survives from
 * a crafted link through the login page, the signup email, and the auth
 * callback. Only a root-relative path on our own origin is allowed:
 *
 *   - must be a string starting with a single `/` (rejects `//evil.com`,
 *     `https://evil.com`, `javascript:…`, and the host-reparse tricks
 *     `@evil.com`, `.evil.com`, `:8080@evil.com`);
 *   - the second character must not be `/` or `\` (protocol-relative and
 *     the backslash variant browsers normalize to it);
 *   - no C0 control characters — the URL parser strips CR/LF/tab, which
 *     would turn `/\t/evil.com` back into `//evil.com`.
 *
 * Anything that survives is returned verbatim, so query and hash are kept.
 * Used by the auth callback, the signup route, and the login page.
 */
export function safeNextPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback
  if (/^\/[/\\]/.test(value)) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}
