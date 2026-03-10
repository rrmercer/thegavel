import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

// Mock child components so we only test routing logic
vi.mock('../components/CreatePollForm', () => ({
  CreatePollForm: () => <div data-testid="create-poll-form" />,
}))
vi.mock('../components/PollView', () => ({
  PollView: () => <div data-testid="poll-view" />,
}))
vi.mock('../components/ResultsView', () => ({
  ResultsView: () => <div data-testid="results-view" />,
}))
vi.mock('../components/ListPollsView', () => ({
  ListPollsView: () => <div data-testid="list-polls-view" />,
}))
vi.mock('../components/DashboardView', () => ({
  DashboardView: () => <div data-testid="dashboard-view" />,
}))

// Control voted-poll state per test
const mockHasVoted = vi.fn()
vi.mock('../hooks/useVotedPolls', () => ({
  useVotedPolls: () => ({
    fingerprint: 'test-fp',
    hasVoted: mockHasVoted,
    markVoted: vi.fn(),
  }),
}))

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHasVoted.mockReturnValue(false)
  setSearch('')
})

describe('App routing', () => {
  it('renders CreatePollForm when there is no poll query param', () => {
    render(<App />)
    expect(screen.getByTestId('create-poll-form')).toBeInTheDocument()
  })

  it('renders PollView when poll param is present and user has not voted', () => {
    setSearch('?poll=test-poll-id')
    mockHasVoted.mockReturnValue(false)
    render(<App />)
    expect(screen.getByTestId('poll-view')).toBeInTheDocument()
  })

  it('renders ResultsView when poll param is present and user has already voted', () => {
    setSearch('?poll=test-poll-id')
    mockHasVoted.mockReturnValue(true)
    render(<App />)
    expect(screen.getByTestId('results-view')).toBeInTheDocument()
  })

  it('renders ListPollsView when view=list query param is present', () => {
    setSearch('?view=list')
    render(<App />)
    expect(screen.getByTestId('list-polls-view')).toBeInTheDocument()
  })

  it('renders DashboardView when view=dashboard query param is present', () => {
    setSearch('?view=dashboard')
    render(<App />)
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument()
  })
})
