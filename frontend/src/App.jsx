import { useState, useEffect, useCallback } from "react";
import { connectSocket, disconnectSocket, getSocket } from "./services/socket.js";
import { SOCKET_EVENTS, PHASES, ACTION_TYPES } from "./constants/index.js";
import { LandingScreen } from "./features/landing/LandingScreen.jsx";
import { LobbyScreen } from "./features/lobby/LobbyScreen.jsx";
import { RoleRevealScreen } from "./features/role-reveal/RoleRevealScreen.jsx";
import { ActiveGameView } from "./features/gameplay/ActiveGameView.jsx";
import { GameOverScreen } from "./features/gameplay/GameOverScreen.jsx";
import { AudioControlsWidget } from "./features/audio/AudioControlsWidget.jsx";
import { audioService, SFX_TYPES, BGM_TRACKS } from "./services/audioService.js";
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

  // Discussion & Voting live state
  const [chatMessages, setChatMessages] = useState([]);
  const [votingState, setVotingState] = useState(null);
  const [latestVotingResult, setLatestVotingResult] = useState(null);

  // Night phase & Elimination state
  const [submittedNightTargetId, setSubmittedNightTargetId] = useState(null);
  const [seerInvestigationResult, setSeerInvestigationResult] = useState(null);
  const [latestElimination, setLatestElimination] = useState(null);
  const [isRematching, setIsRematching] = useState(false);
  const [witchPotions, setWitchPotions] = useState({ healUsed: false, poisonUsed: false });

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
      setChatMessages([]);
      setVotingState(null);
      setLatestVotingResult(null);
      setSubmittedNightTargetId(null);
      setSeerInvestigationResult(null);
      setLatestElimination(null);
      setWitchPotions({ healUsed: false, poisonUsed: false });
      audioService.playSfx(SFX_TYPES.GAME_START);
      audioService.playBgmForPhase(publicGameState.phase);
    };

    const handleGameYourRole = (rolePayload) => {
      setPrivateRole(rolePayload);
    };

    const handleGamePhase = (updatedGameState) => {
      setGameState(updatedGameState);
      if (updatedGameState.phase === PHASES.NIGHT) {
        setSubmittedNightTargetId(null);
        setLatestVotingResult(null);
        audioService.playSfx(SFX_TYPES.WOLF_HOWL);
      } else if (updatedGameState.phase === PHASES.NIGHT_1) {
        audioService.playSfx(SFX_TYPES.WOLF_HOWL);
      } else if (updatedGameState.phase === PHASES.DAY_DISCUSSION) {
        setLatestVotingResult(null);
        audioService.playSfx(SFX_TYPES.MORNING_DAWN);
      } else if (updatedGameState.phase === PHASES.DAY_VOTING) {
        audioService.playSfx(SFX_TYPES.GAVEL_STRIKE);
      }
      audioService.playBgmForPhase(updatedGameState.phase);
    };

    const handleDiscussionMessage = (message) => {
      setChatMessages((prev) => [...prev, message]);
    };

    const handleVotingState = (voteProgress) => {
      setVotingState(voteProgress);
    };

    const handleVotingResult = (result) => {
      setLatestVotingResult(result);
      audioService.playSfx(SFX_TYPES.GAVEL_STRIKE);
    };

    const handleNightSeerResult = (result) => {
      setSeerInvestigationResult(result);
      audioService.playSfx(SFX_TYPES.ROLE_REVEAL);
    };

    const handleGameElimination = (elimination) => {
      setLatestElimination(elimination);
      audioService.playSfx(SFX_TYPES.DEATH_BELL);
    };

    const handleGameOver = (finalState) => {
      setGameState(finalState);
      audioService.playSfx(SFX_TYPES.DEATH_BELL);
      audioService.playBgm(BGM_TRACKS.GAME_OVER);
    };

    const handleGameRematch = ({ room }) => {
      setGameState(null);
      setPrivateRole(null);
      setIsRoleAcknowledged(false);
      setChatMessages([]);
      setVotingState(null);
      setLatestVotingResult(null);
      setSubmittedNightTargetId(null);
      setSeerInvestigationResult(null);
      setLatestElimination(null);
      setWitchPotions({ healUsed: false, poisonUsed: false });
      audioService.playBgm(BGM_TRACKS.LOBBY);
      if (room) {
        setCurrentRoom(room);
      }
    };

    const handlePlayerKicked = ({ reason }) => {
      // Clear all state and return to landing screen
      setCurrentRoom(null);
      setCurrentPlayer(null);
      setSessionToken(null);
      setGameState(null);
      setPrivateRole(null);
      setIsRoleAcknowledged(false);
      setChatMessages([]);
      setVotingState(null);
      setLatestVotingResult(null);
      setSubmittedNightTargetId(null);
      setSeerInvestigationResult(null);
      setLatestElimination(null);
      setWitchPotions({ healUsed: false, poisonUsed: false });
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setErrorMessage(reason || "You have been removed from the chamber.");
      audioService.playSfx(SFX_TYPES.DEATH_BELL);
      audioService.playBgm(BGM_TRACKS.LOBBY);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
    socket.on(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
    socket.on(SOCKET_EVENTS.GAME_STARTED, handleGameStarted);
    socket.on(SOCKET_EVENTS.GAME_YOUR_ROLE, handleGameYourRole);
    socket.on(SOCKET_EVENTS.GAME_PHASE, handleGamePhase);
    socket.on(SOCKET_EVENTS.DISCUSSION_MESSAGE, handleDiscussionMessage);
    socket.on(SOCKET_EVENTS.VOTING_STATE, handleVotingState);
    socket.on(SOCKET_EVENTS.VOTING_RESULT, handleVotingResult);
    socket.on(SOCKET_EVENTS.NIGHT_SEER_RESULT, handleNightSeerResult);
    socket.on(SOCKET_EVENTS.GAME_ELIMINATION, handleGameElimination);
    socket.on(SOCKET_EVENTS.GAME_OVER, handleGameOver);
    socket.on(SOCKET_EVENTS.GAME_REMATCH, handleGameRematch);
    socket.on(SOCKET_EVENTS.PLAYER_KICKED, handlePlayerKicked);

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
      socket.off(SOCKET_EVENTS.DISCUSSION_MESSAGE, handleDiscussionMessage);
      socket.off(SOCKET_EVENTS.VOTING_STATE, handleVotingState);
      socket.off(SOCKET_EVENTS.VOTING_RESULT, handleVotingResult);
      socket.off(SOCKET_EVENTS.NIGHT_SEER_RESULT, handleNightSeerResult);
      socket.off(SOCKET_EVENTS.GAME_ELIMINATION, handleGameElimination);
      socket.off(SOCKET_EVENTS.GAME_OVER, handleGameOver);
      socket.off(SOCKET_EVENTS.GAME_REMATCH, handleGameRematch);
      socket.off(SOCKET_EVENTS.PLAYER_KICKED, handlePlayerKicked);
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
        setChatMessages([]);
        audioService.playSfx(SFX_TYPES.BUTTON_CLICK);
        audioService.playBgm(BGM_TRACKS.LOBBY);
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
        setChatMessages([]);
        audioService.playSfx(SFX_TYPES.BUTTON_CLICK);
        audioService.playBgm(BGM_TRACKS.LOBBY);
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
    setChatMessages([]);
    setErrorMessage("");
  }, []);

  // Kick Player Action (Host only)
  const handleKickPlayer = useCallback((targetPlayerId) => {
    const socket = getSocket();
    if (!socket.connected) return;
    socket.emit(SOCKET_EVENTS.ROOM_KICK, { targetPlayerId }, (response) => {
      if (!response?.success) {
        setErrorMessage(response?.error || "Failed to kick player");
      }
    });
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

    audioService.playSfx(SFX_TYPES.BUTTON_CLICK);
    socket.emit("reveal:ready", {}, (response) => {
      if (response?.success) {
        setIsRoleAcknowledged(true);
        if (response.game) {
          setGameState(response.game);
        }
      }
    });
  }, []);

  // Send Discussion Chat Message Action
  const handleSendMessage = useCallback((text) => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit(SOCKET_EVENTS.DISCUSSION_CHAT, { text }, (response) => {
      if (!response?.success) {
        setErrorMessage(response?.error || "Failed to post message");
      }
    });
  }, []);

  // Proceed from discussion straight to voting (Host)
  const handleProceedToVote = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit("discussion:proceed-to-vote", {}, (response) => {
      if (!response?.success) {
        setErrorMessage(response?.error || "Could not begin voting");
      }
    });
  }, []);

  // Proceed from voting straight to resolution (Host)
  const handleProceedToResolution = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit("vote:proceed-to-resolution", {}, (response) => {
      if (!response?.success) {
        setErrorMessage(response?.error || "Could not conclude voting");
      }
    });
  }, []);

  // Submit Vote Action
  const handleSubmitVote = useCallback((targetId) => {
    const socket = getSocket();
    if (!socket.connected) return;

    audioService.playSfx(SFX_TYPES.VOTE);
    socket.emit(SOCKET_EVENTS.VOTE_SUBMIT, { targetId }, (response) => {
      if (!response?.success) {
        setErrorMessage(response?.error || "Vote rejected by server");
      }
    });
  }, []);

  const handleDismissVotingResult = useCallback(() => {
    setLatestVotingResult(null);
  }, []);

  // Submit Night Action
  const handleSubmitNightAction = useCallback((actionType, targetId) => {
    const socket = getSocket();
    if (!socket.connected) return;

    if (actionType === ACTION_TYPES.WITCH_HEAL || actionType === ACTION_TYPES.WITCH_POISON) {
      audioService.playSfx(SFX_TYPES.POTION);
    } else {
      audioService.playSfx(SFX_TYPES.ACTION_SUBMIT);
    }

    socket.emit(SOCKET_EVENTS.NIGHT_ACTION, { actionType, targetId }, (response) => {
      if (response?.success) {
        setSubmittedNightTargetId(targetId || actionType);
        if (actionType === ACTION_TYPES.WITCH_HEAL) {
          setWitchPotions((prev) => ({ ...prev, healUsed: true }));
        } else if (actionType === ACTION_TYPES.WITCH_POISON) {
          setWitchPotions((prev) => ({ ...prev, poisonUsed: true }));
        }
      } else {
        setErrorMessage(response?.error || "Night action rejected by server");
      }
    });
  }, []);

  // Host hastens dawn
  const handleProceedToDawn = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    socket.emit("night:proceed-to-dawn", {}, (response) => {
      if (!response?.success) {
        setErrorMessage(response?.error || "Could not hasten the dawn");
      }
    });
  }, []);

  const handleDismissSeerResult = useCallback(() => {
    setSeerInvestigationResult(null);
  }, []);

  const handleDismissElimination = useCallback(() => {
    setLatestElimination(null);
  }, []);

  // Rematch Action (Host)
  const handleRematch = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;

    setIsRematching(true);
    socket.emit(SOCKET_EVENTS.GAME_REMATCH, {}, (response) => {
      setIsRematching(false);
      if (response?.success) {
        setGameState(null);
        setPrivateRole(null);
        setIsRoleAcknowledged(false);
        setChatMessages([]);
        setVotingState(null);
        setLatestVotingResult(null);
        setSubmittedNightTargetId(null);
        setSeerInvestigationResult(null);
        setLatestElimination(null);
        if (response.room) {
          setCurrentRoom(response.room);
        }
      } else {
        setErrorMessage(response?.error || "Could not commence rematch");
      }
    });
  }, []);

  // Determine current active view
  const isLobbyView = currentRoom && currentRoom.status === PHASES.LOBBY && !gameState;
  const isRoleRevealPhase = gameState?.phase === PHASES.ROLE_REVEAL;
  const isGameOverPhase = gameState?.phase === PHASES.GAME_OVER;
  const isActiveGamePhase =
    gameState &&
    gameState.phase !== PHASES.LOBBY &&
    gameState.phase !== PHASES.ROLE_REVEAL &&
    gameState.phase !== PHASES.GAME_OVER;

  return (
    <div className="app-shell">
      {/* Atmosphere & Volume Control Widget */}
      <AudioControlsWidget />

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

        {isLobbyView && (
          <LobbyScreen
            room={currentRoom}
            currentPlayer={currentPlayer}
            onConfigureRoom={handleConfigureRoom}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveRoom}
            onAddTestPlayers={handleAddTestPlayers}
            onKickPlayer={handleKickPlayer}
            isStarting={isLoading}
          />
        )}

        {isRoleRevealPhase && (
          <RoleRevealScreen
            roleInfo={privateRole}
            playerName={currentPlayer?.displayName || "Villager"}
            gameState={gameState}
            isReady={isRoleAcknowledged}
            onAcknowledge={handleAcknowledgeRole}
          />
        )}

        {isActiveGamePhase && (
          <ActiveGameView
            gameState={gameState}
            currentPlayer={currentPlayer}
            privateRole={privateRole}
            isHost={currentPlayer?.isHost}
            chatMessages={chatMessages}
            onSendMessage={handleSendMessage}
            onProceedToVote={handleProceedToVote}
            onProceedToResolution={handleProceedToResolution}
            onSubmitVote={handleSubmitVote}
            votingState={votingState}
            latestVotingResult={latestVotingResult}
            onDismissVotingResult={handleDismissVotingResult}
            onSubmitNightAction={handleSubmitNightAction}
            submittedNightTargetId={submittedNightTargetId}
            onProceedToDawn={handleProceedToDawn}
            seerInvestigationResult={seerInvestigationResult}
            onDismissSeerResult={handleDismissSeerResult}
            latestElimination={latestElimination}
            onDismissElimination={handleDismissElimination}
            witchPotions={witchPotions}
          />
        )}

        {isGameOverPhase && (
          <GameOverScreen
            gameState={gameState}
            currentPlayer={currentPlayer}
            isHost={currentPlayer?.isHost}
            onRematch={handleRematch}
            onLeaveRoom={handleLeaveRoom}
            isRematching={isRematching}
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
