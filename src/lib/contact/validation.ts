/**
 * Validation for the public contact form (#51).
 *
 * The endpoint is unauthenticated, so this is the only thing standing
 * between the internet and both a database table and an outbound email.
 * Caps bound storage; the header-safety check matters because `subject`
 * and `email` land in the notification mail's Subject and Reply-To.
 */
export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000,
} as const

export type ContactInput = {
  name: string
  email: string
  subject: string | null
  message: string
}

// Deliberately permissive on the local part and strict on shape: one @,
// no whitespace, a dotted domain. Anything stricter rejects valid
// addresses; anything looser lets a header-injection payload through.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

// CR/LF (and NUL) in a value that becomes a mail header is header
// injection; the rest of the C0 range has no business in a form field.
function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value)
}

export function validateContactInput(
  body: unknown,
): { input: ContactInput; error: null } | { input: null; error: string } {
  if (typeof body !== 'object' || body === null) {
    return { input: null, error: 'Invalid request body.' }
  }
  const { name, email, subject, message } = body as Record<string, unknown>

  for (const [label, value] of [
    ['name', name],
    ['email', email],
    ['message', message],
  ] as const) {
    if (typeof value !== 'string' || value.trim() === '') {
      return { input: null, error: 'Name, email, and message are required.' }
    }
    if (label !== 'message' && hasControlChars(value)) {
      return { input: null, error: 'Invalid characters in your details.' }
    }
  }
  if (subject !== undefined && subject !== null && typeof subject !== 'string') {
    return { input: null, error: 'Invalid subject.' }
  }
  if (typeof subject === 'string' && hasControlChars(subject)) {
    return { input: null, error: 'Invalid characters in the subject.' }
  }

  const trimmed = {
    name: (name as string).trim(),
    email: (email as string).trim(),
    subject: typeof subject === 'string' ? subject.trim() : '',
    message: (message as string).trim(),
  }

  if (trimmed.name.length > CONTACT_LIMITS.name) {
    return { input: null, error: 'Name is too long.' }
  }
  if (trimmed.email.length > CONTACT_LIMITS.email) {
    return { input: null, error: 'Email is too long.' }
  }
  if (trimmed.subject.length > CONTACT_LIMITS.subject) {
    return { input: null, error: 'Subject is too long.' }
  }
  if (trimmed.message.length > CONTACT_LIMITS.message) {
    return { input: null, error: 'Message is too long.' }
  }
  if (!EMAIL_PATTERN.test(trimmed.email)) {
    return { input: null, error: 'Enter a valid email address.' }
  }

  return {
    input: { ...trimmed, subject: trimmed.subject || null },
    error: null,
  }
}
