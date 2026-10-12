import { useState } from "react";
import "./LandingScreen.css";

export function LandingScreen({ onCreateRoom, onJoinRoom, isLoading, errorMessage }) {
  const [activeTab, setActiveTab] = useState("create"); // 'create' | 'join'
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError("");

    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setLocalError("Please enter a display name with at least 2 characters.");
      return;
    }

    if (trimmedName.length > 24) {
      setLocalError("Display name cannot exceed 24 characters.");
      return;
    }

    if (activeTab === "create") {
      onCreateRoom({ displayName: trimmedName });
    } else {
      const cleanCode = roomCode.trim().toUpperCase();
      if (!cleanCode || cleanCode.length !== 6) {
        setLocalError("Room code must be exactly 6 characters.");
        return;
      }
      onJoinRoom({ roomCode: cleanCode, displayName: trimmedName });
    }
  };

  const displayedError = localError || errorMessage;

  return (
    <div className="landing-card" role="region" aria-label="Game Entrance">
      <div className="landing-tabs" role="tablist" aria-label="Game Actions">
        <button
          type="button"
          role="tab"
          id="tab-create"
          aria-selected={activeTab === "create"}
          aria-controls="panel-create"
          className={`landing-tab ${activeTab === "create" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("create");
            setLocalError("");
          }}
        >
          Create Room
        </button>
        <button
          type="button"
          role="tab"
          id="tab-join"
          aria-selected={activeTab === "join"}
          aria-controls="panel-join"
          className={`landing-tab ${activeTab === "join" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("join");
            setLocalError("");
          }}
        >
          Join Room
        </button>
      </div>

      {displayedError && (
        <div className="error-banner" role="alert">
          <svg
            className="error-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{displayedError}</span>
        </div>
      )}

      <form className="landing-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="displayNameInput" className="form-label">
            Your Player Identity
          </label>
          <input
            id="displayNameInput"
            type="text"
            className="form-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Cassandra"
            maxLength={24}
            required
            autoComplete="nickname"
            disabled={isLoading}
          />
          <p className="form-help">Choose the name your fellow villagers will know you by.</p>
        </div>

        {activeTab === "join" && (
          <div className="form-field" id="panel-join" role="tabpanel" aria-labelledby="tab-join">
            <label htmlFor="roomCodeInput" className="form-label">
              Six-Character Room Code
            </label>
            <input
              id="roomCodeInput"
              type="text"
              className="form-input room-code-input"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABCXYZ"
              maxLength={6}
              required
              autoCapitalize="characters"
              disabled={isLoading}
            />
            <p className="form-help">Ask your host for their chamber code.</p>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary landing-submit-btn"
          disabled={isLoading}
        >
          {isLoading
            ? "Summoning Chamber..."
            : activeTab === "create"
            ? "Create New Room"
            : "Enter Game Room"}
        </button>
      </form>
    </div>
  );
}
