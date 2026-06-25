export type HeroImage = { src: string; alt: string }

// Matches a markdown image `![alt](src)` with an optional title, e.g.
// `![alt](src "title")`. `src` stops at the first whitespace or `)`.
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/

// Splits the first markdown image off a post body so it can render once as a
// single-paint hero (instead of the double-painted inline GrayscaleTransitionImage).
// Later images stay inline. Returns the original body untouched when there is none.
export function extractHeroImage(body: string): {
  hero: HeroImage | null
  body: string
} {
  const match = body.match(IMAGE_RE)
  if (!match || match.index === undefined) return { hero: null, body }

  const [full, alt, src] = match
  const next = (
    body.slice(0, match.index) + body.slice(match.index + full.length)
  )
    .replace(/^\s*\n+/, '')
    .replace(/\n{3,}/, '\n\n')

  return { hero: { src, alt: alt ?? '' }, body: next.trimStart() }
}
