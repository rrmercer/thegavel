import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import handler from '../delete-poll'
import { mockChain, makeRequest } from './helpers'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom } }))

const BASE = 'http://localhost/.netlify/functions/delete-poll'

// Stable UUIDs for tests
const POLL_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OWNER_TOKEN = 'ffffffff-0000-1111-2222-333333333333'
const OWNER_TOKEN_HASH = createHash('sha256').update(OWNER_TOKEN).digest('hex')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('delete-poll', () => {
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

    it('returns 400 when pollId is missing', async () => {
      const res = await handler(makeRequest('POST', BASE, { ownerToken: OWNER_TOKEN }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/pollId/)
    })

    it('returns 400 when pollId is not a UUID', async () => {
      const res = await handler(
        makeRequest('POST', BASE, { pollId: 'not-a-uuid', ownerToken: OWNER_TOKEN }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/pollId/)
    })

    it('returns 400 when ownerToken is missing', async () => {
      const res = await handler(makeRequest('POST', BASE, { pollId: POLL_ID }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/ownerToken/)
    })

    it('returns 400 when ownerToken is not a UUID', async () => {
      const res = await handler(
        makeRequest('POST', BASE, { pollId: POLL_ID, ownerToken: 'bad-token' }),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/ownerToken/)
    })
  })

  describe('database interactions', () => {
    it('returns 404 when poll does not exist', async () => {
      mockFrom.mockReturnValueOnce(
        mockChain({ data: null, error: { message: 'No rows returned', code: 'PGRST116' } }),
      )

      const res = await handler(
        makeRequest('POST', BASE, { pollId: POLL_ID, ownerToken: OWNER_TOKEN }),
      )
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe('not_found')
    })

    it('returns 401 when ownerToken does not match', async () => {
      const WRONG_TOKEN = '11111111-2222-3333-4444-555555555555'
      mockFrom.mockReturnValueOnce(
        mockChain({ data: { owner_token_hash: OWNER_TOKEN_HASH }, error: null }),
      )

      const res = await handler(
        makeRequest('POST', BASE, { pollId: POLL_ID, ownerToken: WRONG_TOKEN }),
      )
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('unauthorized')
    })

    it('returns 200 and deletes votes, options, and poll on valid token', async () => {
      mockFrom
        .mockReturnValueOnce(
          mockChain({ data: { owner_token_hash: OWNER_TOKEN_HASH }, error: null }),
        ) // fetch poll
        .mockReturnValueOnce(mockChain({ error: null })) // delete votes
        .mockReturnValueOnce(mockChain({ error: null })) // delete options
        .mockReturnValueOnce(mockChain({ error: null })) // delete poll

      const res = await handler(
        makeRequest('POST', BASE, { pollId: POLL_ID, ownerToken: OWNER_TOKEN }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      // Verify all four DB calls were made (fetch + 3 deletes)
      expect(mockFrom).toHaveBeenCalledTimes(4)
      expect(mockFrom).toHaveBeenNthCalledWith(1, 'polls')
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'votes')
      expect(mockFrom).toHaveBeenNthCalledWith(3, 'options')
      expect(mockFrom).toHaveBeenNthCalledWith(4, 'polls')
    })

    it('returns 500 if votes delete fails', async () => {
      mockFrom
        .mockReturnValueOnce(
          mockChain({ data: { owner_token_hash: OWNER_TOKEN_HASH }, error: null }),
        )
        .mockReturnValueOnce(mockChain({ error: { message: 'DB error' } })) // votes delete fails

      const res = await handler(
        makeRequest('POST', BASE, { pollId: POLL_ID, ownerToken: OWNER_TOKEN }),
      )
      expect(res.status).toBe(500)
    })

    it('returns 500 if options delete fails', async () => {
      mockFrom
        .mockReturnValueOnce(
          mockChain({ data: { owner_token_hash: OWNER_TOKEN_HASH }, error: null }),
        )
        .mockReturnValueOnce(mockChain({ error: null })) // votes delete succeeds
        .mockReturnValueOnce(mockChain({ error: { message: 'DB error' } })) // options delete fails

      const res = await handler(
        makeRequest('POST', BASE, { pollId: POLL_ID, ownerToken: OWNER_TOKEN }),
      )
      expect(res.status).toBe(500)
    })

    it('returns 500 if poll delete fails', async () => {
      mockFrom
        .mockReturnValueOnce(
          mockChain({ data: { owner_token_hash: OWNER_TOKEN_HASH }, error: null }),
        )
        .mockReturnValueOnce(mockChain({ error: null })) // votes delete
        .mockReturnValueOnce(mockChain({ error: null })) // options delete
        .mockReturnValueOnce(mockChain({ error: { message: 'DB error' } })) // poll delete fails

      const res = await handler(
        makeRequest('POST', BASE, { pollId: POLL_ID, ownerToken: OWNER_TOKEN }),
      )
      expect(res.status).toBe(500)
    })
  })
})
