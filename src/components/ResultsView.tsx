import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { PollResults } from '../types'

interface Props {
  pollId: string
  votedOptionId?: string
}

export function ResultsView({ pollId, votedOptionId }: Props) {
  const [results, setResults] = useState<PollResults | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.getResults(pollId)
      .then(setResults)
      .catch(() => setError(true))
  }, [pollId])

  if (error) return <p>Failed to load results.</p>
  if (!results) return <p>Loading results…</p>

  return (
    <div className="card">
      <h2>{results.question}</h2>
      <p className="total-votes">{results.totalVotes} {results.totalVotes === 1 ? 'vote' : 'votes'} total</p>
      <ul className="results-list">
        {results.options.map((opt) => (
          <li key={opt.id} className={opt.id === votedOptionId ? 'voted' : ''}>
            <div className="result-label">
              <span>{opt.text}{opt.id === votedOptionId ? ' ✓' : ''}</span>
              <span>{opt.percentage}%</span>
            </div>
            <div className="result-bar-track">
              <div className="result-bar-fill" style={{ width: `${opt.percentage}%` }} />
            </div>
            <span className="result-count">{opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'}</span>
          </li>
        ))}
      </ul>
      <a href="/">Create your own poll</a>
    </div>
  )
}
