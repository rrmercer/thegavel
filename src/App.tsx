import { useState } from 'react'
import { useVotedPolls } from './hooks/useVotedPolls'
import { CreatePollForm } from './components/CreatePollForm'
import { PollView } from './components/PollView'
import { ResultsView } from './components/ResultsView'
import { ListPollsView } from './components/ListPollsView'

function getParams(): { pollId: string | null; view: string | null } {
  const params = new URLSearchParams(window.location.search)
  return { pollId: params.get('poll'), view: params.get('view') }
}

export default function App() {
  const { fingerprint, hasVoted, markVoted } = useVotedPolls()
  const [{ pollId, view }] = useState(getParams)

  if (view === 'list') {
    return <ListPollsView />
  }

  if (!pollId) {
    return <CreatePollForm />
  }

  if (hasVoted(pollId)) {
    return <ResultsView pollId={pollId} />
  }

  return <PollView pollId={pollId} fingerprint={fingerprint} onVoted={markVoted} />
}
