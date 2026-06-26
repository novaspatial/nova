import { slugify } from './slug'

// Matches a markdown image `![alt](src)`, capturing the alt text. Mirrors the
// shape used by extractHeroImage; here we only care whether alt is non-empty.
const IMAGE_RE = /!\[([^\]]*)\]\([^)\s]+(?:\s+"[^"]*")?\)/g

/**
 * A slug is clean when it round-trips through `slugify` unchanged — lowercase,
 * hyphen-separated, no spaces/diacritics/punctuation — and is non-empty. This is
 * the same normalisation the editor applies, enforced server-side as a floor.
 */
export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slugify(slug) === slug
}

/**
 * True when the post body contains a markdown image with empty alt text
 * (`![](src)`). Used to reject posts that would render inaccessible images.
 */
export function hasEmptyAltImage(body: string): boolean {
  for (const match of body.matchAll(IMAGE_RE)) {
    if (match[1].trim() === '') return true
  }
  return false
}
