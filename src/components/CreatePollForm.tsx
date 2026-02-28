import { useState } from 'react'
import { api } from '../api/client'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 4

export function CreatePollForm() {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdLink, setCreatedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  function addOption() {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, ''])
  }

  function removeOption(index: number) {
    if (options.length > MIN_OPTIONS) setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedQuestion = question.trim()
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean)

    if (!trimmedQuestion) return setError('Please enter a question.')
    if (trimmedOptions.length < MIN_OPTIONS) return setError('Please fill in at least 2 options.')

    setError(null)
    setSubmitting(true)
    try {
      const { pollId } = await api.createPoll({ question: trimmedQuestion, options: trimmedOptions })
      const link = `${window.location.origin}/?poll=${pollId}`
      setCreatedLink(link)
      window.history.pushState({}, '', `/?poll=${pollId}`)
    } catch {
      setError('Failed to create poll. Please try again.')
      setSubmitting(false)
    }
  }

  async function copyLink() {
    if (!createdLink) return
    await navigator.clipboard.writeText(createdLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (createdLink) {
    return (
      <div className="card">
        <h2>Poll created!</h2>
        <p>Share this link with others to collect votes:</p>
        <div className="link-row">
          <code className="poll-link">{createdLink}</code>
          <button onClick={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Create a poll</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="question">Question</label>
        <input
          id="question"
          type="text"
          placeholder="What's for lunch today?"
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <fieldset>
          <legend>Options</legend>
          {options.map((opt, i) => (
            <div key={i} className="option-row">
              <input
                type="text"
                placeholder={`Option ${i + 1}`}
                maxLength={200}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                disabled={options.length <= MIN_OPTIONS}
                aria-label={`Remove option ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <button type="button" onClick={addOption}>
              + Add option
            </button>
          )}
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create poll'}
        </button>
      </form>
    </div>
  )
}
