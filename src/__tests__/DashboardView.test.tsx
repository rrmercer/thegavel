import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardView } from '../components/DashboardView'

const mockListPolls = vi.hoisted(() => vi.fn())
const mockDeletePoll = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  api: {
    listPolls: mockListPolls,
    deletePoll: mockDeletePoll,
  },
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

function makeResponse(polls = [makePoll()]) {
  return { polls, total: polls.length, page: 1, limit: 100 }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('DashboardView', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the owner token input and Load polls button', () => {
    render(<DashboardView />)
    expect(screen.getByLabelText(/owner token/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load polls/i })).toBeInTheDocument()
  })

  it('disables the Load polls button when the token input is empty', () => {
    render(<DashboardView />)
    expect(screen.getByRole('button', { name: /load polls/i })).toBeDisabled()
  })

  it('enables the Load polls button once a token is typed', async () => {
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'some-token')
    expect(screen.getByRole('button', { name: /load polls/i })).not.toBeDisabled()
  })

  // ── Loading & errors ───────────────────────────────────────────────────────

  it('shows a loading state while the request is in flight', async () => {
    mockListPolls.mockReturnValue(new Promise(() => {})) // never resolves
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
  })

  it('shows an error when the API call fails', async () => {
    mockListPolls.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))
    await waitFor(() => expect(screen.getByText(/failed to load polls/i)).toBeInTheDocument())
  })

  // ── Poll list display ──────────────────────────────────────────────────────

  it('shows an empty state when no polls are returned', async () => {
    mockListPolls.mockResolvedValue(makeResponse([]))
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))
    await waitFor(() => expect(screen.getByText(/no polls found/i)).toBeInTheDocument())
  })

  it('renders poll question, vote count, and created date', async () => {
    mockListPolls.mockResolvedValue(
      makeResponse([
        makePoll({
          id: 'p1',
          question: 'Best framework?',
          totalVotes: 7,
          created_at: '2024-06-15T12:00:00Z',
        }),
      ]),
    )
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByText('Best framework?')).toBeInTheDocument())
    expect(screen.getByText(/7 votes/)).toBeInTheDocument()
    // Date is formatted — check the year appears (locale/timezone-safe assertion)
    expect(screen.getByText(/2024/)).toBeInTheDocument()
  })

  it('shows a close date when closes_at is set', async () => {
    mockListPolls.mockResolvedValue(
      makeResponse([makePoll({ id: 'p1', closes_at: '2024-12-31T23:59:59Z' })]),
    )
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByText(/closes/i)).toBeInTheDocument())
  })

  it('does not show a close date when closes_at is null', async () => {
    mockListPolls.mockResolvedValue(makeResponse([makePoll({ closes_at: null })]))
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() =>
      expect(screen.getByText('What is your favourite language?')).toBeInTheDocument(),
    )
    expect(screen.queryByText(/closes/i)).not.toBeInTheDocument()
  })

  it('shows a Closed badge for closed polls', async () => {
    mockListPolls.mockResolvedValue(
      makeResponse([
        makePoll({ id: 'p1', question: 'Open?', is_closed: false }),
        makePoll({ id: 'p2', question: 'Closed?', is_closed: true }),
      ]),
    )
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByText('Closed?')).toBeInTheDocument())
    expect(screen.getAllByText('Closed')).toHaveLength(1)
  })

  it('renders a Delete button per poll', async () => {
    mockListPolls.mockResolvedValue(
      makeResponse([
        makePoll({ id: 'p1', question: 'First?' }),
        makePoll({ id: 'p2', question: 'Second?' }),
      ]),
    )
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByText('First?')).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2)
  })

  it('calls listPolls with limit: 100', async () => {
    mockListPolls.mockResolvedValue(makeResponse())
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(mockListPolls).toHaveBeenCalledWith({ limit: 100 }))
  })

  // ── Delete ─────────────────────────────────────────────────────────────────

  it('shows a confirm dialog before deleting', async () => {
    mockListPolls.mockResolvedValue(makeResponse())
    mockDeletePoll.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete/i }))

    expect(window.confirm).toHaveBeenCalledOnce()
  })

  it('does not call deletePoll if the user cancels the confirm dialog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockListPolls.mockResolvedValue(makeResponse())
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete/i }))

    expect(mockDeletePoll).not.toHaveBeenCalled()
  })

  it('removes the poll from the list after a successful delete', async () => {
    mockListPolls.mockResolvedValue(
      makeResponse([
        makePoll({ id: 'p1', question: 'Keep me?' }),
        makePoll({ id: 'p2', question: 'Delete me?' }),
      ]),
    )
    mockDeletePoll.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByText('Delete me?')).toBeInTheDocument())
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[1]) // second poll

    await waitFor(() => expect(screen.queryByText('Delete me?')).not.toBeInTheDocument())
    expect(screen.getByText('Keep me?')).toBeInTheDocument()
  })

  it('calls deletePoll with the correct pollId and ownerToken', async () => {
    mockListPolls.mockResolvedValue(makeResponse([makePoll({ id: 'poll-xyz' })]))
    mockDeletePoll.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'secret-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(mockDeletePoll).toHaveBeenCalledWith('poll-xyz', 'secret-token'))
  })

  it('shows "Invalid owner token" when delete-poll returns unauthorized', async () => {
    mockListPolls.mockResolvedValue(makeResponse([makePoll({ id: 'p1', question: 'My poll?' })]))
    mockDeletePoll.mockRejectedValue(new Error('unauthorized'))
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'wrong-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(screen.getByText(/invalid owner token/i)).toBeInTheDocument())
    // Poll should still be in the list
    expect(screen.getByText('My poll?')).toBeInTheDocument()
  })

  it('shows a generic error for non-unauthorized delete failures', async () => {
    mockListPolls.mockResolvedValue(makeResponse([makePoll({ id: 'p1' })]))
    mockDeletePoll.mockRejectedValue(new Error('HTTP 500'))
    const user = userEvent.setup()
    render(<DashboardView />)
    await user.type(screen.getByLabelText(/owner token/i), 'my-token')
    await user.click(screen.getByRole('button', { name: /load polls/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(screen.getByText(/failed to delete poll/i)).toBeInTheDocument())
  })

  // ── Navigation ─────────────────────────────────────────────────────────────

  it('renders a Create a poll link', () => {
    render(<DashboardView />)
    expect(screen.getByRole('link', { name: /create a poll/i })).toBeInTheDocument()
  })
})
