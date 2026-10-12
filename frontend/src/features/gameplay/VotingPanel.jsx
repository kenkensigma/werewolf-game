import "./VotingPanel.css";

export function VotingPanel({
  selectedCandidate,
  isSkipSelected,
  onSelectSkip,
  onSubmitVote,
  submittedTargetId,
  votesCastCount = 0,
  totalVoters = 0,
  isAlive = true,
  isHost = false,
  onProceedToResolution,
}) {
  if (!isAlive) {
    return (
      <div className="voting-panel-card" role="region" aria-label="Tribunal Voting">
        <div className="voting-panel-header">
          <h3 className="voting-panel-title">Tribunal In Session</h3>
          <span className="voting-progress-tag tabular-nums">
            {votesCastCount} / {totalVoters} votes cast
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-muted)" }}>
          You have been eliminated and may not cast a vote in the tribunal.
        </p>
      </div>
    );
  }

  const currentSelectionName = isSkipSelected
    ? "Abstain / Skip Vote"
    : selectedCandidate
    ? selectedCandidate.displayName
    : "No suspect selected";

  const targetIdToSend = isSkipSelected ? "SKIP" : selectedCandidate?.id;
  const isTargetSelected = Boolean(targetIdToSend);
  const hasAlreadyVoted = Boolean(submittedTargetId);

  return (
    <div className="voting-panel-card" role="region" aria-label="Tribunal Voting">
      <div className="voting-panel-header">
        <h3 className="voting-panel-title">Tribunal Voting</h3>
        <span className="voting-progress-tag tabular-nums">
          {votesCastCount} / {totalVoters} votes registered
        </span>
      </div>

      <div className="selected-target-display">
        <span className="target-label">Selected Ballot</span>
        <span
          className={`target-name ${isSkipSelected ? "is-skip" : ""}`}
          aria-live="polite"
        >
          {currentSelectionName}
        </span>
      </div>

      <div className="voting-actions-row">
        <button
          type="button"
          className="btn-primary btn-cast-vote"
          disabled={!isTargetSelected}
          onClick={() => {
            if (targetIdToSend) {
              onSubmitVote(targetIdToSend);
            }
          }}
        >
          {hasAlreadyVoted ? "Alter Vote" : "Confirm Vote"}
        </button>

        <button
          type="button"
          className={`btn-secondary btn-skip-vote ${isSkipSelected ? "btn-primary" : ""}`}
          onClick={onSelectSkip}
        >
          {isSkipSelected ? "Selected: Skip" : "Skip Vote"}
        </button>
      </div>

      {isHost && (
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed rgba(198, 166, 107, 0.2)" }}>
          <button
            type="button"
            className="gothic-btn gothic-btn-outline"
            style={{ width: "100%", minHeight: "44px" }}
            onClick={onProceedToResolution}
          >
            Conclude Voting (Host)
          </button>
        </div>
      )}

      {hasAlreadyVoted && (
        <div className="vote-confirmed-notice" role="status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Your ballot is registered. You may change it before time expires.</span>
        </div>
      )}
    </div>
  );
}
