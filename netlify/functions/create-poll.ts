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

  const { question, options } = body as { question: unknown; options: unknown }

  if (typeof question !== 'string' || question.trim().length === 0 || question.length > 500) {
    return { statusCode: 400, body: JSON.stringify({ error: 'question must be a non-empty string up to 500 characters' }) }
  }

  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > 4 ||
    options.some((o) => typeof o !== 'string' || o.trim().length === 0 || o.length > 200)
  ) {
    return { statusCode: 400, body: JSON.stringify({ error: 'options must be an array of 2–4 non-empty strings up to 200 characters each' }) }
  }

  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .insert({ question: question.trim() })
    .select('id')
    .single()

  if (pollError || !poll) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create poll' }) }
  }

  const optionRows = (options as string[]).map((text, i) => ({
    poll_id: poll.id,
    text: text.trim(),
    position: i,
  }))

  const { error: optionsError } = await supabase.from('options').insert(optionRows)

  if (optionsError) {
    // Best-effort cleanup — delete the orphaned poll
    await supabase.from('polls').delete().eq('id', poll.id)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create options' }) }
  }

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pollId: poll.id }),
  }
}
