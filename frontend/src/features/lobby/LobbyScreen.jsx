import { useState } from "react";
import "./LobbyScreen.css";

export function LobbyScreen({
  room,
  currentPlayer,
  onConfigureRoom,
  onStartGame,
  onLeaveRoom,
  onAddTestPlayers,
  isStarting,
}) {
  const [copied, setCopied] = useState(false);

  const isHost = currentPlayer?.isHost;
  const config = room.config || {
    werewolfCount: 2,
    troublemakerEnabled: false,
    discussionTimer: 240,
  };
  const validation = room.validation || {
    valid: false,
    minPlayersRequired: config.troublemakerEnabled ? 9 : 8,
    totalPlayers: room.players?.length || 0,
    errors: ["Awaiting players"],
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWerewolfChange = (delta) => {
    if (!isHost) return;
    const newCount = Math.max(1, Math.min(8, config.werewolfCount + delta));
    if (newCount !== config.werewolfCount) {
      onConfigureRoom({
        ...config,
        werewolfCount: newCount,
      });
    }
  };

  const handleTroublemakerToggle = () => {
    if (!isHost) return;
    onConfigureRoom({
      ...config,
      troublemakerEnabled: !config.troublemakerEnabled,
    });
  };

  const handleTimerChange = (e) => {
    if (!isHost) return;
    onConfigureRoom({
      ...config,
      discussionTimer: parseInt(e.target.value, 10),
    });
  };

  return (
    <div className="lobby-container" role="region" aria-label="Game Lobby">
      {/* Top Banner: Chamber Code and Exit Action */}
      <div className="lobby-header-panel">
        <div className="lobby-code-block">
          <span className="lobby-code-label">Chamber Room Code</span>
          <div className="lobby-code-row">
            <span className="lobby-code-badge" aria-label={`Room Code: ${room.roomCode}`}>
              {room.roomCode}
            </span>
            <button
              type="button"
              className="copy-btn"
              onClick={handleCopyCode}
              aria-label="Copy room code to clipboard"
            >
              {copied ? "Code Copied!" : "Copy Code"}
            </button>
          </div>
        </div>

        <div className="lobby-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onLeaveRoom}
          >
            Leave Chamber
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="lobby-grid">
        {/* Left Column: Player Roster */}
        <section className="roster-card" aria-labelledby="roster-heading">
          <div className="roster-header">
            <h2 id="roster-heading" className="roster-title">
              Connected Villagers
            </h2>
            <span className="roster-count tabular-nums">
              {room.players.length} / {validation.minPlayersRequired} Required
            </span>
          </div>

          <ul className="player-list" aria-label="List of players in room">
            {room.players.map((player) => {
              const isYou = player.id === currentPlayer?.id;
              return (
                <li
                  key={player.id}
                  className={`player-item ${isYou ? "is-current-user" : ""}`}
                >
                  <div className="player-identity">
                    <span
                      className={`player-dot ${!player.isConnected ? "is-offline" : ""}`}
                      title={player.isConnected ? "Connected" : "Disconnected"}
                      aria-label={player.isConnected ? "Connected" : "Disconnected"}
                    />
                    <span className="player-name">{player.displayName}</span>
                    {isYou && <span className="player-badge-you">(You)</span>}
                  </div>

                  {player.isHost && (
                    <span className="player-badge-host" title="Room Host">
                      Host
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Right Column: Game Configuration */}
        <section className="settings-card" aria-labelledby="settings-heading">
          <div className="settings-header">
            <h2 id="settings-heading" className="settings-title">
              Chamber Rules
            </h2>
            <span className="settings-badge">
              {isHost ? "Host Configuration" : "View Only"}
            </span>
          </div>

          <div className="config-form">
            {/* Werewolf Count */}
            <div className="config-group">
              <div className="config-label-row">
                <span className="config-label">Werewolf Count</span>
                <span className="config-desc">Pack Size</span>
              </div>
              {isHost ? (
                <div className="stepper-control">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => handleWerewolfChange(-1)}
                    disabled={config.werewolfCount <= 1}
                    aria-label="Decrease Werewolf count"
                  >
                    -
                  </button>
                  <span className="stepper-value tabular-nums">{config.werewolfCount}</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => handleWerewolfChange(1)}
                    disabled={config.werewolfCount >= 8}
                    aria-label="Increase Werewolf count"
                  >
                    +
                  </button>
                </div>
              ) : (
                <span className="info-value tabular-nums">{config.werewolfCount} Werewolves</span>
              )}
              <p className="config-desc">
                Default 2 beasts hunt the village each night.
              </p>
            </div>

            {/* Troublemaker Toggle */}
            <div className="config-group">
              <div className="config-label-row">
                <span className="config-label">Troublemaker Role</span>
                <span className="config-desc">Chaos Faction</span>
              </div>
              {isHost ? (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.troublemakerEnabled}
                    onChange={handleTroublemakerToggle}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                    aria-label="Enable Troublemaker role"
                  />
                  <div
                    className={`custom-checkbox ${
                      config.troublemakerEnabled ? "is-checked" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {config.troublemakerEnabled && "✓"}
                  </div>
                  <div>
                    <span className="info-value">
                      {config.troublemakerEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <p className="config-desc">
                      Independent agent who wins only by daytime execution. Increases required minimum to 9 players.
                    </p>
                  </div>
                </label>
              ) : (
                <p className="info-value">
                  {config.troublemakerEnabled ? "Enabled (9 Players Required)" : "Disabled"}
                </p>
              )}
            </div>

            {/* Discussion Timer */}
            <div className="config-group">
              <div className="config-label-row">
                <span className="config-label">Daytime Discussion</span>
                <span className="config-desc">Timer</span>
              </div>
              {isHost ? (
                <select
                  className="config-select"
                  value={config.discussionTimer}
                  onChange={handleTimerChange}
                  aria-label="Select discussion duration"
                >
                  <option value={30}>30 Seconds (Testing Quick)</option>
                  <option value={60}>1 Minute</option>
                  <option value={120}>2 Minutes</option>
                  <option value={240}>4 Minutes (Standard)</option>
                  <option value={300}>5 Minutes</option>
                </select>
              ) : (
                <p className="info-value tabular-nums">{config.discussionTimer} Seconds</p>
              )}
              <p className="config-desc">
                Server-controlled countdown before public voting commences.
              </p>
            </div>

            {/* Start Validation Banner */}
            <div
              className={`validation-card ${
                validation.valid ? "is-ready" : "is-waiting"
              }`}
              role="status"
            >
              <h3 className="validation-title">
                {validation.valid
                  ? "✓ Chamber Ready to Hunt"
                  : "Requirements Remaining"}
              </h3>
              {!validation.valid && (
                <ul className="validation-list">
                  {validation.errors?.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
              {validation.valid && (
                <p className="config-desc" style={{ color: "var(--color-success)" }}>
                  All requirements met: 1 Seer, 2 Guards, 2 Hunters, {config.werewolfCount} Werewolves, {config.troublemakerEnabled ? "1 Troublemaker, " : ""}and at least 1 Villager.
                </p>
              )}
            </div>

            {/* Start Button (Host only) */}
            {isHost ? (
              <>
                {!validation.valid && onAddTestPlayers && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: "100%", marginTop: "12px", borderStyle: "dashed" }}
                    onClick={onAddTestPlayers}
                  >
                    Summon Test Villagers (Dev Helper)
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary start-game-btn"
                  disabled={!validation.valid || isStarting}
                  onClick={onStartGame}
                >
                  {isStarting ? "Distributing Secret Roles..." : "Begin Game"}
                </button>
              </>
            ) : (
              <p className="config-desc" style={{ textAlign: "center", marginTop: 12 }}>
                Waiting for the host to begin the match.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
