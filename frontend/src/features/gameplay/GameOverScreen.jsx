import { FACTIONS, ROLES, PLAYER_STATUS } from "../../constants/index.js";
import "./GameOverScreen.css";

export function GameOverScreen({
  gameState,
  currentPlayer,
  isHost,
  onRematch,
  onLeaveRoom,
  isRematching = false,
}) {
  const winner = gameState?.winner;
  const winReason = gameState?.winReason || "The match has reached its conclusion.";
  const revealedRoles = gameState?.revealedRoles || [];

  const isVillageWin = winner === FACTIONS.VILLAGE;
  const isWerewolfWin = winner === FACTIONS.WEREWOLF;
  const isTroublemakerWin = winner === "TROUBLEMAKER" || winner === FACTIONS.INDEPENDENT;

  const currentUserId = currentPlayer?.id;

  // Calculate match casualty statistics
  const totalPlayers = revealedRoles.length;
  const survivorsCount = revealedRoles.filter((p) => p.status === PLAYER_STATUS.ALIVE).length;
  const casualtiesCount = totalPlayers - survivorsCount;

  return (
    <div
      className={`game-over-container gothic-panel winner-${winner?.toLowerCase()}`}
      role="region"
      aria-label="Match Concluded - Final Results"
    >
      {/* 1. Header & Faction Victory Announcement */}
      <header className="game-over-header">
        <div className="victory-emblem-frame" aria-hidden="true">
          {isVillageWin && (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}

          {isWerewolfWin && (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="12 2 15 8 21 9 17 14 18 20 12 17 6 20 7 14 3 9 9 8 12 2" />
              <circle cx="9" cy="11" r="1.5" fill="currentColor" />
              <circle cx="15" cy="11" r="1.5" fill="currentColor" />
            </svg>
          )}

          {isTroublemakerWin && (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )}
        </div>

        <span className="victory-eyebrow font-display">Final Judgement</span>
        <h2 className="victory-title font-display">
          {isVillageWin && "The Village Prevails"}
          {isWerewolfWin && "The Pack Reigns Supreme"}
          {isTroublemakerWin && "The Schemer's Grand Triumph"}
        </h2>
        <p className="victory-reason font-editorial">{winReason}</p>
      </header>

      {/* 2. Match Chronology Statistics */}
      <section className="match-stats-bar" aria-label="Match Summary Statistics">
        <div className="stat-item">
          <span className="stat-label">Cycles Elapsed</span>
          <span className="stat-value tabular-nums">
            Day {gameState?.dayNumber || 1} / Night {gameState?.nightNumber || 1}
          </span>
        </div>
        <div className="stat-separator" aria-hidden="true" />
        <div className="stat-item">
          <span className="stat-label">Total Souls</span>
          <span className="stat-value tabular-nums">{totalPlayers}</span>
        </div>
        <div className="stat-separator" aria-hidden="true" />
        <div className="stat-item">
          <span className="stat-label">Survivors</span>
          <span className="stat-value stat-survivor tabular-nums">{survivorsCount}</span>
        </div>
        <div className="stat-separator" aria-hidden="true" />
        <div className="stat-item">
          <span className="stat-label">Fallen</span>
          <span className="stat-value stat-fallen tabular-nums">{casualtiesCount}</span>
        </div>
      </section>

      {/* 3. Revealed Roster Table */}
      <section className="roster-section" aria-label="Revealed Roles Roster">
        <div className="roster-header">
          <h3 className="roster-title font-display">The Veil Is Lifted</h3>
          <span className="roster-subtitle font-editorial">
            All secret allegiances and fates laid bare before the altar.
          </span>
        </div>

        <div className="roster-table-wrapper">
          <table className="roster-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Secret Role</th>
                <th scope="col">Allegiance</th>
                <th scope="col">Final Fate</th>
              </tr>
            </thead>
            <tbody>
              {revealedRoles.map((player) => {
                const isSelf = player.playerId === currentUserId;
                const isAlive = player.status === PLAYER_STATUS.ALIVE;
                const roleLower = player.role?.toLowerCase() || "villager";

                return (
                  <tr
                    key={player.playerId}
                    className={`roster-row ${isSelf ? "is-self" : ""} ${!isAlive ? "is-slain" : ""}`}
                  >
                    <td className="player-name-cell">
                      <span className="player-display-name font-sans">
                        {player.displayName}
                      </span>
                      {isSelf && <span className="self-tag">(You)</span>}
                    </td>

                    <td className="role-cell">
                      <span className={`role-badge role-${roleLower} font-display`}>
                        {player.role}
                      </span>
                    </td>

                    <td className="faction-cell font-sans">
                      <span className={`faction-tag faction-${player.faction?.toLowerCase()}`}>
                        {player.faction}
                      </span>
                    </td>

                    <td className="fate-cell font-editorial">
                      {isAlive ? (
                        <span className="fate-badge fate-survived">Survived</span>
                      ) : player.eliminatedAtPhase === "NIGHT" ? (
                        <span className="fate-badge fate-night">Slain in the Shadows</span>
                      ) : (
                        <span className="fate-badge fate-tribunal">Executed by Tribunal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Action Controls: Rematch or Leave */}
      <footer className="game-over-actions">
        {isHost ? (
          <button
            type="button"
            className="gothic-btn gothic-btn-gold rematch-btn"
            disabled={isRematching}
            onClick={onRematch}
          >
            {isRematching ? "Gathering Chamber..." : "Commence Rematch (Return to Chamber)"}
          </button>
        ) : (
          <div className="rematch-waiting-note font-editorial">
            The chamber host may summon all souls for a rematch.
          </div>
        )}

        <button
          type="button"
          className="gothic-btn gothic-btn-outline leave-btn"
          onClick={onLeaveRoom}
        >
          Depart Chamber (Return to Gates)
        </button>
      </footer>
    </div>
  );
}
