import { useState } from "react";
import "./LobbyScreen.css";

const DEFAULT_CONFIG = {
  werewolfCount: 2,
  seerCount: 1,
  guardCount: 2,
  hunterCount: 2,
  witchCount: 0,
  troublemakerEnabled: false,
  discussionTimer: 240,
};

function RoleStepper({ label, description, value, min, max, onChange, isHost, colorAccent }) {
  return (
    <div className="config-group">
      <div className="config-label-row">
        <span className="config-label" style={{ color: isHost ? colorAccent || undefined : undefined }}>
          {label}
        </span>
        <span className="config-desc">{description}</span>
      </div>
      {isHost ? (
        <div className="stepper-control">
          <button
            type="button"
            className="stepper-btn"
            onClick={() => onChange(-1)}
            disabled={value <= min}
            aria-label={`Decrease ${label}`}
          >
            -
          </button>
          <span className="stepper-value tabular-nums">{value}</span>
          <button
            type="button"
            className="stepper-btn"
            onClick={() => onChange(1)}
            disabled={value >= max}
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      ) : (
        <span className="info-value tabular-nums">
          {value > 0 ? `${value} ${label}${value !== 1 ? "s" : ""}` : `None`}
        </span>
      )}
    </div>
  );
}

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
  const config = room.config || DEFAULT_CONFIG;
  const validation = room.validation || {
    valid: false,
    minPlayersRequired: 6,
    totalPlayers: room.players?.length || 0,
    errors: ["Awaiting players"],
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRoleChange = (field, delta) => {
    if (!isHost) return;
    const min = field === "werewolfCount" ? 1 : 0;
    const max = field === "werewolfCount" ? 8 : 4;
    const current = config[field] ?? (field === "werewolfCount" ? 2 : field === "seerCount" || field === "guardCount" || field === "hunterCount" ? 1 : 0);
    const newCount = Math.max(min, Math.min(max, current + delta));
    if (newCount !== current) {
      onConfigureRoom({ ...config, [field]: newCount });
    }
  };

  const handleTroublemakerToggle = () => {
    if (!isHost) return;
    onConfigureRoom({ ...config, troublemakerEnabled: !config.troublemakerEnabled });
  };

  const handleTimerChange = (e) => {
    if (!isHost) return;
    onConfigureRoom({ ...config, discussionTimer: parseInt(e.target.value, 10) });
  };

  const werewolfCount = config.werewolfCount ?? 2;
  const seerCount = config.seerCount ?? 1;
  const guardCount = config.guardCount ?? 2;
  const hunterCount = config.hunterCount ?? 2;
  const witchCount = config.witchCount ?? 0;
  const troublemakerEnabled = config.troublemakerEnabled ?? false;

  const roleBreakdown = [
    werewolfCount > 0 && `${werewolfCount} Werewolf${werewolfCount !== 1 ? "es" : ""}`,
    seerCount > 0 && `${seerCount} Seer${seerCount !== 1 ? "s" : ""}`,
    guardCount > 0 && `${guardCount} Guard${guardCount !== 1 ? "s" : ""}`,
    hunterCount > 0 && `${hunterCount} Hunter${hunterCount !== 1 ? "s" : ""}`,
    witchCount > 0 && `${witchCount} Witch${witchCount !== 1 ? "es" : ""}`,
    troublemakerEnabled && "1 Troublemaker",
    validation.villagerCount > 0 && `${validation.villagerCount} Villager${validation.villagerCount !== 1 ? "s" : ""}`,
  ].filter(Boolean);

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
            {/* --- Werewolf Pack --- */}
            <div className="config-section-label">Werewolf Faction</div>

            <RoleStepper
              label="Werewolf"
              description="Pack Size"
              value={werewolfCount}
              min={1}
              max={8}
              onChange={(d) => handleRoleChange("werewolfCount", d)}
              isHost={isHost}
              colorAccent="#8D343B"
            />

            {/* --- Village Special Roles --- */}
            <div className="config-section-label" style={{ marginTop: "12px" }}>Village Special Roles</div>

            <RoleStepper
              label="Seer"
              description="Divine Investigator"
              value={seerCount}
              min={0}
              max={4}
              onChange={(d) => handleRoleChange("seerCount", d)}
              isHost={isHost}
              colorAccent="#7889A6"
            />

            <RoleStepper
              label="Guard"
              description="Night Protector"
              value={guardCount}
              min={0}
              max={4}
              onChange={(d) => handleRoleChange("guardCount", d)}
              isHost={isHost}
              colorAccent="#C6A66B"
            />

            <RoleStepper
              label="Hunter"
              description="Moonlit Archer"
              value={hunterCount}
              min={0}
              max={4}
              onChange={(d) => handleRoleChange("hunterCount", d)}
              isHost={isHost}
              colorAccent="#A7A2A0"
            />

            <RoleStepper
              label="Witch"
              description="Elixir and Poison"
              value={witchCount}
              min={0}
              max={4}
              onChange={(d) => handleRoleChange("witchCount", d)}
              isHost={isHost}
              colorAccent="#9B59B6"
            />

            {/* --- Troublemaker --- */}
            <div className="config-section-label" style={{ marginTop: "12px" }}>Independent Faction</div>

            <div className="config-group">
              <div className="config-label-row">
                <span className="config-label">Troublemaker</span>
                <span className="config-desc">Chaos Faction</span>
              </div>
              {isHost ? (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={troublemakerEnabled}
                    onChange={handleTroublemakerToggle}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
                    aria-label="Enable Troublemaker role"
                  />
                  <div
                    className={`custom-checkbox ${troublemakerEnabled ? "is-checked" : ""}`}
                    aria-hidden="true"
                  >
                    {troublemakerEnabled && "✓"}
                  </div>
                  <div>
                    <span className="info-value">
                      {troublemakerEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <p className="config-desc">
                      Independent agent who wins only by daytime execution.
                    </p>
                  </div>
                </label>
              ) : (
                <p className="info-value">
                  {troublemakerEnabled ? "Enabled" : "Disabled"}
                </p>
              )}
            </div>

            {/* Discussion Timer */}
            <div className="config-section-label" style={{ marginTop: "12px" }}>Session Settings</div>

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
                  <option value={30}>30 Seconds</option>
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
              className={`validation-card ${validation.valid ? "is-ready" : "is-waiting"}`}
              role="status"
            >
              <h3 className="validation-title">
                {validation.valid
                  ? "Chamber Ready to Hunt"
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
                  {roleBreakdown.join(", ")}.
                </p>
              )}
            </div>

            {/* Start Button (Host only) */}
            {isHost ? (
              <>
                {!import.meta.env.PROD && !validation.valid && onAddTestPlayers && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: "100%", marginTop: "12px", borderStyle: "dashed" }}
                    onClick={onAddTestPlayers}
                  >
                    Summon Test Villagers
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
