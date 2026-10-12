import { PLAYER_STATUS } from "../../constants/index.js";
import "./PlayerTableGrid.css";

export function PlayerTableGrid({
  players,
  currentUserId,
  selectedCandidateId,
  isVotingMode,
  onSelectCandidate,
  hasVoted,
}) {
  return (
    <section className="player-grid-section" aria-label="Villagers Table">
      <ul className="player-grid">
        {players.map((player) => {
          const isAlive = player.status === PLAYER_STATUS.ALIVE;
          const isSelf = player.id === currentUserId;
          const isSelected = selectedCandidateId === player.id;
          const canSelect = isVotingMode && isAlive && !isSelf && !hasVoted;

          return (
            <li
              key={player.id}
              className={`player-tile ${!isAlive ? "is-eliminated" : ""} ${
                isSelf ? "is-self" : ""
              } ${isSelected ? "is-selected" : ""} ${
                canSelect ? "is-interactive" : ""
              }`}
              onClick={() => {
                if (canSelect && onSelectCandidate) {
                  onSelectCandidate(player.id);
                }
              }}
              role={canSelect ? "button" : undefined}
              tabIndex={canSelect ? 0 : undefined}
              onKeyDown={(e) => {
                if (canSelect && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelectCandidate(player.id);
                }
              }}
              aria-label={`${player.displayName}, ${
                isAlive ? "Living" : "Eliminated"
              }${isSelf ? ", You" : ""}${
                isSelected ? ", Selected for Execution" : ""
              }`}
            >
              <div className="player-avatar-frame" aria-hidden="true">
                {isAlive ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="9" cy="12" r="1" fill="currentColor" />
                    <circle cx="15" cy="12" r="1" fill="currentColor" />
                    <path d="M8 20v2h8v-2" />
                    <path d="m12.5 17-.5-1-.5 1h1z" />
                    <path d="M16 20a3 3 0 0 0 3-3V9a7 7 0 0 0-14 0v8a3 3 0 0 0 3 3" />
                  </svg>
                )}
              </div>

              <span className="player-tile-name">{player.displayName}</span>

              <div className="player-tile-status">
                {isAlive ? (
                  <span className="status-tag-alive">Living</span>
                ) : (
                  <span className="status-tag-eliminated">Eliminated</span>
                )}
                {isSelf && <span className="status-tag-you">(You)</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
