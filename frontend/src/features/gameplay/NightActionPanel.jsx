import { useState } from "react";
import { ROLES, ACTION_TYPES } from "../../constants/index.js";
import "./NightActionPanel.css";

const SKIP_TARGET = "SKIP";

export function NightActionPanel({
  privateRole,
  selectedCandidate,
  livingCandidates,
  onSelectCandidate,
  onSubmitNightAction,
  submittedTargetId,
  isAlive,
  isHost,
  onProceedToDawn,
  witchPotions,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const role = privateRole?.role;

  const hasSubmitted = Boolean(submittedTargetId);
  const submittedCandidateName =
    submittedTargetId === SKIP_TARGET
      ? "Held Fire (Skip)"
      : submittedTargetId === "WITCH_HEALED" || submittedTargetId === ACTION_TYPES.WITCH_HEAL
      ? "Elixir Used (Healed Victim)"
      : submittedTargetId === "WITCH_SKIPPED" || submittedTargetId === ACTION_TYPES.WITCH_SKIP
      ? "Potions Held (Skip)"
      : livingCandidates.find((c) => c.id === submittedTargetId)?.displayName || "Target Confirmed";

  const handleAction = async (actionType, targetId) => {
    if (isSubmitting || hasSubmitted) return;
    if (!targetId && actionType !== ACTION_TYPES.WITCH_HEAL && actionType !== ACTION_TYPES.WITCH_SKIP) return;
    setIsSubmitting(true);
    try {
      await onSubmitNightAction(actionType, targetId);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Eliminated Observer State
  if (!isAlive) {
    return (
      <div className="gothic-panel night-action-panel observer-mode" role="region" aria-label="Night Observation">
        <div className="panel-header">
          <h3 className="panel-title">Fallen Soul</h3>
          <span className="phase-cycle-label">Spectral Realm</span>
        </div>
        <p className="night-flavor-text font-editorial">
          You walk in the quiet mists of the afterlife. The living move in the dark below, unaware of your presence.
        </p>
        <div className="night-status-pill">
          <span>Observing from the shadows</span>
        </div>
      </div>
    );
  }

  // 2. Villager & Troublemaker Passive Sleep State
  if (role === ROLES.VILLAGER || role === ROLES.TROUBLEMAKER) {
    return (
      <div className="gothic-panel night-action-panel passive-mode" role="region" aria-label="Village Slumber">
        <div className="panel-header">
          <h3 className="panel-title">{role === ROLES.TROUBLEMAKER ? "The Schemer's Slumber" : "Fitful Slumber"}</h3>
          <span className="phase-cycle-label">Behind Locked Shutters</span>
        </div>
        <p className="night-flavor-text font-editorial">
          {role === ROLES.TROUBLEMAKER
            ? "You plot your grand scheme in the shadows, waiting for tomorrow's tribunal. Tonight, sleep soundly."
            : "You bar your cottage doors and clutch your charms. You have no abilities tonight. Pray that dawn arrives without mourning."}
        </p>
        <div className="night-status-pill">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
          <span>Asleep in the quiet dark</span>
        </div>

        {isHost && (
          <div className="host-hasten-container">
            <button type="button" className="gothic-btn gothic-btn-outline" onClick={onProceedToDawn}>
              Hasten the Dawn (Host)
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. Witch Special UI
  if (role === ROLES.WITCH) {
    const healUsed = witchPotions?.healUsed ?? false;
    const poisonUsed = witchPotions?.poisonUsed ?? false;

    return (
      <div
        className="gothic-panel night-action-panel active-role-mode role-witch"
        role="region"
        aria-label="Witch Night Action"
      >
        <div className="panel-header">
          <h3 className="panel-title">Potion Brewmaster</h3>
          <span className="phase-cycle-label" style={{ color: privateRole?.colorAccent || "#9B59B6" }}>
            {privateRole?.role || "WITCH"}
          </span>
        </div>

        <p className="night-flavor-text font-editorial">
          The wolves have struck tonight. Consult your arcane stock and decide whether to intervene.
        </p>

        {!hasSubmitted ? (
          <div className="night-selection-container">
            <div className="witch-potion-card" style={{ opacity: healUsed ? 0.45 : 1 }}>
              <div className="witch-potion-header">
                <span className="witch-potion-icon" aria-hidden="true">🧪</span>
                <span className="witch-potion-name">Elixir of Life</span>
                {healUsed && <span className="witch-potion-used">(Consumed)</span>}
              </div>
              <p className="config-desc">
                Save tonight's werewolf victim from their fate. Single use per match.
              </p>
              <button
                type="button"
                className="gothic-btn gothic-btn-moonlight"
                disabled={isSubmitting || healUsed}
                onClick={() => handleAction(ACTION_TYPES.WITCH_HEAL, null)}
              >
                {healUsed ? "Elixir Spent" : "Use Elixir of Life"}
              </button>
            </div>

            <div className="witch-potion-card" style={{ opacity: poisonUsed ? 0.45 : 1 }}>
              <div className="witch-potion-header">
                <span className="witch-potion-icon" aria-hidden="true">&#x2620;</span>
                <span className="witch-potion-name">Poison Brew</span>
                {poisonUsed && <span className="witch-potion-used">(Consumed)</span>}
              </div>
              <p className="config-desc">
                Administer lethal brew to a suspect tonight. Single use per match. Cannot be blocked by Guard.
              </p>

              <label htmlFor="witch-poison-select" className="night-target-label font-display">
                Select Target:
              </label>
              <select
                id="witch-poison-select"
                className="night-target-select font-sans"
                value={selectedCandidate?.id || ""}
                onChange={(e) => onSelectCandidate(e.target.value)}
                disabled={poisonUsed}
              >
                <option value="">-- Choose a suspect --</option>
                {livingCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.displayName}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="gothic-btn gothic-btn-burgundy"
                disabled={isSubmitting || poisonUsed || !selectedCandidate}
                onClick={() => handleAction(ACTION_TYPES.WITCH_POISON, selectedCandidate?.id)}
              >
                {poisonUsed
                  ? "Poison Spent"
                  : selectedCandidate
                  ? `Poison ${selectedCandidate.displayName}`
                  : "Select a Target"}
              </button>
            </div>

            <button
              type="button"
              className="gothic-btn gothic-btn-outline"
              style={{ marginTop: "8px", width: "100%" }}
              disabled={isSubmitting}
              onClick={() => handleAction(ACTION_TYPES.WITCH_SKIP, null)}
            >
              Hold All Potions (Skip Night)
            </button>
          </div>
        ) : (
          <div className="night-confirmed-box" role="status">
            <div className="confirmed-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h4 className="confirmed-title font-display">Witch Decision Locked</h4>
              <p className="confirmed-desc font-editorial">
                Decision: <strong>{submittedCandidateName}</strong>. The dawn will reveal all.
              </p>
            </div>
          </div>
        )}

        {isHost && (
          <div className="host-hasten-container">
            <button type="button" className="gothic-btn gothic-btn-outline" onClick={onProceedToDawn}>
              Hasten the Dawn (Host)
            </button>
          </div>
        )}
      </div>
    );
  }

  // 4. Active Night Roles: Werewolf, Seer, Guard, Hunter
  return (
    <div
      className={`gothic-panel night-action-panel active-role-mode role-${role?.toLowerCase()}`}
      role="region"
      aria-label="Night Role Action"
    >
      <div className="panel-header">
        <h3 className="panel-title">
          {role === ROLES.WEREWOLF && "Pack Hunt"}
          {role === ROLES.SEER && "Astral Divination"}
          {role === ROLES.GUARD && "Sacred Ward"}
          {role === ROLES.HUNTER && "Moonlight Ambush"}
        </h3>
        <span
          className="phase-cycle-label"
          style={{ color: privateRole?.colorAccent || "var(--color-gold)" }}
        >
          {privateRole?.role || "Active Role"}
        </span>
      </div>

      <p className="night-flavor-text font-editorial">
        {role === ROLES.WEREWOLF &&
          "Coordinate with your pack to stalk a villager. Select your quarry beneath the blood moon."}
        {role === ROLES.SEER &&
          "Peer beneath the mortal veil. Select one living soul to discover if they harbor the beast within."}
        {role === ROLES.GUARD &&
          "Choose one soul to protect tonight. If the wolves or hunters strike them, your shield shall hold."}
        {role === ROLES.HUNTER &&
          "Take aim with your silver arrow at a suspect tonight, or choose to hold your fire."}
      </p>

      {!hasSubmitted ? (
        <div className="night-selection-container">
          <label htmlFor="night-target-select" className="night-target-label font-display">
            Target Selection:
          </label>
          <select
            id="night-target-select"
            className="night-target-select font-sans"
            value={selectedCandidate?.id || ""}
            onChange={(e) => onSelectCandidate(e.target.value)}
          >
            <option value="">-- Choose a living soul --</option>
            {livingCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName}
              </option>
            ))}
          </select>

          <div className="night-actions-btn-group">
            {role === ROLES.WEREWOLF && (
              <button
                type="button"
                className="gothic-btn gothic-btn-burgundy night-commit-btn"
                disabled={!selectedCandidate || isSubmitting}
                onClick={() => handleAction(ACTION_TYPES.WEREWOLF_ATTACK, selectedCandidate.id)}
              >
                {selectedCandidate ? `Hunt ${selectedCandidate.displayName}` : "Select Quarry to Hunt"}
              </button>
            )}

            {role === ROLES.SEER && (
              <button
                type="button"
                className="gothic-btn gothic-btn-moonlight night-commit-btn"
                disabled={!selectedCandidate || isSubmitting}
                onClick={() => handleAction(ACTION_TYPES.SEER_INVESTIGATE, selectedCandidate.id)}
              >
                {selectedCandidate ? `Divine ${selectedCandidate.displayName}` : "Select Soul to Divine"}
              </button>
            )}

            {role === ROLES.GUARD && (
              <button
                type="button"
                className="gothic-btn gothic-btn-gold night-commit-btn"
                disabled={!selectedCandidate || isSubmitting}
                onClick={() => handleAction(ACTION_TYPES.GUARD_PROTECT, selectedCandidate.id)}
              >
                {selectedCandidate ? `Protect ${selectedCandidate.displayName}` : "Select Soul to Shield"}
              </button>
            )}

            {role === ROLES.HUNTER && (
              <div className="hunter-btn-row">
                <button
                  type="button"
                  className="gothic-btn gothic-btn-outline"
                  disabled={isSubmitting}
                  onClick={() => handleAction(ACTION_TYPES.HUNTER_SKIP, SKIP_TARGET)}
                >
                  Hold Fire (Skip)
                </button>
                <button
                  type="button"
                  className="gothic-btn gothic-btn-burgundy"
                  disabled={!selectedCandidate || isSubmitting}
                  onClick={() => handleAction(ACTION_TYPES.HUNTER_SHOOT, selectedCandidate.id)}
                >
                  {selectedCandidate ? `Shoot ${selectedCandidate.displayName}` : "Select Target"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="night-confirmed-box" role="status">
          <div className="confirmed-icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <h4 className="confirmed-title font-display">Night Action Locked</h4>
            <p className="confirmed-desc font-editorial">
              Selection: <strong>{submittedCandidateName}</strong>. Your choice is recorded. Simultaneous resolution will take place at dawn.
            </p>
          </div>
        </div>
      )}

      {isHost && (
        <div className="host-hasten-container">
          <button type="button" className="gothic-btn gothic-btn-outline" onClick={onProceedToDawn}>
            Hasten the Dawn (Host)
          </button>
        </div>
      )}
    </div>
  );
}
