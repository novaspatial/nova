import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockGlob = vi.fn()

vi.mock('fast-glob', () => ({
  default: (...args: unknown[]) => mockGlob(...args),
}))

describe('loadArticles', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  test('returns an empty list when there are no article pages', async () => {
    mockGlob.mockResolvedValue([])

    const { loadArticles } = await import('./mdx')

    await expect(loadArticles()).resolves.toEqual([])
    expect(mockGlob).toHaveBeenCalledWith('**/page.mdx', {
      cwd: 'src/app/blog',
    })
  })

  test('loads article metadata, shapes hrefs, and sorts descending by date', async () => {
    mockGlob.mockResolvedValue([
      'future-of-web-development/page.mdx',
      'a-short-guide-to-component-naming/page.mdx',
    ])

    vi.doMock('../app/blog/future-of-web-development/page.mdx', () => ({
      article: {
        date: '2025-01-01',
        title: 'Future',
        description: 'Future article',
        author: {
          name: 'Future Author',
          role: 'Writer',
          image: { src: '/future.jpg', width: 1, height: 1 },
        },
      },
    }))

    vi.doMock('../app/blog/a-short-guide-to-component-naming/page.mdx', () => ({
      article: {
        date: '2026-02-01',
        title: 'Naming',
        description: 'Naming article',
        author: {
          name: 'Naming Author',
          role: 'Writer',
          image: { src: '/naming.jpg', width: 1, height: 1 },
        },
      },
    }))

    const { loadArticles } = await import('./mdx')
    const articles = await loadArticles()

    expect(articles).toHaveLength(2)
    expect(articles.map((article) => article.title)).toEqual(['Naming', 'Future'])
    expect(articles.map((article) => article.href)).toEqual([
      '/blog/a-short-guide-to-component-naming',
      '/blog/future-of-web-development',
    ])
    expect(articles[0]?.metadata.title).toBe('Naming')
  })
})
