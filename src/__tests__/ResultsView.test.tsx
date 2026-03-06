import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ResultsView } from '../components/ResultsView'

const mockGetResults = vi.hoisted(() => vi.fn())
vi.mock('../api/client', () => ({
  api: { getResults: mockGetResults },
}))

const RESULTS = {
  pollId: 'poll-1',
  question: 'Best language?',
  totalVotes: 3,
  options: [
    { id: 'opt-1', text: 'TypeScript', position: 0, voteCount: 2, percentage: 67 },
    { id: 'opt-2', text: 'Rust', position: 1, voteCount: 1, percentage: 33 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResultsView', () => {
  it('shows a loading state before results arrive', () => {
    mockGetResults.mockReturnValue(new Promise(() => {})) // never resolves
    render(<ResultsView pollId="poll-1" />)
    expect(screen.getByText(/loading results/i)).toBeInTheDocument()
  })

  it('renders the question and all options with vote counts', async () => {
    mockGetResults.mockResolvedValue(RESULTS)
    render(<ResultsView pollId="poll-1" />)

    await waitFor(() => expect(screen.getByText('Best language?')).toBeInTheDocument())
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('Rust')).toBeInTheDocument()
    expect(screen.getByText('3 votes total')).toBeInTheDocument()
  })

  it('marks the voted option with a checkmark', async () => {
    mockGetResults.mockResolvedValue(RESULTS)
    render(<ResultsView pollId="poll-1" votedOptionId="opt-1" />)

    await waitFor(() => expect(screen.getByText(/TypeScript.*✓/)).toBeInTheDocument())
    expect(screen.queryByText(/Rust.*✓/)).not.toBeInTheDocument()
  })

  it('shows an error when the API call fails', async () => {
    mockGetResults.mockRejectedValue(new Error('Network error'))
    render(<ResultsView pollId="poll-1" />)

    await waitFor(() => expect(screen.getByText(/failed to load results/i)).toBeInTheDocument())
  })

  it('shows a "Poll closed" badge when is_closed is true', async () => {
    mockGetResults.mockResolvedValue({ ...RESULTS, is_closed: true, closes_at: null })
    render(<ResultsView pollId="poll-1" />)

    await waitFor(() => expect(screen.getByText(/poll closed/i)).toBeInTheDocument())
  })

  it('does not show a "Poll closed" badge when is_closed is false', async () => {
    mockGetResults.mockResolvedValue({ ...RESULTS, is_closed: false, closes_at: null })
    render(<ResultsView pollId="poll-1" />)

    await waitFor(() => screen.getByText('Best language?'))
    expect(screen.queryByText(/poll closed/i)).not.toBeInTheDocument()
  })
})
