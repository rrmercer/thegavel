import { createHash, timingSafeEqual } from 'crypto'
import { supabase } from './lib/supabase'

// TODO: extract to lib/validate.ts when a shared validation module is introduced (S3)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

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

  const { pollId, ownerToken } = body as { pollId: unknown; ownerToken: unknown }

  if (!isValidUUID(pollId)) {
    return Response.json({ error: 'pollId must be a valid UUID' }, { status: 400 })
  }

  if (!isValidUUID(ownerToken)) {
    return Response.json({ error: 'ownerToken must be a valid UUID' }, { status: 400 })
  }

  // Fetch the stored hash — select only what we need, never expose the hash to the caller
  const { data: poll, error: fetchError } = await supabase
    .from('polls')
    .select('owner_token_hash')
    .eq('id', pollId)
    .single()

  if (fetchError || !poll) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  // Use timingSafeEqual to prevent timing-based enumeration of valid tokens
  const providedHash = createHash('sha256').update(ownerToken).digest()
  const storedHash = Buffer.from(poll.owner_token_hash, 'hex')

  const tokensMatch =
    providedHash.length === storedHash.length && timingSafeEqual(providedHash, storedHash)

  if (!tokensMatch) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Delete in dependency order: votes → options → poll
  // (Do not rely on CASCADE being configured on the DB)
  const { error: votesError } = await supabase.from('votes').delete().eq('poll_id', pollId)
  if (votesError) {
    return Response.json({ error: 'Failed to delete poll' }, { status: 500 })
  }

  const { error: optionsError } = await supabase.from('options').delete().eq('poll_id', pollId)
  if (optionsError) {
    return Response.json({ error: 'Failed to delete poll' }, { status: 500 })
  }

  const { error: pollError } = await supabase.from('polls').delete().eq('id', pollId)
  if (pollError) {
    return Response.json({ error: 'Failed to delete poll' }, { status: 500 })
  }

  return Response.json({ success: true }, { status: 200 })
}
