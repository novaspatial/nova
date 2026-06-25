import { describe, expect, test } from 'vitest'

import { extractHeroImage } from './extractHeroImage'

describe('extractHeroImage', () => {
  test('strips the first image and returns it as the hero', () => {
    const body = '## Title\n\n![nakota](https://cdn/x.jpg)\n\nBody text.'
    const { hero, body: rest } = extractHeroImage(body)
    expect(hero).toEqual({ src: 'https://cdn/x.jpg', alt: 'nakota' })
    expect(rest).not.toContain('![nakota]')
    expect(rest.startsWith('## Title')).toBe(true)
    expect(rest).toContain('Body text.')
  })

  test('returns a null hero and the unchanged body when there is no image', () => {
    const body = '## Title\n\nNo images here.'
    expect(extractHeroImage(body)).toEqual({ hero: null, body })
  })

  test('only strips the first image; later images stay inline', () => {
    const body = '![one](a.jpg)\n\ntext\n\n![two](b.jpg)'
    const { hero, body: rest } = extractHeroImage(body)
    expect(hero?.src).toBe('a.jpg')
    expect(rest).toContain('![two](b.jpg)')
    expect(rest).not.toContain('![one]')
  })

  test('handles empty alt text', () => {
    expect(extractHeroImage('![](x.jpg)').hero).toEqual({ src: 'x.jpg', alt: '' })
  })

  test('tolerates an optional markdown title on the image', () => {
    expect(extractHeroImage('![a](x.jpg "caption")').hero).toEqual({
      src: 'x.jpg',
      alt: 'a',
    })
  })
})
