// Shared by the /auth/confirm page and the /api/auth/confirm handler (route
// files can't export extra symbols, so the map lives here).
//
// Closed allowlist mapping each accepted email-verification type to its
// default destination. EmailOtpType's `(string & {})` member makes TypeScript
// accept any string for verifyOtp, so this runtime gate is the real fence.
export const CONFIRM_TYPES = {
  signup: '/portal',
  recovery: '/auth/update-password',
} as const

export type ConfirmType = keyof typeof CONFIRM_TYPES

export function isConfirmType(value: unknown): value is ConfirmType {
  return typeof value === 'string' && value in CONFIRM_TYPES
}
