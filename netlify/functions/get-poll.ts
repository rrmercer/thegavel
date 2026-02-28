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
    .select('id, question, created_at')
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

  if (optionsError) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch options' }) }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...poll, options }),
  }
}
