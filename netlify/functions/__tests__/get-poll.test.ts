import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../get-poll'
import { mockChain, makeRequest } from './helpers'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom } }))

const BASE = 'http://localhost/.netlify/functions/get-poll'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('get-poll', () => {
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
    const pollId = '550e8400-e29b-41d4-a716-446655440000'
    const url = `${BASE}?pollId=${pollId}`

    it('returns 404 when poll is not found', async () => {
      mockFrom.mockReturnValueOnce(mockChain({ data: null, error: { code: 'PGRST116' } }))

      const res = await handler(makeRequest('GET', url))
      expect(res.status).toBe(404)
    })

    it('returns 500 when options fetch fails', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: pollId, question: 'Q?', created_at: '2024-01-01' }, error: null }))
        .mockReturnValueOnce(mockChain({ data: null, error: { message: 'DB error' } }))

      const res = await handler(makeRequest('GET', url))
      expect(res.status).toBe(500)
    })

    it('returns 200 with poll and options on success', async () => {
      const poll = { id: pollId, question: 'Lunch?', created_at: '2024-01-01' }
      const options = [
        { id: 'opt-1', text: 'Pizza', position: 0 },
        { id: 'opt-2', text: 'Tacos', position: 1 },
      ]
      mockFrom
        .mockReturnValueOnce(mockChain({ data: poll, error: null }))
        .mockReturnValueOnce(mockChain({ data: options, error: null }))

      const res = await handler(makeRequest('GET', url))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.question).toBe('Lunch?')
      expect(body.options).toHaveLength(2)
      expect(body.options[0].text).toBe('Pizza')
    })
  })
})
