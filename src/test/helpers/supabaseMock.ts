import { vi } from 'vitest'

type ChainableMock = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

/**
 * Creates a chainable mock that mimics the Supabase query builder.
 * Call `mockResolvedData(data)` to set the final result of the chain.
 */
export function createChainMock(
  resolvedValue: { data: unknown; error: unknown } = {
    data: null,
    error: null,
  },
): ChainableMock {
  const chain: ChainableMock = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  }

  // Every method returns the chain itself, except single() which resolves
  for (const key of Object.keys(chain) as (keyof ChainableMock)[]) {
    chain[key].mockReturnValue(chain)
  }
  chain.single.mockResolvedValue(resolvedValue)
  // Also make the chain itself thenable for queries without .single()
  Object.assign(chain, {
    then: (resolve: (val: unknown) => void) =>
      resolve(resolvedValue),
  })

  return chain
}

/**
 * Creates a full Supabase client mock with auth + from() + storage.
 */
export function createSupabaseMock({
  user = { id: 'user-1', email: 'test@example.com' },
  fromMocks = {} as Record<string, ChainableMock>,
  storageMocks = {} as Record<
    string,
    {
      createSignedUploadUrl?: ReturnType<typeof vi.fn>
      createSignedUrl?: ReturnType<typeof vi.fn>
      download?: ReturnType<typeof vi.fn>
    }
  >,
}: {
  user?: { id: string; email: string } | null
  fromMocks?: Record<string, ChainableMock>
  storageMocks?: Record<
    string,
    {
      createSignedUploadUrl?: ReturnType<typeof vi.fn>
      createSignedUrl?: ReturnType<typeof vi.fn>
      download?: ReturnType<typeof vi.fn>
    }
  >
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    from: vi.fn((table: string) => {
      if (fromMocks[table]) return fromMocks[table]
      // Default chain that returns null
      return createChainMock({ data: null, error: null })
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        return (
          storageMocks[bucket] || {
            createSignedUploadUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: 'https://storage.example.com/upload' },
              error: null,
            }),
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: 'https://storage.example.com/download' },
              error: null,
            }),
            download: vi.fn().mockResolvedValue({
              data: new Blob(['audio']),
              error: null,
            }),
          }
        )
      }),
    },
  }
}

/**
 * Creates a NextRequest-like object for testing API routes.
 */
export function createMockRequest(
  body?: unknown,
  options: { method?: string; headers?: Record<string, string> } = {},
): Request {
  return new Request('http://localhost:3000/api/test', {
    method: options.method || (body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
