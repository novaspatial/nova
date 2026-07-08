import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createChainMock } from '@/test/helpers/supabaseMock'
import { claimProjectPayment } from './paymentClaim'

function makeClient(chain: ReturnType<typeof createChainMock>) {
  return { from: vi.fn(() => chain) } as unknown as SupabaseClient
}

// The compare-and-set fence is a single atomic statement: one from('projects'),
// the paid_at IS NULL guard on the same builder as the update, terminated by
// the returning select. A read-check-then-write regression would call from()
// twice and break these.
function expectAtomicCasWrite(
  client: SupabaseClient,
  chain: ReturnType<typeof createChainMock>,
) {
  const from = client.from as unknown as ReturnType<typeof vi.fn>
  expect(from).toHaveBeenCalledTimes(1)
  expect(chain.update).toHaveBeenCalledTimes(1)
  expect(chain.is).toHaveBeenCalledWith('paid_at', null)
  expect(chain.update.mock.invocationCallOrder[0]).toBeLessThan(
    chain.is.mock.invocationCallOrder[0],
  )
  expect(chain.is.mock.invocationCallOrder[0]).toBeLessThan(
    chain.maybeSingle.mock.invocationCallOrder[0],
  )
}

describe('claimProjectPayment', () => {
  beforeEach(() => vi.clearAllMocks())

  test('advances pending_payment to uploading and stamps paid_at', async () => {
    const chain = createChainMock()
    chain.maybeSingle.mockResolvedValue({
      data: { status: 'uploading' },
      error: null,
    })
    const client = makeClient(chain)
    const result = await claimProjectPayment(client, {
      id: 'proj-1',
      status: 'pending_payment',
    })

    expect(chain.update).toHaveBeenCalledWith({
      status: 'uploading',
      paid_at: expect.any(String),
      updated_at: expect.any(String),
    })
    expect(chain.eq).toHaveBeenCalledWith('id', 'proj-1')
    expectAtomicCasWrite(client, chain)
    expect(result).toEqual({
      claimed: { status: 'uploading' },
      advanced: true,
      error: null,
    })
  })

  test('records paid_at only when the status may not advance', async () => {
    const chain = createChainMock()
    chain.maybeSingle.mockResolvedValue({
      data: { status: 'in_review' },
      error: null,
    })
    const result = await claimProjectPayment(makeClient(chain), {
      id: 'proj-1',
      status: 'in_review',
    })

    expect(chain.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: expect.anything() }),
    )
    expect(result.advanced).toBe(false)
    expect(result.claimed).toEqual({ status: 'in_review' })
  })

  test('reports claimed:null when another writer already set paid_at', async () => {
    const chain = createChainMock()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const result = await claimProjectPayment(makeClient(chain), {
      id: 'proj-1',
      status: 'pending_payment',
    })

    expect(result.claimed).toBeNull()
    expect(result.error).toBeNull()
  })

  test('propagates write errors', async () => {
    const chain = createChainMock()
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    })
    const result = await claimProjectPayment(makeClient(chain), {
      id: 'proj-1',
      status: 'pending_payment',
    })

    expect(result.claimed).toBeNull()
    expect(result.error).toEqual({ message: 'boom' })
  })
})
