import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreatePollForm } from '../components/CreatePollForm'

const mockCreatePoll = vi.hoisted(() => vi.fn())
vi.mock('../api/client', () => ({
  api: { createPoll: mockCreatePoll },
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Silence history.pushState side-effect
  vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
})

describe('CreatePollForm', () => {
  it('renders a question input and two option inputs by default', () => {
    render(<CreatePollForm />)
    expect(screen.getByLabelText(/question/i)).toBeInTheDocument()
    expect(screen.getAllByPlaceholderText(/option/i)).toHaveLength(2)
  })

  it('disables the remove button when only 2 options remain', () => {
    render(<CreatePollForm />)
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    removeButtons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('adds an option when "+ Add option" is clicked', async () => {
    const user = userEvent.setup()
    render(<CreatePollForm />)
    await user.click(screen.getByRole('button', { name: /add option/i }))
    expect(screen.getAllByPlaceholderText(/option/i)).toHaveLength(3)
  })

  it('removes an option when the remove button is clicked', async () => {
    const user = userEvent.setup()
    render(<CreatePollForm />)
    // Add a third option so remove is enabled
    await user.click(screen.getByRole('button', { name: /add option/i }))
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    await user.click(removeButtons[0])
    expect(screen.getAllByPlaceholderText(/option/i)).toHaveLength(2)
  })

  it('hides "+ Add option" when 10 options are present', async () => {
    const user = userEvent.setup()
    render(<CreatePollForm />)
    // Start with 2 options; click 8 more times to reach 10
    for (let i = 0; i < 8; i++) {
      await user.click(screen.getByRole('button', { name: /add option/i }))
    }
    expect(screen.getAllByPlaceholderText(/option/i)).toHaveLength(10)
    expect(screen.queryByRole('button', { name: /add option/i })).not.toBeInTheDocument()
  })

  it('shows an error when submitting with an empty question', async () => {
    const user = userEvent.setup()
    render(<CreatePollForm />)
    await user.click(screen.getByRole('button', { name: /create poll/i }))
    expect(screen.getByText(/please enter a question/i)).toBeInTheDocument()
  })

  it('shows an error when fewer than 2 options are filled in', async () => {
    const user = userEvent.setup()
    render(<CreatePollForm />)
    await user.type(screen.getByLabelText(/question/i), 'What is the best food?')
    // Leave both options blank
    await user.click(screen.getByRole('button', { name: /create poll/i }))
    expect(screen.getByText(/at least 2 options/i)).toBeInTheDocument()
  })

  it('shows the shareable link after successful creation', async () => {
    mockCreatePoll.mockResolvedValue({ pollId: 'created-poll-id' })
    const user = userEvent.setup()
    render(<CreatePollForm />)

    await user.type(screen.getByLabelText(/question/i), 'Best food?')
    const [opt1, opt2] = screen.getAllByPlaceholderText(/option/i)
    await user.type(opt1, 'Pizza')
    await user.type(opt2, 'Tacos')
    await user.click(screen.getByRole('button', { name: /create poll/i }))

    await waitFor(() => expect(screen.getByText(/poll created/i)).toBeInTheDocument())
    expect(screen.getByText(/created-poll-id/)).toBeInTheDocument()
  })

  it('shows an error message when the API call fails', async () => {
    mockCreatePoll.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<CreatePollForm />)

    await user.type(screen.getByLabelText(/question/i), 'Best food?')
    const [opt1, opt2] = screen.getAllByPlaceholderText(/option/i)
    await user.type(opt1, 'Pizza')
    await user.type(opt2, 'Tacos')
    await user.click(screen.getByRole('button', { name: /create poll/i }))

    await waitFor(() => expect(screen.getByText(/failed to create poll/i)).toBeInTheDocument())
  })
})
