import { supabase } from './lib/supabase'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const params = new URL(req.url).searchParams

  const rawPage = params.get('page')
  const rawLimit = params.get('limit')

  const page = rawPage !== null ? parseInt(rawPage, 10) : DEFAULT_PAGE
  const limitRequested = rawLimit !== null ? parseInt(rawLimit, 10) : DEFAULT_LIMIT

  if (!Number.isInteger(page) || page < 1) {
    return Response.json({ error: 'page must be a positive integer' }, { status: 400 })
  }

  if (!Number.isInteger(limitRequested) || limitRequested < 1) {
    return Response.json({ error: 'limit must be a positive integer' }, { status: 400 })
  }

  const limit = Math.min(limitRequested, MAX_LIMIT)
  const offset = (page - 1) * limit

  const { data: polls, error: pollsError, count } = await supabase
    .from('polls')
    .select('id, question, created_at, closes_at', { count: 'exact' })
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (pollsError) {
    return Response.json({ error: 'Failed to fetch polls' }, { status: 500 })
  }

  const pollList = polls ?? []
  const total = count ?? 0

  if (pollList.length === 0) {
    return Response.json({ polls: [], total, page, limit })
  }

  const pollIds = pollList.map((p) => p.id)

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('poll_id')
    .in('poll_id', pollIds)

  if (votesError) {
    return Response.json({ error: 'Failed to fetch vote counts' }, { status: 500 })
  }

  const voteCountByPollId = (votes ?? []).reduce<Record<string, number>>((acc, v) => {
    acc[v.poll_id] = (acc[v.poll_id] ?? 0) + 1
    return acc
  }, {})

  const now = new Date()

  const result = pollList.map((poll) => ({
    id: poll.id,
    question: poll.question,
    created_at: poll.created_at,
    closes_at: poll.closes_at ?? null,
    is_closed: poll.closes_at ? now > new Date(poll.closes_at) : false,
    totalVotes: voteCountByPollId[poll.id] ?? 0,
  }))

  return Response.json({ polls: result, total, page, limit })
}
