import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../create-poll'
import { mockChain, makeRequest } from './helpers'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom } }))

const BASE = 'http://localhost/.netlify/functions/create-poll'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('create-poll', () => {
  describe('method validation', () => {
    it('returns 405 for GET requests', async () => {
      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(405)
    })
  })

  describe('input validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const req = new Request(BASE, {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      })
      const res = await handler(req)
      expect(res.status).toBe(400)
    })

    it('returns 400 for empty question', async () => {
      const res = await handler(makeRequest('POST', BASE, { question: '', options: ['A', 'B'] }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/question/)
    })

    it('returns 400 for question over 500 characters', async () => {
      const res = await handler(
        makeRequest('POST', BASE, { question: 'x'.repeat(501), options: ['A', 'B'] }),
      )
      expect(res.status).toBe(400)
    })

    it('returns 400 for fewer than 2 options', async () => {
      const res = await handler(makeRequest('POST', BASE, { question: 'Q?', options: ['A'] }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/options/)
    })

    it('returns 400 for more than 4 options', async () => {
      const res = await handler(
        makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'B', 'C', 'D', 'E'] }),
      )
      expect(res.status).toBe(400)
    })

    it('returns 400 if an option exceeds 200 characters', async () => {
      const res = await handler(
        makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'x'.repeat(201)] }),
      )
      expect(res.status).toBe(400)
    })

    it('returns 400 if an option is an empty string', async () => {
      const res = await handler(makeRequest('POST', BASE, { question: 'Q?', options: ['A', ''] }))
      expect(res.status).toBe(400)
    })

    it('returns 400 if closes_at is not a string', async () => {
      const res = await handler(
        makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'B'], closes_at: 12345 }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/closes_at/)
    })

    it('returns 400 if closes_at is not a parseable date', async () => {
      const res = await handler(
        makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'B'], closes_at: 'not-a-date' }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/closes_at/)
    })

    it('returns 400 if closes_at is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString()
      const res = await handler(
        makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'B'], closes_at: pastDate }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/future/)
    })
  })

  describe('database interactions', () => {
    it('returns 201 with pollId on success', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: 'new-poll-id' }, error: null })) // polls insert
        .mockReturnValueOnce(mockChain({ error: null })) // options insert

      const res = await handler(
        makeRequest('POST', BASE, { question: 'Lunch?', options: ['Pizza', 'Tacos'] }),
      )
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.pollId).toBe('new-poll-id')
    })

    it('returns 201 when a valid closes_at is provided', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: 'expiring-poll' }, error: null }))
        .mockReturnValueOnce(mockChain({ error: null }))

      const closes_at = new Date(Date.now() + 3_600_000).toISOString()
      const res = await handler(
        makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'B'], closes_at }),
      )
      expect(res.status).toBe(201)
    })

    it('returns 500 if poll insert fails', async () => {
      mockFrom.mockReturnValueOnce(mockChain({ data: null, error: { message: 'DB error' } }))

      const res = await handler(makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'B'] }))
      expect(res.status).toBe(500)
    })

    it('returns 500 if options insert fails and cleans up the poll', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: 'orphan-poll' }, error: null })) // polls insert
        .mockReturnValueOnce(mockChain({ error: { message: 'DB error' } })) // options insert
        .mockReturnValueOnce(mockChain({ error: null })) // cleanup delete

      const res = await handler(makeRequest('POST', BASE, { question: 'Q?', options: ['A', 'B'] }))
      expect(res.status).toBe(500)
      // Cleanup: delete was called for the orphaned poll
      expect(mockFrom).toHaveBeenCalledTimes(3)
    })
  })
})
