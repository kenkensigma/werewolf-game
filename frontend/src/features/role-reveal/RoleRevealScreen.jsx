import { useState } from "react";
import { ROLE_METADATA, ROLES } from "../../constants/index.js";
import { audioService, SFX_TYPES } from "../../services/audioService.js";
import "./RoleRevealScreen.css";

export function RoleRevealScreen({
  roleInfo,
  playerName,
  gameState,
  isReady,
  onAcknowledge,
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  const fallbackMeta = ROLE_METADATA[ROLES.VILLAGER];
  const roleName = roleInfo?.role
    ? ROLE_METADATA[roleInfo.role]?.name || roleInfo.role
    : fallbackMeta.name;
  const factionName = roleInfo?.faction || fallbackMeta.faction;
  const description = roleInfo?.abilityDescription || fallbackMeta.description;
  const colorAccent = roleInfo?.colorAccent || "#D8C8A8";

  const handleCardToggle = () => {
    setIsFlipped((prev) => {
      const next = !prev;
      if (next) {
        audioService.playSfx(SFX_TYPES.ROLE_REVEAL);
      }
      return next;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardToggle();
    }
  };

  const players = gameState?.players || [];
  const readyCount = players.filter((p) => p.isReady).length;
  const totalCount = players.length;

  return (
    <div className="role-reveal-container" role="region" aria-label="Secret Role Reveal">
      <header className="reveal-header">
        <span className="reveal-badge">Confidential Destiny</span>
        <h2 className="reveal-title">{playerName}</h2>
        <p className="reveal-subtitle">
          {isFlipped
            ? "Your true allegiance is laid bare before your eyes."
            : "Touch the occult seal to unveil your secret role in the shadows."}
        </p>
      </header>

      {/* 3D Card Flip Stage */}
      <div className="card-stage">
        <div
          className={`reveal-card-inner ${isFlipped ? "is-flipped" : ""}`}
          tabIndex={0}
          role="button"
          aria-label={`Secret role card. Status: ${isFlipped ? "Revealed as " + roleName : "Face down"}. Press Enter or Space to flip.`}
          onClick={handleCardToggle}
          onKeyDown={handleKeyDown}
        >
          {/* Card Back */}
          <div className="reveal-card-face card-face-back">
            <div className="back-ornament-frame">
              <svg
                className="back-sigil"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="back-prompt-text">Seal of Shadows</span>
              <span className="back-click-cue">Reveal Your Role</span>
            </div>
          </div>

          {/* Card Front */}
          <div
            className="reveal-card-face card-face-front"
            style={{ borderColor: colorAccent }}
          >
            <div>
              <div
                className="card-faction-badge"
                style={{ color: colorAccent }}
              >
                {factionName} Faction
              </div>

              <div
                className="card-art-box"
                style={{
                  border: `1px solid ${colorAccent}`,
                  background: `radial-gradient(circle at 50% 50%, ${colorAccent}33 0%, #15161A 85%)`,
                }}
              >
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colorAccent}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m4.93 4.93 4.24 4.24" />
                  <path d="m14.83 9.17 4.24-4.24" />
                  <path d="m14.83 14.83 4.24 4.24" />
                  <path d="m9.17 14.83-4.24 4.24" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>

              <h3 className="card-role-title">{roleName}</h3>
            </div>

            <p className="card-role-instruction">{description}</p>
          </div>
        </div>
      </div>

      {/* Reveal Controls & Readiness */}
      <div className="reveal-controls">
        {!isReady ? (
          <button
            type="button"
            className="btn-primary btn-confirm-duty"
            onClick={onAcknowledge}
            disabled={!isFlipped}
            title={!isFlipped ? "Flip card before proceeding" : undefined}
          >
            {!isFlipped ? "Flip Card to Confirm" : "I Understand My Role"}
          </button>
        ) : (
          <div className="ready-status-box" role="status">
            <span>✓ Role Acknowledged. Waiting for all villagers to prepare.</span>
            <span className="ready-pill tabular-nums">
              ({readyCount} / {totalCount} ready)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
