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

  const { question, options } = body as { question: unknown; options: unknown }

  if (typeof question !== 'string' || question.trim().length === 0 || question.length > 500) {
    return Response.json(
      { error: 'question must be a non-empty string up to 500 characters' },
      { status: 400 }
    )
  }

  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > 4 ||
    options.some((o) => typeof o !== 'string' || o.trim().length === 0 || o.length > 200)
  ) {
    return Response.json(
      { error: 'options must be an array of 2–4 non-empty strings up to 200 characters each' },
      { status: 400 }
    )
  }

  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .insert({ question: question.trim() })
    .select('id')
    .single()

  if (pollError || !poll) {
    return Response.json({ error: 'Failed to create poll' }, { status: 500 })
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
    return Response.json({ error: 'Failed to create options' }, { status: 500 })
  }

  return Response.json({ pollId: poll.id }, { status: 201 })
}
