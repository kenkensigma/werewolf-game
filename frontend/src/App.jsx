import { useState, useEffect, useCallback } from "react";
import { connectSocket, disconnectSocket, getSocket } from "./services/socket.js";
import { SOCKET_EVENTS, PHASES } from "./constants/index.js";
import { LandingScreen } from "./features/landing/LandingScreen.jsx";
import { LobbyScreen } from "./features/lobby/LobbyScreen.jsx";
import { RoleRevealScreen } from "./features/role-reveal/RoleRevealScreen.jsx";
import "./App.css";

const SESSION_STORAGE_KEY = "werewolf_player_session";

function App() {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [socketId, setSocketId] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Game state & private role
  const [gameState, setGameState] = useState(null);
  const [privateRole, setPrivateRole] = useState(null);
  const [isRoleAcknowledged, setIsRoleAcknowledged] = useState(false);

  // Resume stored session on mount if available
  useEffect(() => {
    const socket = connectSocket();

    const handleConnect = () => {
      setConnectionStatus("connected");
      setSocketId(socket.id);

      // Attempt to resume previous session from storage
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        try {
          const { token, code } = JSON.parse(stored);
          if (token && code) {
            socket.emit(
              SOCKET_EVENTS.SESSION_RESUME,
              { sessionToken: token, roomCode: code },
              (res) => {
                if (res?.success) {
                  setCurrentRoom(res.room);
                  setCurrentPlayer(res.player);
                  setSessionToken(token);
                  if (res.game) {
                    setGameState(res.game);
                  }
                  if (res.privateRole) {
                    setPrivateRole(res.privateRole);
                  }
                } else {
                  sessionStorage.removeItem(SESSION_STORAGE_KEY);
                }
              }
            );
          }
        } catch {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    };

    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
      setSocketId(null);
    };

    const handleConnectError = () => {
      setConnectionStatus("disconnected");
    };

    const handleRoomState = (roomState) => {
      setCurrentRoom(roomState);
      setCurrentPlayer((prev) => {
        if (!prev) return prev;
        const updatedSelf = roomState.players.find((p) => p.id === prev.id);
        return updatedSelf || prev;
      });
    };

    const handleRoomError = ({ message }) => {
      setErrorMessage(message || "An unexpected room error occurred");
      setIsLoading(false);
    };

    const handleGameStarted = (publicGameState) => {
      setGameState(publicGameState);
      setIsRoleAcknowledged(false);
    };

    const handleGameYourRole = (rolePayload) => {
      setPrivateRole(rolePayload);
    };

    const handleGamePhase = (updatedGameState) => {
      setGameState(updatedGameState);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
    socket.on(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
    socket.on(SOCKET_EVENTS.GAME_YOUR_ROLE, handleGameYourRole);
    socket.on(SOCKET_EVENTS.GAME_PHASE, handleGamePhase);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
      socket.off(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
      socket.off(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
      socket.off(SOCKET_EVENTS.GAME_YOUR_ROLE, handleGameYourRole);
      socket.off(SOCKET_EVENTS.GAME_PHASE, handleGamePhase);
    };
  }, []);

  // Create Room Action
  const handleCreateRoom = useCallback(({ displayName }) => {
    const socket = getSocket();
    if (!socket.connected) {
      setErrorMessage("Not connected to the server. Please wait or reconnect.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    socket.emit(SOCKET_EVENTS.ROOM_CREATE, { displayName }, (response) => {
      setIsLoading(false);
      if (response?.success) {
        setCurrentRoom(response.room);
        setCurrentPlayer(response.player);
        setSessionToken(response.sessionToken);
        setGameState(null);
        setPrivateRole(null);
        setIsRoleAcknowledged(false);
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ token: response.sessionToken, code: response.room.roomCode })
        );
      } else {
        setErrorMessage(response?.error || "Failed to create room");
      }
    });
  }, []);

  // Join Room Action
  const handleJoinRoom = useCallback(({ roomCode, displayName }) => {
    const socket = getSocket();
    if (!socket.connected) {
      setErrorMessage("Not connected to the server. Please wait or reconnect.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    socket.emit(SOCKET_EVENTS.ROOM_JOIN, { roomCode, displayName }, (response) => {
      setIsLoading(false);
      if (response?.success) {
        setCurrentRoom(response.room);
        setCurrentPlayer(response.player);
        setSessionToken(response.sessionToken);
        setGameState(null);
        setPrivateRole(null);
        setIsRoleAcknowledged(false);
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ token: response.sessionToken, code: response.room.roomCode })
        );
      } else {
        setErrorMessage(response?.error || "Failed to join room");
      }
    });
  }, []);

  // Configure Room Action (Host)
  const handleConfigureRoom = useCallback((newConfig) => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit(SOCKET_EVENTS.ROOM_CONFIGURE, newConfig, (response) => {
      if (response?.success) {
        setCurrentRoom(response.room);
      } else {
        setErrorMessage(response?.error || "Failed to update chamber settings");
      }
    });
  }, []);

  // Add Test Villagers Action (Dev Helper)
  const handleAddTestPlayers = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit("room:add-test-players", {}, (response) => {
      if (response?.success) {
        setCurrentRoom(response.room);
      } else {
        setErrorMessage(response?.error || "Could not summon test villagers");
      }
    });
  }, []);

  // Leave Room Action
  const handleLeaveRoom = useCallback(() => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit(SOCKET_EVENTS.ROOM_LEAVE);
    }
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentRoom(null);
    setCurrentPlayer(null);
    setSessionToken(null);
    setGameState(null);
    setPrivateRole(null);
    setIsRoleAcknowledged(false);
    setErrorMessage("");
  }, []);

  // Start Game Action (Host)
  const handleStartGame = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    setIsLoading(true);
    setErrorMessage("");

    socket.emit(SOCKET_EVENTS.GAME_START, {}, (response) => {
      setIsLoading(false);
      if (response?.success) {
        setGameState(response.game);
      } else {
        setErrorMessage(response?.error || "Game start criteria not met");
      }
    });
  }, []);

  // Acknowledge Role Action
  const handleAcknowledgeRole = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit("reveal:ready", {}, (response) => {
      if (response?.success) {
        setIsRoleAcknowledged(true);
        if (response.game) {
          setGameState(response.game);
        }
      }
    });
  }, []);

  // Determine current active view
  const isRoleRevealPhase =
    currentRoom?.status === PHASES.ROLE_REVEAL ||
    gameState?.phase === PHASES.ROLE_REVEAL;

  return (
    <div className="app-shell">
      <header className="header">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span className="title-badge">Multiplayer Engine</span>
          <div className={`status-pill status-${connectionStatus}`} style={{ fontSize: "11px", padding: "2px 8px" }}>
            <span className="status-indicator-dot" aria-hidden="true" />
            <span>{connectionStatus}</span>
          </div>
        </div>
        <h1 className="main-title">Werewolf</h1>
        <p className="subtitle">Gothic Social Deduction</p>
      </header>

      <main style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        {!currentRoom && (
          <LandingScreen
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        )}

        {currentRoom && !isRoleRevealPhase && currentRoom.status === PHASES.LOBBY && (
          <LobbyScreen
            room={currentRoom}
            currentPlayer={currentPlayer}
            onConfigureRoom={handleConfigureRoom}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveRoom}
            onAddTestPlayers={handleAddTestPlayers}
            isStarting={isLoading}
          />
        )}

        {currentRoom && isRoleRevealPhase && (
          <RoleRevealScreen
            roleInfo={privateRole}
            playerName={currentPlayer?.displayName || "Villager"}
            gameState={gameState}
            isReady={isRoleAcknowledged}
            onAcknowledge={handleAcknowledgeRole}
          />
        )}
      </main>

      <footer className="footer-notes">
        <p>Gothic Tabletop System: Authoritative server state active.</p>
      </footer>
    </div>
  );
}

export default App;
