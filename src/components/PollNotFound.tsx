export function PollNotFound() {
  return (
    <div className="card">
      <h2>Poll not found</h2>
      <p>This poll may have been removed or the link is invalid.</p>
      <a href="/">Create a new poll</a>
    </div>
  )
}
