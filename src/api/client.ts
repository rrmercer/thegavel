import type { Poll, PollResults, PollSummary } from '../types'

const BASE = '/.netlify/functions'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return data as T
}

export const api = {
  createPoll: (body: { question: string; options: string[]; closes_at?: string }) =>
    apiFetch<{ pollId: string }>('/create-poll', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getPoll: (pollId: string) => apiFetch<Poll>(`/get-poll?pollId=${pollId}`),

  castVote: (body: { pollId: string; optionId: string; voterFingerprint: string }) =>
    apiFetch<{ success: true }>('/cast-vote', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getResults: (pollId: string) => apiFetch<PollResults>(`/get-results?pollId=${pollId}`),

  listPolls: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.page !== undefined) query.set('page', String(params.page))
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return apiFetch<{ polls: PollSummary[]; total: number; page: number; limit: number }>(
      `/list-polls${qs ? `?${qs}` : ''}`,
    )
  },
}
