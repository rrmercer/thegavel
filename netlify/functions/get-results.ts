import type { Handler } from '@netlify/functions'
import { supabase } from './lib/supabase'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const pollId = event.queryStringParameters?.pollId
  if (!pollId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'pollId is required' }) }
  }

  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('id, question')
    .eq('id', pollId)
    .eq('is_active', true)
    .single()

  if (pollError || !poll) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Poll not found' }) }
  }

  const { data: options, error: optionsError } = await supabase
    .from('options')
    .select('id, text, position')
    .eq('poll_id', pollId)
    .order('position', { ascending: true })

  if (optionsError || !options) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch options' }) }
  }

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('option_id')
    .eq('poll_id', pollId)

  if (votesError) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch votes' }) }
  }

  const totalVotes = votes?.length ?? 0

  // Count votes per option
  const countsByOptionId = (votes ?? []).reduce<Record<string, number>>((acc, v) => {
    acc[v.option_id] = (acc[v.option_id] ?? 0) + 1
    return acc
  }, {})

  const optionsWithResults = options.map((opt) => {
    const voteCount = countsByOptionId[opt.id] ?? 0
    return {
      ...opt,
      voteCount,
      percentage: totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0,
    }
  })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pollId: poll.id,
      question: poll.question,
      totalVotes,
      options: optionsWithResults,
    }),
  }
}
