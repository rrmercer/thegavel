import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PollView } from '../components/PollView'

const mockGetPoll = vi.hoisted(() => vi.fn())
const mockCastVote = vi.hoisted(() => vi.fn())
vi.mock('../api/client', () => ({
  api: { getPoll: mockGetPoll, castVote: mockCastVote },
}))
vi.mock('../components/ResultsView', () => ({
  ResultsView: () => <div data-testid="results-view" />,
}))
vi.mock('../components/PollNotFound', () => ({
  PollNotFound: () => <div data-testid="poll-not-found" />,
}))

const POLL = {
  id: 'poll-1',
  question: 'Best language?',
  created_at: '2024-01-01',
  closes_at: null,
  options: [
    { id: 'opt-1', text: 'TypeScript', position: 0 },
    { id: 'opt-2', text: 'Rust', position: 1 },
  ],
}

const DEFAULT_PROPS = {
  pollId: 'poll-1',
  fingerprint: 'test-fp',
  onVoted: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PollView', () => {
  it('shows loading state while poll is fetching', () => {
    mockGetPoll.mockReturnValue(new Promise(() => {}))
    render(<PollView {...DEFAULT_PROPS} />)
    expect(screen.getByText(/loading poll/i)).toBeInTheDocument()
  })

  it('renders the poll question and options after load', async () => {
    mockGetPoll.mockResolvedValue(POLL)
    render(<PollView {...DEFAULT_PROPS} />)
    await waitFor(() => expect(screen.getByText('Best language?')).toBeInTheDocument())
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Rust')).toBeInTheDocument()
  })

  it('disables the Vote button until an option is selected', async () => {
    mockGetPoll.mockResolvedValue(POLL)
    render(<PollView {...DEFAULT_PROPS} />)
    await waitFor(() => screen.getByRole('button', { name: /vote/i }))
    expect(screen.getByRole('button', { name: /vote/i })).toBeDisabled()
  })

  it('shows a closed-poll error message and does not redirect when poll_closed', async () => {
    mockGetPoll.mockResolvedValue(POLL)
    mockCastVote.mockRejectedValue(new Error('poll_closed'))
    const user = userEvent.setup()
    render(<PollView {...DEFAULT_PROPS} />)

    await waitFor(() => screen.getByText('TypeScript'))
    await user.click(screen.getByLabelText('TypeScript'))
    await user.click(screen.getByRole('button', { name: /vote/i }))

    await waitFor(() =>
      expect(screen.getByText(/this poll has closed/i)).toBeInTheDocument()
    )
    expect(DEFAULT_PROPS.onVoted).not.toHaveBeenCalled()
    expect(screen.queryByTestId('results-view')).not.toBeInTheDocument()
  })

  it('calls onVoted and shows ResultsView when already_voted', async () => {
    mockGetPoll.mockResolvedValue(POLL)
    mockCastVote.mockRejectedValue(new Error('already_voted'))
    const user = userEvent.setup()
    render(<PollView {...DEFAULT_PROPS} />)

    await waitFor(() => screen.getByText('TypeScript'))
    await user.click(screen.getByLabelText('TypeScript'))
    await user.click(screen.getByRole('button', { name: /vote/i }))

    await waitFor(() => expect(screen.getByTestId('results-view')).toBeInTheDocument())
    expect(DEFAULT_PROPS.onVoted).toHaveBeenCalledWith('poll-1')
  })

  it('shows the closing time when closes_at is set', async () => {
    mockGetPoll.mockResolvedValue({ ...POLL, closes_at: '2027-06-01T12:00:00Z' })
    render(<PollView {...DEFAULT_PROPS} />)
    await waitFor(() => screen.getByText('Best language?'))
    expect(screen.getByText(/closes/i)).toBeInTheDocument()
  })

  it('shows PollNotFound when the poll does not exist', async () => {
    mockGetPoll.mockRejectedValue(new Error('Not found'))
    render(<PollView {...DEFAULT_PROPS} />)
    await waitFor(() => expect(screen.getByTestId('poll-not-found')).toBeInTheDocument())
  })
})
