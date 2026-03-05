import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../get-results'
import { mockChain, makeRequest } from './helpers'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom } }))

const BASE = 'http://localhost/.netlify/functions/get-results'
const pollId = '550e8400-e29b-41d4-a716-446655440000'
const URL_WITH_POLL = `${BASE}?pollId=${pollId}`

const POLL = { id: pollId, question: 'Best language?' }
const OPTIONS = [
  { id: 'opt-1', text: 'TypeScript', position: 0 },
  { id: 'opt-2', text: 'Rust', position: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('get-results', () => {
  describe('method validation', () => {
    it('returns 405 for POST requests', async () => {
      const res = await handler(makeRequest('POST', BASE))
      expect(res.status).toBe(405)
    })
  })

  describe('input validation', () => {
    it('returns 400 when pollId is missing', async () => {
      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/pollId/)
    })
  })

  describe('database interactions', () => {
    it('returns 404 when poll is not found', async () => {
      mockFrom.mockReturnValueOnce(mockChain({ data: null, error: { code: 'PGRST116' } }))

      const res = await handler(makeRequest('GET', URL_WITH_POLL))
      expect(res.status).toBe(404)
    })

    it('returns 500 when options fetch fails', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLL, error: null }))
        .mockReturnValueOnce(mockChain({ data: null, error: { message: 'DB error' } }))

      const res = await handler(makeRequest('GET', URL_WITH_POLL))
      expect(res.status).toBe(500)
    })

    it('returns 500 when votes fetch fails', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLL, error: null }))
        .mockReturnValueOnce(mockChain({ data: OPTIONS, error: null }))
        .mockReturnValueOnce(mockChain({ data: null, error: { message: 'DB error' } }))

      const res = await handler(makeRequest('GET', URL_WITH_POLL))
      expect(res.status).toBe(500)
    })

    it('returns correct vote counts and percentages', async () => {
      const votes = [
        { option_id: 'opt-1' },
        { option_id: 'opt-1' },
        { option_id: 'opt-2' },
      ]
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLL, error: null }))
        .mockReturnValueOnce(mockChain({ data: OPTIONS, error: null }))
        .mockReturnValueOnce(mockChain({ data: votes, error: null }))

      const res = await handler(makeRequest('GET', URL_WITH_POLL))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.totalVotes).toBe(3)
      const ts = body.options.find((o: { text: string }) => o.text === 'TypeScript')
      const rust = body.options.find((o: { text: string }) => o.text === 'Rust')
      expect(ts.voteCount).toBe(2)
      expect(ts.percentage).toBe(67)
      expect(rust.voteCount).toBe(1)
      expect(rust.percentage).toBe(33)
    })

    it('returns 0% for all options when no votes have been cast', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: POLL, error: null }))
        .mockReturnValueOnce(mockChain({ data: OPTIONS, error: null }))
        .mockReturnValueOnce(mockChain({ data: [], error: null }))

      const res = await handler(makeRequest('GET', URL_WITH_POLL))
      const body = await res.json()
      expect(body.totalVotes).toBe(0)
      body.options.forEach((o: { percentage: number }) => expect(o.percentage).toBe(0))
    })
  })
})
