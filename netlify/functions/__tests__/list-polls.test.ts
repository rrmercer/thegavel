import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../list-polls'
import { mockChain, makeRequest } from './helpers'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom } }))

const BASE = 'http://localhost/.netlify/functions/list-polls'

const POLLS = [
  {
    id: 'poll-1',
    question: 'Favourite colour?',
    created_at: '2026-03-06T12:00:00Z',
    closes_at: null,
  },
  { id: 'poll-2', question: 'Best OS?', created_at: '2026-03-05T10:00:00Z', closes_at: null },
]

const VOTE_COUNTS = [
  { poll_id: 'poll-1', total: 2 },
  { poll_id: 'poll-2', total: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('list-polls', () => {
  describe('method validation', () => {
    it('returns 405 for POST requests', async () => {
      const res = await handler(makeRequest('POST', BASE))
      expect(res.status).toBe(405)
    })

    it('returns 405 for DELETE requests', async () => {
      const res = await handler(makeRequest('DELETE', BASE))
      expect(res.status).toBe(405)
    })
  })

  describe('query parameter validation', () => {
    it('returns 400 when page is not a positive integer', async () => {
      const res = await handler(makeRequest('GET', `${BASE}?page=0`))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/page/)
    })

    it('returns 400 when page is negative', async () => {
      const res = await handler(makeRequest('GET', `${BASE}?page=-1`))
      expect(res.status).toBe(400)
    })

    it('returns 400 when page is not a number', async () => {
      const res = await handler(makeRequest('GET', `${BASE}?page=abc`))
      expect(res.status).toBe(400)
    })

    it('returns 400 when limit is zero', async () => {
      const res = await handler(makeRequest('GET', `${BASE}?limit=0`))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/limit/)
    })

    it('returns 400 when limit is negative', async () => {
      const res = await handler(makeRequest('GET', `${BASE}?limit=-5`))
      expect(res.status).toBe(400)
    })
  })

  describe('default parameters', () => {
    it('uses page=1 and limit=20 when no params are provided', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.page).toBe(1)
      expect(body.limit).toBe(20)
    })
  })

  describe('max limit enforcement', () => {
    it('caps limit at 100 when a larger value is requested', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', `${BASE}?limit=500`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.limit).toBe(100)
    })

    it('uses exactly limit=100 when requested', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', `${BASE}?limit=100`))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.limit).toBe(100)
    })
  })

  describe('successful responses', () => {
    it('returns polls with correct shape', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(200)
      const body = await res.json()

      expect(body.total).toBe(2)
      expect(body.page).toBe(1)
      expect(body.limit).toBe(20)
      expect(body.polls).toHaveLength(2)

      const first = body.polls[0]
      expect(first).toHaveProperty('id')
      expect(first).toHaveProperty('question')
      expect(first).toHaveProperty('created_at')
      expect(first).toHaveProperty('closes_at')
      expect(first).toHaveProperty('is_closed')
      expect(first).toHaveProperty('totalVotes')
    })

    it('returns correct totalVotes per poll', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', BASE))
      const body = await res.json()

      const poll1 = body.polls.find((p: { id: string }) => p.id === 'poll-1')
      const poll2 = body.polls.find((p: { id: string }) => p.id === 'poll-2')
      expect(poll1.totalVotes).toBe(2)
      expect(poll2.totalVotes).toBe(1)
    })

    it('returns totalVotes=0 for polls with no votes', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: [], error: null }))

      const res = await handler(makeRequest('GET', BASE))
      const body = await res.json()

      body.polls.forEach((p: { totalVotes: number }) => {
        expect(p.totalVotes).toBe(0)
      })
    })

    it('returns correct total from the count field', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 42 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', BASE))
      const body = await res.json()
      expect(body.total).toBe(42)
    })

    it('returns the supplied page number in the response', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 50 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', `${BASE}?page=3&limit=10`))
      const body = await res.json()
      expect(body.page).toBe(3)
      expect(body.limit).toBe(10)
    })

    it('returns empty polls array and skips votes query when no polls exist', async () => {
      mockFrom.mockReturnValueOnce(mockChain({ data: [], error: null, count: 0 }))

      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.polls).toEqual([])
      expect(body.total).toBe(0)
      // votes query should not have been called — mockFrom called exactly once
      expect(mockFrom).toHaveBeenCalledTimes(1)
    })
  })

  describe('is_closed computation', () => {
    it('returns is_closed=false when closes_at is null', async () => {
      const polls = [{ ...POLLS[0], closes_at: null }]
      mockFrom
        .mockReturnValueOnce(mockChain({ data: polls, error: null, count: 1 }))
        .mockReturnValueOnce(mockChain({ data: [], error: null }))

      const res = await handler(makeRequest('GET', BASE))
      const body = await res.json()
      expect(body.polls[0].is_closed).toBe(false)
    })

    it('returns is_closed=true when closes_at is in the past', async () => {
      const polls = [{ ...POLLS[0], closes_at: new Date(Date.now() - 1000).toISOString() }]
      mockFrom
        .mockReturnValueOnce(mockChain({ data: polls, error: null, count: 1 }))
        .mockReturnValueOnce(mockChain({ data: [], error: null }))

      const res = await handler(makeRequest('GET', BASE))
      const body = await res.json()
      expect(body.polls[0].is_closed).toBe(true)
    })

    it('returns is_closed=false when closes_at is in the future', async () => {
      const polls = [{ ...POLLS[0], closes_at: new Date(Date.now() + 3_600_000).toISOString() }]
      mockFrom
        .mockReturnValueOnce(mockChain({ data: polls, error: null, count: 1 }))
        .mockReturnValueOnce(mockChain({ data: [], error: null }))

      const res = await handler(makeRequest('GET', BASE))
      const body = await res.json()
      expect(body.polls[0].is_closed).toBe(false)
    })
  })

  describe('owner_token_hash not exposed', () => {
    it('does not include owner_token_hash in any poll object', async () => {
      // Simulate DB returning owner_token_hash (should never reach the response)
      const pollsWithHash = POLLS.map((p) => ({ ...p, owner_token_hash: 'secret-hash' }))
      mockFrom
        .mockReturnValueOnce(mockChain({ data: pollsWithHash, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: VOTE_COUNTS, error: null }))

      const res = await handler(makeRequest('GET', BASE))
      const body = await res.json()

      body.polls.forEach((p: Record<string, unknown>) => {
        expect(p).not.toHaveProperty('owner_token_hash')
      })
    })
  })

  describe('database error handling', () => {
    it('returns 500 when polls fetch fails', async () => {
      mockFrom.mockReturnValueOnce(
        mockChain({ data: null, error: { message: 'DB error' }, count: null }),
      )

      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Failed to fetch polls')
    })

    it('returns 500 when votes fetch fails', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLLS, error: null, count: 2 }))
        .mockReturnValueOnce(mockChain({ data: null, error: { message: 'DB error' } }))

      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe('Failed to fetch vote counts')
    })
  })
})
