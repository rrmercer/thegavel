import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { PollSummary } from '../types'

const PAGE_SIZE = 10

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface PageResult {
  page: number
  polls: PollSummary[]
  total: number
}

export function ListPollsView() {
  const [page, setPage] = useState(1)
  // result.page tracks which page was fetched; when it differs from `page`, a fetch is in flight
  const [result, setResult] = useState<PageResult | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .listPolls({ page, limit: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) {
          setError(false)
          setResult({ page: res.page, polls: res.polls, total: res.total })
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => { cancelled = true }
  }, [page])

  const loading = !error && (result === null || result.page !== page)
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1

  return (
    <div className="card">
      <h2>All polls</h2>

      {loading && <p>Loading polls…</p>}

      {error && <p className="error">Failed to load polls.</p>}

      {!loading && !error && result && result.polls.length === 0 && (
        <p>No polls yet. <a href="/">Create the first one!</a></p>
      )}

      {!loading && !error && result && result.polls.length > 0 && (
        <>
          <ul className="polls-list">
            {result.polls.map((poll) => (
              <li key={poll.id}>
                <a
                  className="poll-list-item"
                  href={`/?poll=${poll.id}`}
                >
                  <span className="poll-list-question">{poll.question}</span>
                  <span className="poll-list-meta">
                    {formatDate(poll.created_at)}
                    {' · '}
                    {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                    {poll.is_closed && (
                      <span className="badge-closed">Closed</span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="pagination">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}

      <a href="/">Create a poll</a>
    </div>
  )
}
