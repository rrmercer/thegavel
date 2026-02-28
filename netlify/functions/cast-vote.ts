import type { Handler } from '@netlify/functions'
import { supabase } from './lib/supabase'

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body: unknown
  try {
    body = JSON.parse(event.body ?? '')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { pollId, optionId, voterFingerprint } = body as {
    pollId: unknown
    optionId: unknown
    voterFingerprint: unknown
  }

  if (typeof pollId !== 'string' || typeof optionId !== 'string' || typeof voterFingerprint !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'pollId, optionId, and voterFingerprint are required strings' }) }
  }

  // Verify the option actually belongs to this poll (prevents cross-poll vote injection)
  const { data: option, error: optionError } = await supabase
    .from('options')
    .select('id')
    .eq('id', optionId)
    .eq('poll_id', pollId)
    .single()

  if (optionError || !option) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_option' }) }
  }

  const { error: voteError } = await supabase.from('votes').insert({
    poll_id: pollId,
    option_id: optionId,
    voter_fingerprint: voterFingerprint,
  })

  if (voteError) {
    // Postgres unique violation code
    if (voteError.code === '23505') {
      return { statusCode: 409, body: JSON.stringify({ error: 'already_voted' }) }
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to record vote' }) }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  }
}
