import { supabase } from './lib/supabase'

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { pollId, optionId, voterFingerprint } = body as {
    pollId: unknown
    optionId: unknown
    voterFingerprint: unknown
  }

  if (
    typeof pollId !== 'string' ||
    typeof optionId !== 'string' ||
    typeof voterFingerprint !== 'string'
  ) {
    return Response.json(
      { error: 'pollId, optionId, and voterFingerprint are required strings' },
      { status: 400 },
    )
  }

  // Verify the option belongs to this poll and fetch the poll's close time in one query.
  // NOTE: There is a known TOCTOU (time-of-check/time-of-use) race between the expiry
  // check below and the vote insert. Under concurrent load a vote could be accepted a few
  // milliseconds after the poll closes. The authoritative guard should be moved to a
  // Postgres trigger or conditional INSERT when stricter enforcement is required.
  const { data: option, error: optionError } = await supabase
    .from('options')
    .select('id, polls!inner(closes_at)')
    .eq('id', optionId)
    .eq('poll_id', pollId)
    .single()

  if (optionError || !option) {
    return Response.json({ error: 'invalid_option' }, { status: 400 })
  }

  const { closes_at } = option.polls as { closes_at: string | null }
  if (closes_at && new Date() > new Date(closes_at)) {
    return Response.json({ error: 'poll_closed' }, { status: 403 })
  }

  const { error: voteError } = await supabase.from('votes').insert({
    poll_id: pollId,
    option_id: optionId,
    voter_fingerprint: voterFingerprint,
  })

  if (voteError) {
    // Postgres unique violation code
    if (voteError.code === '23505') {
      return Response.json({ error: 'already_voted' }, { status: 409 })
    }
    return Response.json({ error: 'Failed to record vote' }, { status: 500 })
  }

  return Response.json({ success: true })
}
