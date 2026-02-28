import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Poll } from '../types'
import { ResultsView } from './ResultsView'
import { PollNotFound } from './PollNotFound'

interface Props {
  pollId: string
  fingerprint: string
  onVoted: (pollId: string) => void
}

export function PollView({ pollId, fingerprint, onVoted }: Props) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  useEffect(() => {
    api.getPoll(pollId)
      .then(setPoll)
      .catch(() => setNotFound(true))
  }, [pollId])

  async function handleVote() {
    if (!selectedOptionId || submitting) return
    setSubmitting(true)
    setVoteError(null)
    try {
      await api.castVote({ pollId, optionId: selectedOptionId, voterFingerprint: fingerprint })
      onVoted(pollId)
      setVoted(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'already_voted') {
        onVoted(pollId)
        setVoted(true)
      } else {
        setVoteError('Something went wrong. Please try again.')
        setSubmitting(false)
      }
    }
  }

  if (notFound) return <PollNotFound />
  if (!poll) return <p>Loading poll…</p>
  if (voted) return <ResultsView pollId={pollId} votedOptionId={selectedOptionId ?? undefined} />

  return (
    <div className="card">
      <h2>{poll.question}</h2>
      <ul className="options-list">
        {poll.options.map((opt) => (
          <li key={opt.id}>
            <label className={`option ${selectedOptionId === opt.id ? 'selected' : ''}`}>
              <input
                type="radio"
                name="poll-option"
                value={opt.id}
                checked={selectedOptionId === opt.id}
                onChange={() => setSelectedOptionId(opt.id)}
              />
              {opt.text}
            </label>
          </li>
        ))}
      </ul>
      {voteError && <p className="error">{voteError}</p>}
      <button onClick={handleVote} disabled={!selectedOptionId || submitting}>
        {submitting ? 'Submitting…' : 'Vote'}
      </button>
    </div>
  )
}
