import { useState } from 'react'

const FINGERPRINT_KEY = 'gavel_voter_fingerprint'
const VOTED_KEY = 'gavel_voted_polls'

function getOrCreateFingerprint(): string {
  let fp = localStorage.getItem(FINGERPRINT_KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(FINGERPRINT_KEY, fp)
  }
  return fp
}

function loadVotedPolls(): Set<string> {
  try {
    const raw = localStorage.getItem(VOTED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function useVotedPolls() {
  const [fingerprint] = useState(getOrCreateFingerprint)
  const [votedPolls, setVotedPolls] = useState(loadVotedPolls)

  function hasVoted(pollId: string): boolean {
    return votedPolls.has(pollId)
  }

  function markVoted(pollId: string): void {
    setVotedPolls((prev) => {
      const next = new Set(prev)
      next.add(pollId)
      localStorage.setItem(VOTED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return { fingerprint, hasVoted, markVoted }
}
