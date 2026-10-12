import { useState, useEffect, useCallback } from "react";
import { connectSocket, disconnectSocket, getSocket } from "./services/socket.js";
import { ROLES, ROLE_METADATA } from "./constants/index.js";
import "./App.css";

function App() {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [socketId, setSocketId] = useState(null);
  const [serverWelcome, setServerWelcome] = useState(null);
  const [pingLatency, setPingLatency] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  
  // Card reveal preview state
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedRole, setSelectedRole] = useState(ROLES.WEREWOLF);

  useEffect(() => {
    const socket = connectSocket();

    const handleConnect = () => {
      setConnectionStatus("connected");
      setSocketId(socket.id);
    };

    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
      setSocketId(null);
    };

    const handleConnectError = () => {
      setConnectionStatus("disconnected");
    };

    const handleWelcome = (data) => {
      setServerWelcome(data?.message || "Connected");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("server:welcome", handleWelcome);

    // Initial check
    if (socket.connected) {
      setConnectionStatus("connected");
      setSocketId(socket.id);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("server:welcome", handleWelcome);
    };
  }, []);

  const handlePing = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    setIsPinging(true);
    const start = performance.now();

    socket.emit("client:ping", {}, (res) => {
      const elapsed = Math.round(performance.now() - start);
      setPingLatency(elapsed);
      setIsPinging(false);
    });

    // Fallback timeout in case callback is not acknowledged
    setTimeout(() => {
      setIsPinging(false);
    }, 3000);
  }, []);

  const handleToggleConnection = () => {
    const socket = getSocket();
    if (socket.connected) {
      disconnectSocket();
      setConnectionStatus("disconnected");
    } else {
      setConnectionStatus("connecting");
      connectSocket();
    }
  };

  const handleCardKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsFlipped((prev) => !prev);
    }
  };

  const currentRoleMeta = ROLE_METADATA[selectedRole] || ROLE_METADATA[ROLES.WEREWOLF];

  return (
    <div className="app-shell">
      <header className="header">
        <span className="title-badge">Multiplayer Engine</span>
        <h1 className="main-title">Werewolf</h1>
        <p className="subtitle">Gothic Social Deduction</p>
      </header>

      <main className="dashboard-grid">
        {/* Panel 1: Multiplayer Foundation Status */}
        <section className="gothic-panel" aria-labelledby="status-heading">
          <div className="panel-header">
            <h2 id="status-heading" className="panel-title">Server Connection</h2>
            <div className={`status-pill status-${connectionStatus}`}>
              <span className="status-indicator-dot" aria-hidden="true" />
              <span>{connectionStatus}</span>
            </div>
          </div>

          <div className="info-rows">
            <div className="info-row">
              <span className="info-label">Socket ID</span>
              <span className="info-value tabular-nums">{socketId || "Not assigned"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Backend Message</span>
              <span className="info-value">{serverWelcome || "Waiting for handshake"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Round-Trip Latency</span>
              <span className="info-value tabular-nums">
                {pingLatency !== null ? `${pingLatency} ms` : "Not measured"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Active Milestone</span>
              <span className="info-value">Milestone 1: Foundation</span>
            </div>
          </div>

          <div className="panel-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handlePing}
              disabled={connectionStatus !== "connected" || isPinging}
            >
              {isPinging ? "Pinging..." : "Test Server Ping"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleToggleConnection}
            >
              {connectionStatus === "connected" ? "Disconnect" : "Reconnect"}
            </button>
          </div>
        </section>

        {/* Panel 2: Gothic Role Card Preview */}
        <section className="gothic-panel" aria-labelledby="card-heading">
          <div className="panel-header">
            <h2 id="card-heading" className="panel-title">Role Card Preview</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsFlipped((prev) => !prev)}
              aria-label="Flip secret role card"
            >
              {isFlipped ? "Cover Card" : "Reveal Card"}
            </button>
          </div>

          <div className="card-preview-container">
            <div
              className="card-flip-stage"
              tabIndex={0}
              role="button"
              aria-label={`Secret role card for ${currentRoleMeta.name}. Currently ${isFlipped ? "revealed" : "face down"}. Press Enter or Space to flip.`}
              onKeyDown={handleCardKeyDown}
              onClick={() => setIsFlipped((prev) => !prev)}
            >
              <div className={`card-inner ${isFlipped ? "is-flipped" : ""}`}>
                {/* Back Face */}
                <div className="card-face card-back">
                  <div className="card-back-ornament">
                    <svg
                      className="sigil-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                      <path d="M12 6a6 6 0 0 0-6 6 6 6 0 0 0 12 0 6 6 0 0 0-6-6z" />
                      <circle cx="12" cy="12" r="2" />
                    </svg>
                    <span className="card-back-text">Werewolf</span>
                  </div>
                </div>

                {/* Front Face */}
                <div
                  className="card-face card-front"
                  style={{ borderColor: currentRoleMeta.colorAccent }}
                >
                  <div>
                    <div
                      className="card-header-tag"
                      style={{ color: currentRoleMeta.colorAccent }}
                    >
                      {currentRoleMeta.faction} Faction
                    </div>
                    <div
                      className="card-art-frame"
                      style={{
                        borderColor: currentRoleMeta.colorAccent,
                        background: `radial-gradient(circle at 50% 50%, ${currentRoleMeta.colorAccent}33 0%, #15161A 85%)`,
                      }}
                    >
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={currentRoleMeta.colorAccent}
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
                    <h3 className="card-role-name">{currentRoleMeta.name}</h3>
                  </div>

                  <p className="card-role-desc">{currentRoleMeta.description}</p>
                </div>
              </div>
            </div>

            {/* Role Switcher Chips */}
            <div className="role-chips" role="radiogroup" aria-label="Select role to preview">
              {Object.keys(ROLES).map((roleKey) => (
                <button
                  key={roleKey}
                  type="button"
                  role="radio"
                  aria-checked={selectedRole === roleKey}
                  className={`role-chip ${selectedRole === roleKey ? "is-active" : ""}`}
                  onClick={() => setSelectedRole(roleKey)}
                >
                  {ROLE_METADATA[roleKey].name}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer-notes">
        <p>Gothic Tabletop System: Real-time Socket.IO synchronization active.</p>
      </footer>
    </div>
  );
}

export default App;
