// Consent versioning for the T&C gate (#23). Bump TERMS_VERSION on any material
// change to the terms copy in src/app/terms/page.tsx: the checkout route rejects
// any accepted version that isn't strictly equal to this, forcing re-consent, and
// records this constant (not the client-sent value) on the order row.
//
// Keep TERMS_VERSION and TERMS_LAST_UPDATED in sync when the page copy changes.
export const TERMS_VERSION = '2026-07-04'
export const TERMS_LAST_UPDATED = 'July 4, 2026'
