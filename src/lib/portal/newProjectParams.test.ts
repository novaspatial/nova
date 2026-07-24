import { describe, expect, test } from 'vitest'
import { parseNewProjectParams } from './newProjectParams'
import { MAX_SONG_COUNT } from '@/lib/stripe/pricing'

describe('parseNewProjectParams', () => {
  test('parses a full calculator deep link', () => {
    expect(
      parseNewProjectParams({
        songs: '4',
        addons: 'extra_revision,rush_48h',
        code: 'WELCOME',
      }),
    ).toEqual({
      songCount: 4,
      addOns: ['extra_revision', 'rush_48h'],
      code: 'WELCOME',
    })
  })

  test('returns an empty prefill for no params', () => {
    expect(parseNewProjectParams({})).toEqual({ addOns: [] })
  })

  test('drops non-integer, out-of-range, and exponent song counts', () => {
    expect(parseNewProjectParams({ songs: '0' }).songCount).toBeUndefined()
    expect(parseNewProjectParams({ songs: '-3' }).songCount).toBeUndefined()
    expect(parseNewProjectParams({ songs: '2.5' }).songCount).toBeUndefined()
    expect(parseNewProjectParams({ songs: 'abc' }).songCount).toBeUndefined()
    expect(
      parseNewProjectParams({ songs: String(MAX_SONG_COUNT + 1) }).songCount,
    ).toBeUndefined()
    // '2e1' is a valid Number (20) — in range, so it is accepted as 20.
    expect(parseNewProjectParams({ songs: '2e1' }).songCount).toBe(20)
    expect(parseNewProjectParams({ songs: String(MAX_SONG_COUNT) }).songCount).toBe(
      MAX_SONG_COUNT,
    )
  })

  test('filters unknown add-ons and de-duplicates', () => {
    expect(
      parseNewProjectParams({
        addons: 'rush_48h,unknown,rush_48h, extra_revision ,',
      }).addOns,
    ).toEqual(['rush_48h', 'extra_revision'])
  })

  test('uppercases the code and rejects values failing the shared pattern', () => {
    expect(parseNewProjectParams({ code: 'welcome' }).code).toBe('WELCOME')
    expect(parseNewProjectParams({ code: ' welcome ' }).code).toBe('WELCOME')
    expect(parseNewProjectParams({ code: 'no' }).code).toBeUndefined()
    expect(parseNewProjectParams({ code: 'bad code!' }).code).toBeUndefined()
    expect(parseNewProjectParams({ code: '-LEADINGDASH' }).code).toBeUndefined()
  })

  test('uses the first value of array-valued params', () => {
    expect(
      parseNewProjectParams({ songs: ['3', '7'], code: ['WELCOME', 'OTHER'] }),
    ).toEqual({ songCount: 3, addOns: [], code: 'WELCOME' })
  })
})
