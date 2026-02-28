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
    .select('id, question, created_at')
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

  if (optionsError) {
    return Response.json({ error: 'Failed to fetch options' }, { status: 500 })
  }

  return Response.json({ ...poll, options })
}
