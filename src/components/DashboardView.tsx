import { useState } from 'react'
import { api } from '../api/client'
import type { PollSummary } from '../types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function DashboardView() {
  const [ownerToken, setOwnerToken] = useState('')
  const [polls, setPolls] = useState<PollSummary[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  async function handleLoad(e: React.FormEvent) {
    e.preventDefault()
    setLoadError(false)
    setPolls(null)
    setDeleteErrors({})
    setLoading(true)
    try {
      const res = await api.listPolls({ limit: 100 })
      setPolls(res.polls)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(pollId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this poll? This action cannot be undone.',
    )
    if (!confirmed) return

    setDeleting((prev) => ({ ...prev, [pollId]: true }))
    setDeleteErrors((prev) => {
      const next = { ...prev }
      delete next[pollId]
      return next
    })

    try {
      await api.deletePoll(pollId, ownerToken)
      setPolls((prev) => prev?.filter((p) => p.id !== pollId) ?? null)
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'unauthorized'
          ? 'Invalid owner token'
          : 'Failed to delete poll. Please try again.'
      setDeleteErrors((prev) => ({ ...prev, [pollId]: message }))
    } finally {
      setDeleting((prev) => {
        const next = { ...prev }
        delete next[pollId]
        return next
      })
    }
  }

  return (
    <div className="card">
      <h2>Creator dashboard</h2>

      <form onSubmit={handleLoad}>
        <label htmlFor="owner-token">Owner token</label>
        <input
          id="owner-token"
          type="text"
          placeholder="Paste the token you received when creating your poll"
          value={ownerToken}
          onChange={(e) => setOwnerToken(e.target.value)}
        />
        <button type="submit" disabled={loading || ownerToken.trim() === ''}>
          {loading ? 'Loading…' : 'Load polls'}
        </button>
      </form>

      <p className="hint">
        All polls are shown. Only polls created with your token can be deleted.
      </p>

      {loadError && <p className="error">Failed to load polls.</p>}

      {polls !== null && polls.length === 0 && <p>No polls found.</p>}

      {polls !== null && polls.length > 0 && (
        <ul className="polls-list">
          {polls.map((poll) => (
            <li key={poll.id}>
              <div className="poll-list-item">
                <span className="poll-list-question">
                  <a href={`/?poll=${poll.id}`}>{poll.question}</a>
                </span>
                <span className="poll-list-meta">
                  {formatDate(poll.created_at)}
                  {poll.closes_at && ` · Closes ${formatDate(poll.closes_at)}`}
                  {' · '}
                  {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
                  {poll.is_closed && <span className="badge-closed">Closed</span>}
                </span>
                <div className="dashboard-poll-actions">
                  <button
                    onClick={() => handleDelete(poll.id)}
                    disabled={deleting[poll.id] ?? false}
                  >
                    {deleting[poll.id] ? 'Deleting…' : 'Delete'}
                  </button>
                  {deleteErrors[poll.id] && <span className="error">{deleteErrors[poll.id]}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <a href="/">Create a poll</a>
    </div>
  )
}
