import type { AddOn } from '@/types/portal'
import { ADD_ON_VALUES, MAX_SONG_COUNT } from '@/lib/stripe/pricing'
import { CODE_PATTERN } from '@/lib/portal/orderDiscount'

// Deep-link contract from the homepage calculator (#30):
//   /portal/new?songs=4&addons=extra_revision,rush_48h&code=WELCOME
// Parsed server-side in the page (the params survive the login redirect via
// middleware's ?next=). Everything here is a *prefill* — checkout re-validates
// all of it — so invalid values are dropped silently, never surfaced. The
// form consumes all three params since #19 wired add-on purchases in.

export interface NewProjectParams {
  songCount?: number
  addOns: AddOn[]
  code?: string
}

type RawSearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseNewProjectParams(
  searchParams: RawSearchParams,
): NewProjectParams {
  const result: NewProjectParams = { addOns: [] }

  const songsRaw = first(searchParams.songs)?.trim()
  if (songsRaw) {
    // Number() (not parseInt) mirrors the form's own parsing.
    const songs = Number(songsRaw)
    if (Number.isInteger(songs) && songs >= 1 && songs <= MAX_SONG_COUNT) {
      result.songCount = songs
    }
  }

  const addonsRaw = first(searchParams.addons)
  if (addonsRaw) {
    result.addOns = [
      ...new Set(
        addonsRaw
          .split(',')
          .map((value) => value.trim())
          .filter((value): value is AddOn =>
            (ADD_ON_VALUES as readonly string[]).includes(value),
          ),
      ),
    ]
  }

  const codeRaw = first(searchParams.code)?.trim().toUpperCase()
  if (codeRaw && CODE_PATTERN.test(codeRaw)) {
    result.code = codeRaw
  }

  return result
}
