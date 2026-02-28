import { supabase } from './lib/supabase'

export default async (req: Request) => {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const pollId = new URL(req.url).searchParams.get('pollId')
  if (!pollId) {
    return Response.json({ error: 'pollId is required' }, { status: 400 })
  }

  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('id, question')
    .eq('id', pollId)
    .eq('is_active', true)
    .single()

  if (pollError || !poll) {
    return Response.json({ error: 'Poll not found' }, { status: 404 })
  }

  const { data: options, error: optionsError } = await supabase
    .from('options')
    .select('id, text, position')
    .eq('poll_id', pollId)
    .order('position', { ascending: true })

  if (optionsError || !options) {
    return Response.json({ error: 'Failed to fetch options' }, { status: 500 })
  }

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('option_id')
    .eq('poll_id', pollId)

  if (votesError) {
    return Response.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }

  const totalVotes = votes?.length ?? 0

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

  return Response.json({
    pollId: poll.id,
    question: poll.question,
    totalVotes,
    options: optionsWithResults,
  })
}
