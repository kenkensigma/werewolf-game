import { useState } from "react";
import { SEER_RESULTS } from "../../constants/index.js";
import "./SeerInvestigationModal.css";

export function SeerInvestigationModal({
  targetName,
  result,
  onDismiss,
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  const isWolf = result === SEER_RESULTS.WEREWOLF;

  return (
    <div
      className="seer-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seer-modal-title"
    >
      <div className="seer-modal-container gothic-panel">
        <div className="seer-modal-header">
          <span className="seer-modal-eyebrow font-display">Astral Divination</span>
          <h3 id="seer-modal-title" className="seer-modal-title font-display">
            The Mirror of Truth
          </h3>
          <p className="seer-modal-desc font-editorial">
            The mists part to divine the soul of{" "}
            <strong className="seer-target-name font-sans">{targetName}</strong>.
          </p>
        </div>

        {/* 3D Investigation Card Container */}
        <div className="seer-card-stage">
          <div
            className={`seer-3d-card ${isFlipped ? "flipped" : ""}`}
            onClick={() => setIsFlipped((prev) => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsFlipped((prev) => !prev);
              }
            }}
            aria-label={
              isFlipped
                ? `Investigation revealed: ${targetName} is ${isWolf ? "a Werewolf" : "Not a Werewolf"}`
                : "Investigation card face down. Tap or press Enter to reveal."
            }
          >
            {/* Card Back Face */}
            <div className="seer-card-face seer-card-back">
              <div className="seer-card-border-ornament" />
              <div className="seer-eye-emblem" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <span className="seer-card-back-hint font-editorial">
                Tap to peer beneath the veil
              </span>
            </div>

            {/* Card Front Face (Revealed Result) */}
            <div className={`seer-card-face seer-card-front ${isWolf ? "result-werewolf" : "result-innocent"}`}>
              <div className="seer-card-border-ornament" />
              <span className="seer-result-target font-display">{targetName}</span>

              <div className="seer-result-icon" aria-hidden="true">
                {isWolf ? (
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polygon points="12 2 15 8 21 9 17 14 18 20 12 17 6 20 7 14 3 9 9 8 12 2" />
                    <circle cx="9" cy="11" r="1.5" fill="currentColor" />
                    <circle cx="15" cy="11" r="1.5" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                )}
              </div>

              <div className="seer-result-badge font-display">
                {isWolf ? "WEREWOLF" : "NOT WEREWOLF"}
              </div>

              <p className="seer-result-caption font-editorial">
                {isWolf
                  ? "A foul stench of wolfsbane clings to their soul. They belong to the pack."
                  : "No bestial aura clouds their spirit. They harbor no werewolf curse."}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="seer-modal-actions">
          {!isFlipped ? (
            <button
              type="button"
              className="gothic-btn gothic-btn-gold"
              onClick={() => setIsFlipped(true)}
            >
              Reveal Investigation Card
            </button>
          ) : (
            <button
              type="button"
              className="gothic-btn gothic-btn-gold"
              onClick={onDismiss}
            >
              Acknowledge Vision
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
