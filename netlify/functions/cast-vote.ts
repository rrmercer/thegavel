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

  if (typeof pollId !== 'string' || typeof optionId !== 'string' || typeof voterFingerprint !== 'string') {
    return Response.json(
      { error: 'pollId, optionId, and voterFingerprint are required strings' },
      { status: 400 }
    )
  }

  // Verify the option actually belongs to this poll (prevents cross-poll vote injection)
  const { data: option, error: optionError } = await supabase
    .from('options')
    .select('id')
    .eq('id', optionId)
    .eq('poll_id', pollId)
    .single()

  if (optionError || !option) {
    return Response.json({ error: 'invalid_option' }, { status: 400 })
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
