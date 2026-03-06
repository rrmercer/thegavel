export interface PollOption {
  id: string
  text: string
  position: number
}

export interface Poll {
  id: string
  question: string
  created_at: string
  closes_at?: string | null
  options: PollOption[]
}

export interface PollOptionResult extends PollOption {
  voteCount: number
  percentage: number
}

export interface PollResults {
  pollId: string
  question: string
  totalVotes: number
  options: PollOptionResult[]
  is_closed: boolean
  closes_at: string | null
}
