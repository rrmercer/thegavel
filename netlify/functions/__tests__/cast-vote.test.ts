import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler from '../cast-vote'
import { mockChain, makeRequest } from './helpers'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom } }))

const BASE = 'http://localhost/.netlify/functions/cast-vote'

const VALID_BODY = {
  pollId: '550e8400-e29b-41d4-a716-446655440000',
  optionId: '660e8400-e29b-41d4-a716-446655440001',
  voterFingerprint: 'fp-abc-123',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cast-vote', () => {
  describe('method validation', () => {
    it('returns 405 for GET requests', async () => {
      const res = await handler(makeRequest('GET', BASE))
      expect(res.status).toBe(405)
    })
  })

  describe('input validation', () => {
    it('returns 400 when pollId is missing', async () => {
      const res = await handler(makeRequest('POST', BASE, { optionId: 'x', voterFingerprint: 'fp' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when optionId is missing', async () => {
      const res = await handler(makeRequest('POST', BASE, { pollId: 'x', voterFingerprint: 'fp' }))
      expect(res.status).toBe(400)
    })

    it('returns 400 when voterFingerprint is missing', async () => {
      const res = await handler(makeRequest('POST', BASE, { pollId: 'x', optionId: 'y' }))
      expect(res.status).toBe(400)
    })
  })

  describe('database interactions', () => {
    it('returns 400 when the option does not belong to the poll', async () => {
      mockFrom.mockReturnValueOnce(mockChain({ data: null, error: { code: 'PGRST116' } }))

      const res = await handler(makeRequest('POST', BASE, VALID_BODY))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('invalid_option')
    })

    it('returns 409 when the voter has already voted', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: VALID_BODY.optionId }, error: null })) // option lookup
        .mockReturnValueOnce(mockChain({ data: { closes_at: null }, error: null }))         // poll lookup
        .mockReturnValueOnce(mockChain({ error: { code: '23505' } }))                       // votes insert

      const res = await handler(makeRequest('POST', BASE, VALID_BODY))
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('already_voted')
    })

    it('returns 500 on unexpected DB error when inserting vote', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: VALID_BODY.optionId }, error: null }))
        .mockReturnValueOnce(mockChain({ data: { closes_at: null }, error: null }))         // poll lookup
        .mockReturnValueOnce(mockChain({ error: { code: '500', message: 'DB error' } }))

      const res = await handler(makeRequest('POST', BASE, VALID_BODY))
      expect(res.status).toBe(500)
    })

    it('returns 200 with success on a valid vote', async () => {
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: VALID_BODY.optionId }, error: null }))
        .mockReturnValueOnce(mockChain({ data: { closes_at: null }, error: null }))         // poll lookup
        .mockReturnValueOnce(mockChain({ error: null }))

      const res = await handler(makeRequest('POST', BASE, VALID_BODY))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('returns 403 poll_closed when poll has expired', async () => {
      const pastDate = new Date(Date.now() - 1000).toISOString()
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: VALID_BODY.optionId }, error: null }))
        .mockReturnValueOnce(mockChain({ data: { closes_at: pastDate }, error: null }))

      const res = await handler(makeRequest('POST', BASE, VALID_BODY))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('poll_closed')
    })

    it('returns 200 when poll closes_at is in the future', async () => {
      const futureDate = new Date(Date.now() + 3_600_000).toISOString()
      mockFrom
        .mockReturnValueOnce(mockChain({ data: { id: VALID_BODY.optionId }, error: null }))
        .mockReturnValueOnce(mockChain({ data: { closes_at: futureDate }, error: null }))
        .mockReturnValueOnce(mockChain({ error: null }))

      const res = await handler(makeRequest('POST', BASE, VALID_BODY))
      expect(res.status).toBe(200)
    })
  })
})
