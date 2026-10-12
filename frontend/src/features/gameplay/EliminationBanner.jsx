import "./EliminationBanner.css";

export function EliminationBanner({ result, onDismiss }) {
  if (!result) return null;

  const isTroublemakerWin = result.isTroublemakerWin;
  const isEliminated = Boolean(result.eliminatedPlayerId || result.eliminatedId);
  const isNightPhase = result.phase === "NIGHT";

  let bannerTitle = "Tribunal Deadlock";
  if (isTroublemakerWin) {
    bannerTitle = "Troublemaker Victory!";
  } else if (isNightPhase) {
    bannerTitle = isEliminated ? "Casualty of the Night" : "Dawn Breaks in Peace";
  } else if (isEliminated) {
    bannerTitle = "Tribunal Execution";
  }

  const victimName = result.displayName || result.eliminatedPlayerName;

  return (
    <div
      className={`elimination-banner ${isTroublemakerWin ? "is-troublemaker" : ""} ${isNightPhase ? "is-night-notice" : ""}`}
      role="alert"
    >
      <div className="banner-content">
        <div className="banner-icon" aria-hidden="true">
          {isTroublemakerWin ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ) : isEliminated ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="12" r="1" fill="currentColor" />
              <circle cx="15" cy="12" r="1" fill="currentColor" />
              <path d="M8 20v2h8v-2" />
              <path d="m12.5 17-.5-1-.5 1h1z" />
              <path d="M16 20a3 3 0 0 0 3-3V9a7 7 0 0 0-14 0v8a3 3 0 0 0 3 3" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          )}
        </div>

        <div>
          <h4 className="banner-title">{bannerTitle}</h4>
          <p className="banner-desc">
            {isEliminated && victimName && (
              <strong style={{ color: "var(--color-ivory)", marginRight: "0.4rem" }}>
                {victimName}:
              </strong>
            )}
            {result.reason}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="banner-dismiss-btn"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
