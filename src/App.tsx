import { useState } from 'react'
import { useVotedPolls } from './hooks/useVotedPolls'
import { CreatePollForm } from './components/CreatePollForm'
import { PollView } from './components/PollView'
import { ResultsView } from './components/ResultsView'

function getPollId(): string | null {
  return new URLSearchParams(window.location.search).get('poll')
}

export default function App() {
  const { fingerprint, hasVoted, markVoted } = useVotedPolls()
  const [pollId] = useState(getPollId)

  if (!pollId) {
    return <CreatePollForm />
  }

  if (hasVoted(pollId)) {
    return <ResultsView pollId={pollId} />
  }

  return (
    <PollView
      pollId={pollId}
      fingerprint={fingerprint}
      onVoted={markVoted}
    />
  )
}
