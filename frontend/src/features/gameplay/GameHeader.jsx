import { useState, useEffect } from "react";
import { PHASES } from "../../constants/index.js";
import "./GameHeader.css";

export function GameHeader({
  phase,
  dayNumber,
  nightNumber,
  phaseDeadline,
  isHost,
  onProceedToVote,
}) {
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (!phaseDeadline) {
      setSecondsRemaining(0);
      return;
    }

    const updateTimer = () => {
      const remainingMs = phaseDeadline - Date.now();
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsRemaining(secs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 500);

    return () => clearInterval(interval);
  }, [phaseDeadline]);

  // Format MM:SS
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedTime = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  const isUrgent = secondsRemaining > 0 && secondsRemaining <= 10;

  // Determine display text and styling
  let phaseTitle = "Game In Progress";
  let cycleLabel = `Day ${dayNumber || 1}`;
  let phaseClass = "phase-day";

  if (phase === PHASES.NIGHT_1) {
    phaseTitle = "First Night: Village Asleep";
    cycleLabel = "First Night Setup";
    phaseClass = "phase-night";
  } else if (phase === PHASES.DAY_DISCUSSION) {
    phaseTitle = "Daytime Discussion";
    cycleLabel = `Day ${dayNumber || 1}`;
    phaseClass = "phase-day";
  } else if (phase === PHASES.DAY_VOTING) {
    phaseTitle = "Village Tribunal: Cast Your Vote";
    cycleLabel = `Day ${dayNumber || 1} Voting`;
    phaseClass = "phase-voting";
  } else if (phase === PHASES.NIGHT) {
    phaseTitle = "The Hunt: Night Falls";
    cycleLabel = `Night ${nightNumber || 1}`;
    phaseClass = "phase-night";
  } else if (phase === PHASES.GAME_OVER) {
    phaseTitle = "Judgement Concluded";
    cycleLabel = "Match Concluded";
    phaseClass = "phase-game-over";
  }

  return (
    <header className="game-header" role="banner" aria-label="Game Status and Timer">
      <div className="phase-info-block">
        <div className={`phase-icon-frame ${phaseClass}`} aria-hidden="true">
          {phase === PHASES.NIGHT || phase === PHASES.NIGHT_1 ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : phase === PHASES.DAY_VOTING ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 12 2 2 4-4" />
              <path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          )}
        </div>

        <div className="phase-text-col">
          <span className="phase-cycle-label">{cycleLabel}</span>
          <h2 className="phase-title-text">{phaseTitle}</h2>
        </div>
      </div>

      <div className="timer-block">
        {phaseDeadline && (
          <div className={`countdown-box ${isUrgent ? "is-urgent" : ""}`} role="timer" aria-label={`Time remaining: ${formattedTime}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="timer-digits tabular-nums">{formattedTime}</span>
          </div>
        )}

        {phase === PHASES.DAY_DISCUSSION && isHost && onProceedToVote && (
          <button
            type="button"
            className="btn-secondary skip-discussion-btn"
            onClick={onProceedToVote}
            title="Conclude discussion and open voting immediately"
          >
            Commence Voting
          </button>
        )}

        {isHost && onDevTriggerVictory && (
          <button
            type="button"
            className="gothic-btn gothic-btn-outline"
            style={{ fontSize: "11px", padding: "4px 8px", minHeight: "32px" }}
            onClick={() => onDevTriggerVictory("VILLAGE")}
            title="Dev: Trigger Village Victory"
          >
            Dev: Village Win
          </button>
        )}
      </div>
    </header>
  );
}
