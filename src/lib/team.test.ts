import { describe, expect, test } from 'vitest'

import { TEAM_MEMBERS, getAuthor } from './team'

describe('team registry', () => {
  test('all team members are exposed with kebab-case slugs', () => {
    expect(TEAM_MEMBERS.map((m) => m.slug)).toEqual([
      'jamie-kuse',
      'spencer-cheyne',
      'will-howie',
      'mike-southworth',
      'daniel-byrne',
      'doug-fury',
      'gabriel-macdonald',
    ])
  })

  test('getAuthor resolves every known slug', () => {
    for (const m of TEAM_MEMBERS) {
      expect(getAuthor(m.slug)?.name).toBe(m.name)
    }
  })

  test('getAuthor returns undefined for unknown slug', () => {
    expect(getAuthor('not-a-real-author')).toBeUndefined()
  })
})
