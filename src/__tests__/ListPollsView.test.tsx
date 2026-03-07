import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListPollsView } from '../components/ListPollsView'

const mockListPolls = vi.hoisted(() => vi.fn())
vi.mock('../api/client', () => ({
  api: { listPolls: mockListPolls },
}))

function makePoll(
  overrides: Partial<{
    id: string
    question: string
    created_at: string
    closes_at: string | null
    is_closed: boolean
    totalVotes: number
  }> = {},
) {
  return {
    id: 'poll-1',
    question: 'What is your favourite language?',
    created_at: '2024-01-15T10:00:00Z',
    closes_at: null,
    is_closed: false,
    totalVotes: 42,
    ...overrides,
  }
}

function makeResponse(
  overrides: Partial<{
    polls: ReturnType<typeof makePoll>[]
    total: number
    page: number
    limit: number
  }> = {},
) {
  return {
    polls: [makePoll()],
    total: 1,
    page: 1,
    limit: 10,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ListPollsView', () => {
  it('shows a loading state while the request is in flight', () => {
    mockListPolls.mockReturnValue(new Promise(() => {})) // never resolves
    render(<ListPollsView />)
    expect(screen.getByText(/loading polls/i)).toBeInTheDocument()
  })

  it('shows an error state when the API call fails', async () => {
    mockListPolls.mockRejectedValue(new Error('Network error'))
    render(<ListPollsView />)
    await waitFor(() => expect(screen.getByText(/failed to load polls/i)).toBeInTheDocument())
  })

  it('shows an empty state when no polls exist', async () => {
    mockListPolls.mockResolvedValue(makeResponse({ polls: [], total: 0 }))
    render(<ListPollsView />)
    await waitFor(() => expect(screen.getByText(/no polls yet/i)).toBeInTheDocument())
  })

  it('renders a list of polls with question, vote count, and formatted date', async () => {
    mockListPolls.mockResolvedValue(
      makeResponse({
        polls: [
          makePoll({
            id: 'p1',
            question: 'First question?',
            totalVotes: 5,
            created_at: '2024-03-01T00:00:00Z',
          }),
          makePoll({
            id: 'p2',
            question: 'Second question?',
            totalVotes: 1,
            created_at: '2024-04-20T00:00:00Z',
          }),
        ],
        total: 2,
      }),
    )
    render(<ListPollsView />)

    await waitFor(() => expect(screen.getByText('First question?')).toBeInTheDocument())
    expect(screen.getByText('Second question?')).toBeInTheDocument()
    expect(screen.getByText(/5 votes/)).toBeInTheDocument()
    // singular "vote" — the count and label are separate text nodes inside the span,
    // so match the span element directly by checking its full textContent
    const metaSpans = document.querySelectorAll('.poll-list-meta')
    const hasOneVote = Array.from(metaSpans).some(
      (el) => /\b1 vote\b/.test(el.textContent ?? '') && !/\b1 votes\b/.test(el.textContent ?? ''),
    )
    expect(hasOneVote).toBe(true)
  })

  it('shows a "Closed" badge for polls that are closed', async () => {
    mockListPolls.mockResolvedValue(
      makeResponse({
        polls: [
          makePoll({ id: 'p1', question: 'Open poll?', is_closed: false }),
          makePoll({ id: 'p2', question: 'Closed poll?', is_closed: true }),
        ],
        total: 2,
      }),
    )
    render(<ListPollsView />)

    await waitFor(() => expect(screen.getByText('Closed poll?')).toBeInTheDocument())
    expect(screen.getByText('Closed')).toBeInTheDocument()
    // Only one badge — open poll has none
    expect(screen.getAllByText('Closed')).toHaveLength(1)
  })

  it('does not show a Closed badge for open polls', async () => {
    mockListPolls.mockResolvedValue(makeResponse())
    render(<ListPollsView />)

    await waitFor(() =>
      expect(screen.getByText('What is your favourite language?')).toBeInTheDocument(),
    )
    expect(screen.queryByText('Closed')).not.toBeInTheDocument()
  })

  it('disables the Previous button on the first page', async () => {
    mockListPolls.mockResolvedValue(makeResponse({ total: 25 }))
    render(<ListPollsView />)

    await waitFor(() => expect(screen.getByText(/page 1 of/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
  })

  it('disables the Next button on the last page', async () => {
    // total=5, limit=10 → only 1 page
    mockListPolls.mockResolvedValue(makeResponse({ total: 5 }))
    render(<ListPollsView />)

    await waitFor(() => expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('fetches the next page when Next is clicked', async () => {
    const user = userEvent.setup()

    // First page response
    mockListPolls.mockResolvedValueOnce(
      makeResponse({
        polls: [makePoll({ id: 'p1', question: 'Page 1 poll?' })],
        total: 15,
        page: 1,
      }),
    )
    // Second page response
    mockListPolls.mockResolvedValueOnce(
      makeResponse({
        polls: [makePoll({ id: 'p2', question: 'Page 2 poll?' })],
        total: 15,
        page: 2,
      }),
    )

    render(<ListPollsView />)

    await waitFor(() => expect(screen.getByText('Page 1 poll?')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => expect(screen.getByText('Page 2 poll?')).toBeInTheDocument())
    expect(mockListPolls).toHaveBeenCalledTimes(2)
    expect(mockListPolls).toHaveBeenLastCalledWith({ page: 2, limit: 10 })
  })

  it('fetches the previous page when Previous is clicked', async () => {
    const user = userEvent.setup()

    mockListPolls
      .mockResolvedValueOnce(
        makeResponse({
          polls: [makePoll({ id: 'p1', question: 'Page 1 poll?' })],
          total: 15,
          page: 1,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          polls: [makePoll({ id: 'p2', question: 'Page 2 poll?' })],
          total: 15,
          page: 2,
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          polls: [makePoll({ id: 'p1', question: 'Page 1 poll?' })],
          total: 15,
          page: 1,
        }),
      )

    render(<ListPollsView />)
    await waitFor(() => expect(screen.getByText('Page 1 poll?')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText('Page 2 poll?')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /previous/i }))
    await waitFor(() => expect(screen.getByText('Page 1 poll?')).toBeInTheDocument())

    expect(mockListPolls).toHaveBeenLastCalledWith({ page: 1, limit: 10 })
  })

  it('renders a Create a poll link', async () => {
    mockListPolls.mockResolvedValue(makeResponse())
    render(<ListPollsView />)

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /create a poll/i })).toBeInTheDocument(),
    )
  })
})
