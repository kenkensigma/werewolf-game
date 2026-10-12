const { roomService } = require("../services/roomService.js");
const { gameStateService } = require("../services/gameStateService.js");
const { votingService, SKIP_TARGET } = require("../services/votingService.js");
const { gameTimerService } = require("../services/gameTimerService.js");
const {
  SOCKET_EVENTS,
  PHASES,
  PLAYER_STATUS,
  ACTION_TYPES,
  ROLES,
} = require("../constants/index.js");
const { nightActionService, SKIP_TARGET: NIGHT_SKIP_TARGET } = require("../services/nightActionService.js");
const { nightResolutionService } = require("../services/nightResolutionService.js");
const {
  createRoomSchema,
  joinRoomSchema,
  roomConfigSchema,
} = require("../validation/roomSchemas.js");

function registerRoomHandlers(io, socket) {
  // 1. Create Room
  socket.on(SOCKET_EVENTS.ROOM_CREATE, (payload, callback) => {
    try {
      const validated = createRoomSchema.parse(payload);
      const result = roomService.createRoom(validated.displayName, socket.id);

      socket.join(result.room.roomCode);

      if (typeof callback === "function") {
        callback({
          success: true,
          room: result.room,
          player: result.player,
          sessionToken: result.sessionToken,
        });
      }

      // Broadcast room state to room channel
      io.to(result.room.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    } catch (err) {
      const message = err.errors ? err.errors[0]?.message : err.message;
      if (typeof callback === "function") {
        callback({ success: false, error: message || "Failed to create room" });
      } else {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message });
      }
    }
  });

  // 2. Join Room
  socket.on(SOCKET_EVENTS.ROOM_JOIN, (payload, callback) => {
    try {
      const validated = joinRoomSchema.parse(payload);
      const result = roomService.joinRoom(
        validated.roomCode,
        validated.displayName,
        socket.id,
        validated.sessionToken
      );

      socket.join(result.room.roomCode);

      if (typeof callback === "function") {
        callback({
          success: true,
          room: result.room,
          player: result.player,
          sessionToken: result.sessionToken,
          reconnected: result.reconnected,
        });
      }

      // Broadcast updated room state to all players in the room
      io.to(result.room.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    } catch (err) {
      const message = err.errors ? err.errors[0]?.message : err.message;
      if (typeof callback === "function") {
        callback({ success: false, error: message || "Failed to join room" });
      } else {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message });
      }
    }
  });

  // 3. Configure Room (Host only)
  socket.on(SOCKET_EVENTS.ROOM_CONFIGURE, (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) {
        throw new Error("You are not part of an active room session");
      }

      const session = roomService.sessions.get(sessionToken);
      if (!session) {
        throw new Error("Session expired or invalid");
      }

      const validatedConfig = roomConfigSchema.parse(payload);
      const updatedRoom = roomService.configureRoom(
        session.roomCode,
        session.playerId,
        validatedConfig
      );

      if (typeof callback === "function") {
        callback({ success: true, room: updatedRoom });
      }

      io.to(session.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);
    } catch (err) {
      const message = err.errors ? err.errors[0]?.message : err.message;
      if (typeof callback === "function") {
        callback({ success: false, error: message || "Configuration failed" });
      } else {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message });
      }
    }
  });

  // 4. Leave Room
  socket.on(SOCKET_EVENTS.ROOM_LEAVE, (callback) => {
    try {
      const result = roomService.leaveRoom(socket.id);
      if (result) {
        socket.leave(result.roomCode);
        if (!result.roomDeleted) {
          io.to(result.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
        }
      }

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 5. Resume Session
  socket.on(SOCKET_EVENTS.SESSION_RESUME, ({ sessionToken, roomCode }, callback) => {
    try {
      const result = roomService.joinRoom(roomCode, "", socket.id, sessionToken);
      socket.join(result.room.roomCode);

      // Check if an active game exists for this room
      const activeGame = gameStateService.getGameByRoomCode(result.room.roomCode);
      let privateRole = null;
      let publicGame = null;

      if (activeGame) {
        publicGame = gameStateService.getPublicGameState(activeGame.id);
        privateRole = gameStateService.getPlayerPrivateRole(activeGame.id, result.player.id);
      }

      if (typeof callback === "function") {
        callback({
          success: true,
          room: result.room,
          player: result.player,
          game: publicGame,
          privateRole,
        });
      }

      if (privateRole) {
        socket.emit(SOCKET_EVENTS.GAME_YOUR_ROLE, privateRole);
      }

      io.to(result.room.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 6. Game Start (Host only)
  socket.on(SOCKET_EVENTS.GAME_START, (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) throw new Error("No active session found");

      const session = roomService.sessions.get(sessionToken);
      if (!session) throw new Error("Session expired");

      const room = roomService.getRoomByCode(session.roomCode);
      if (!room) throw new Error("Room not found");

      if (room.hostId !== session.playerId) {
        throw new Error("Only the chamber host may initiate the hunt");
      }

      const validation = roomService.validateStartConditions(room);
      if (!validation.valid) {
        throw new Error(validation.errors[0] || "Chamber start conditions are not met");
      }

      // Initialize game and assign roles
      const { game, publicState, privateRoles } = gameStateService.createGame(room);

      // 1. Dispatch secret roles individually and privately to each connected player's socket
      room.players.forEach((player) => {
        const roleInfo = privateRoles.get(player.id);
        if (player.socketId && roleInfo) {
          io.to(player.socketId).emit(SOCKET_EVENTS.GAME_YOUR_ROLE, {
            gameId: game.id,
            role: roleInfo.role,
            faction: roleInfo.faction,
            abilityDescription: roleInfo.abilityDescription,
            colorAccent: roleInfo.colorAccent,
          });
        }
      });

      // 2. Broadcast public game-started event and updated room state
      io.to(room.code).emit(SOCKET_EVENTS.GAME_STARTED, publicState);
      io.to(room.code).emit(SOCKET_EVENTS.ROOM_STATE, roomService.getPublicRoomState(room.code));

      // Schedule role reveal auto-transition after 12 seconds in case players linger
      gameTimerService.startTimer(game.id, PHASES.ROLE_REVEAL, 12, () => {
        advanceToNight1(io, game);
      });

      if (typeof callback === "function") {
        callback({ success: true, game: publicState });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      } else {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: err.message });
      }
    }
  });

  // 7. Reveal Role Acknowledged
  socket.on("reveal:ready", (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) return;

      const session = roomService.sessions.get(sessionToken);
      if (!session) return;

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game) return;

      const updatedGameState = gameStateService.acknowledgeRole(game.id, session.playerId);

      io.to(session.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, updatedGameState);

      if (typeof callback === "function") {
        callback({ success: true, game: updatedGameState });
      }

      // If all human/connected players have acknowledged, proceed to Night 1 immediately
      const connectedPlayers = game.players.filter((p) => p.isConnected && p.socketId);
      const allConnectedReady = connectedPlayers.every((p) => game.readyPlayerIds.has(p.id));

      if (allConnectedReady && game.phase === PHASES.ROLE_REVEAL) {
        advanceToNight1(io, game);
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 8. In-game Discussion Chat
  socket.on(SOCKET_EVENTS.DISCUSSION_CHAT, ({ text }, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) throw new Error("No active session");

      const session = roomService.sessions.get(sessionToken);
      if (!session) throw new Error("Session expired");

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game) throw new Error("Game not active");

      const message = gameStateService.addChatMessage(game.id, session.playerId, text);

      io.to(session.roomCode).emit(SOCKET_EVENTS.DISCUSSION_MESSAGE, message);

      if (typeof callback === "function") {
        callback({ success: true, message });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 9. Host skips discussion straight to voting
  socket.on("discussion:proceed-to-vote", (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) return;

      const session = roomService.sessions.get(sessionToken);
      if (!session) return;

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game || game.phase !== PHASES.DAY_DISCUSSION) return;

      advanceToDayVoting(io, game);

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 10. Vote Submission
  socket.on(SOCKET_EVENTS.VOTE_SUBMIT, ({ targetId }, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) throw new Error("No active session");

      const session = roomService.sessions.get(sessionToken);
      if (!session) throw new Error("Session expired");

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game) throw new Error("Game not active");

      const voteResult = votingService.submitVote(game, session.playerId, targetId);

      // Broadcast public vote progress (without revealing targets prematurely)
      io.to(session.roomCode).emit(SOCKET_EVENTS.VOTING_STATE, {
        votesCastCount: voteResult.votesSubmittedCount,
        totalVoters: voteResult.totalLivingPlayers,
      });

      if (typeof callback === "function") {
        callback({ success: true, voteResult });
      }

      // If all living players have cast their votes, resolve immediately!
      if (voteResult.allVotesIn) {
        resolveVotingAndAdvance(io, game);
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      } else {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: err.message });
      }
    }
  });

  // 11. Host concludes voting early
  socket.on("vote:proceed-to-resolution", (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) return;

      const session = roomService.sessions.get(sessionToken);
      if (!session) return;

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game || game.phase !== PHASES.DAY_VOTING) return;

      const room = roomService.getRoomByCode(session.roomCode);
      if (!room || room.hostId !== session.playerId) {
        throw new Error("Only the chamber host may conclude tribunal voting early");
      }

      resolveVotingAndAdvance(io, game);

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 12. Night Action Submission
  socket.on(SOCKET_EVENTS.NIGHT_ACTION, ({ actionType, targetId }, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) throw new Error("No active session");

      const session = roomService.sessions.get(sessionToken);
      if (!session) throw new Error("Session expired");

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game) throw new Error("Game not active");

      if (game.phase !== PHASES.NIGHT) {
        throw new Error("Night actions may only be performed during the Night phase");
      }

      const result = nightActionService.submitAction(game, session.playerId, actionType, targetId);

      // If actor is Seer, compute investigation immediately and deliver privately
      if (actionType === ACTION_TYPES.SEER_INVESTIGATE) {
        const seerResult = nightActionService.investigateTarget(game, targetId);
        const targetPlayer = game.players.find((p) => p.id === targetId);

        socket.emit(SOCKET_EVENTS.NIGHT_SEER_RESULT, {
          targetId,
          targetName: targetPlayer ? targetPlayer.displayName : "Unknown",
          result: seerResult,
        });
      }

      if (typeof callback === "function") {
        callback({ success: true, result });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      } else {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: err.message });
      }
    }
  });

  // 12. Host hastens the dawn (proceed from Night to Day)
  socket.on("night:proceed-to-dawn", (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) return;

      const session = roomService.sessions.get(sessionToken);
      if (!session) return;

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game || game.phase !== PHASES.NIGHT) return;

      const room = roomService.getRoomByCode(session.roomCode);
      if (!room || room.hostId !== session.playerId) {
        throw new Error("Only the chamber host may hasten the dawn");
      }

      resolveNightAndAdvance(io, game);

      if (typeof callback === "function") {
        callback({ success: true });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 13. Add Test Villagers (Dev tool for testing)
  socket.on("room:add-test-players", (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) throw new Error("No active session");

      const session = roomService.sessions.get(sessionToken);
      if (!session) throw new Error("Session expired");

      const room = roomService.getRoomByCode(session.roomCode);
      if (!room) throw new Error("Room not found");

      if (room.hostId !== session.playerId) {
        throw new Error("Only the host can summon test villagers");
      }

      const updatedRoom = roomService.addTestPlayers(session.roomCode);

      io.to(session.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, updatedRoom);

      if (typeof callback === "function") {
        callback({ success: true, room: updatedRoom });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 14. Dev Helper: Trigger match conclusion for testing
  socket.on("game:dev-trigger-victory", ({ winnerFaction }, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) return;

      const session = roomService.sessions.get(sessionToken);
      if (!session) return;

      const game = gameStateService.getGameByRoomCode(session.roomCode);
      if (!game) return;

      const room = roomService.getRoomByCode(session.roomCode);
      if (!room || room.hostId !== session.playerId) return;

      const targetWinner = winnerFaction || "VILLAGE";
      const winReason =
        targetWinner === "VILLAGE"
          ? "All Werewolves have been eliminated. The Village is safe once more!"
          : targetWinner === "WEREWOLF"
          ? "The Werewolves have reached parity and overpowered the town!"
          : "The Troublemaker was executed by tribunal decree and has achieved victory!";

      const publicState = gameStateService.transitionPhase(game.id, PHASES.GAME_OVER, null);
      publicState.winner = targetWinner;
      publicState.winReason = winReason;
      publicState.revealedRoles = Array.from(game.roleAssignments.entries()).map(([id, info]) => {
        const p = game.players.find((player) => player.id === id);
        return {
          playerId: id,
          displayName: p?.displayName || "Unknown",
          role: info.role,
          faction: info.faction,
          status: p?.status || PLAYER_STATUS.ALIVE,
          eliminatedAtPhase: p?.eliminatedAtPhase || null,
        };
      });

      io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_OVER, publicState);
      io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);

      if (typeof callback === "function") {
        callback({ success: true, game: publicState });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 15. Game Rematch (Host initiates return to lobby)
  socket.on(SOCKET_EVENTS.GAME_REMATCH, (payload, callback) => {
    try {
      const sessionToken = roomService.socketToSession.get(socket.id);
      if (!sessionToken) throw new Error("No active session found");

      const session = roomService.sessions.get(sessionToken);
      if (!session) throw new Error("Session expired");

      const room = roomService.getRoomByCode(session.roomCode);
      if (!room) throw new Error("Room not found");

      if (room.hostId !== session.playerId) {
        throw new Error("Only the chamber host may initiate a rematch");
      }

      gameStateService.resetGameForRematch(session.roomCode);
      room.status = PHASES.LOBBY;
      gameTimerService.cancelTimer(session.roomCode);

      const publicRoom = roomService.getPublicRoomState(session.roomCode);
      io.to(session.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, publicRoom);
      io.to(session.roomCode).emit(SOCKET_EVENTS.GAME_REMATCH, { room: publicRoom });

      if (typeof callback === "function") {
        callback({ success: true, room: publicRoom });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      } else {
        socket.emit(SOCKET_EVENTS.ROOM_ERROR, { message: err.message });
      }
    }
  });

  // 15. Socket Disconnect
  socket.on("disconnect", () => {
    const result = roomService.handleDisconnect(socket.id);
    if (result && result.room) {
      io.to(result.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    }
  });
}

/**
 * Phase Transition Helpers
 */
function advanceToNight1(io, game) {
  gameTimerService.cancelTimer(game.id);

  const publicState = gameStateService.transitionPhase(game.id, PHASES.NIGHT_1, 6);
  io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);

  // Night 1 is peaceful setup (6 seconds) then advances to Day Discussion
  gameTimerService.startTimer(game.id, PHASES.NIGHT_1, 6, () => {
    advanceToDayDiscussion(io, game);
  });
}

function advanceToDayDiscussion(io, game) {
  gameTimerService.cancelTimer(game.id);

  const duration = game.configSnapshot?.discussionTimer || 240;
  const publicState = gameStateService.transitionPhase(game.id, PHASES.DAY_DISCUSSION, duration);
  io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);

  gameTimerService.startTimer(game.id, PHASES.DAY_DISCUSSION, duration, () => {
    advanceToDayVoting(io, game);
  });
}

function advanceToDayVoting(io, game) {
  gameTimerService.cancelTimer(game.id);
  votingService.initVoting(game.id);

  const votingDuration = 45;
  const publicState = gameStateService.transitionPhase(game.id, PHASES.DAY_VOTING, votingDuration);
  io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);

  const livingPlayers = game.players.filter((p) => p.status === PLAYER_STATUS.ALIVE);
  io.to(game.roomCode).emit(SOCKET_EVENTS.VOTING_STATE, {
    votesCastCount: 0,
    totalVoters: livingPlayers.length,
  });

  gameTimerService.startTimer(game.id, PHASES.DAY_VOTING, votingDuration, () => {
    resolveVotingAndAdvance(io, game);
  });
}

function resolveVotingAndAdvance(io, game) {
  gameTimerService.cancelTimer(game.id);

  const resolution = votingService.resolveVotes(game);
  io.to(game.roomCode).emit(SOCKET_EVENTS.VOTING_RESULT, resolution);

  if (resolution.eliminatedPlayerId) {
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_ELIMINATION, {
      eliminatedId: resolution.eliminatedPlayerId,
      displayName: resolution.eliminatedPlayerName,
      phase: PHASES.DAY_VOTING,
      reason: resolution.reason,
    });
  }

  // 1. Troublemaker Daytime Victory Check
  if (resolution.isTroublemakerWin) {
    const publicState = gameStateService.transitionPhase(game.id, PHASES.GAME_OVER, null);
    publicState.winner = "TROUBLEMAKER";
    publicState.winReason = resolution.reason;
    publicState.revealedRoles = Array.from(game.roleAssignments.entries()).map(([id, info]) => {
      const p = game.players.find((player) => player.id === id);
      return {
        playerId: id,
        displayName: p?.displayName || "Unknown",
        role: info.role,
        faction: info.faction,
        status: p?.status || PLAYER_STATUS.ALIVE,
        eliminatedAtPhase: p?.eliminatedAtPhase || null,
      };
    });
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_OVER, publicState);
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);
    return;
  }

  // 2. Standard Victory Condition Check
  const victory = gameStateService.checkVictoryConditions(game);
  if (victory.gameOver) {
    const publicState = gameStateService.transitionPhase(game.id, PHASES.GAME_OVER, null);
    publicState.winner = victory.winner;
    publicState.winReason = victory.reason;
    publicState.revealedRoles = Array.from(game.roleAssignments.entries()).map(([id, info]) => {
      const p = game.players.find((player) => player.id === id);
      return {
        playerId: id,
        displayName: p?.displayName || "Unknown",
        role: info.role,
        faction: info.faction,
        status: p?.status || PLAYER_STATUS.ALIVE,
        eliminatedAtPhase: p?.eliminatedAtPhase || null,
      };
    });
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_OVER, publicState);
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);
    return;
  }

  // 3. Otherwise continue to Night phase
  advanceToNight(io, game);
}

function advanceToNight(io, game) {
  gameTimerService.cancelTimer(game.id);

  // Initialize fresh night action session
  nightActionService.initNight(game.id);

  const duration = 30; // 30 seconds for night actions
  const publicState = gameStateService.transitionPhase(game.id, PHASES.NIGHT, duration);
  io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);

  // Start authoritative night countdown timer
  gameTimerService.startTimer(game.id, PHASES.NIGHT, duration, () => {
    resolveNightAndAdvance(io, game);
  });
}

function resolveNightAndAdvance(io, game) {
  gameTimerService.cancelTimer(game.id);

  // 1. Resolve all simultaneous night actions authoritatively
  const resolution = nightResolutionService.resolveNight(game);

  // 2. Broadcast elimination notices for all players killed this night
  if (resolution.eliminatedPlayers && resolution.eliminatedPlayers.length > 0) {
    for (const eliminated of resolution.eliminatedPlayers) {
      io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_ELIMINATION, {
        eliminatedId: eliminated.id,
        displayName: eliminated.displayName,
        phase: PHASES.NIGHT,
        reason: "Fell in the shadows of the night",
      });
    }
  } else {
    // Peaceful night notification
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_ELIMINATION, {
      eliminatedId: null,
      displayName: null,
      phase: PHASES.NIGHT,
      reason: "The morning sun rises upon a peaceful night. No souls were claimed.",
    });
  }

  // 3. Check victory conditions after night eliminations
  if (resolution.victory && resolution.victory.gameOver) {
    const publicState = gameStateService.transitionPhase(game.id, PHASES.GAME_OVER, null);
    publicState.winner = resolution.victory.winner;
    publicState.winReason = resolution.victory.reason;
    publicState.revealedRoles = Array.from(game.roleAssignments.entries()).map(([id, info]) => {
      const p = game.players.find((player) => player.id === id);
      return {
        playerId: id,
        displayName: p?.displayName || "Unknown",
        role: info.role,
        faction: info.faction,
        status: p?.status || PLAYER_STATUS.ALIVE,
        eliminatedAtPhase: p?.eliminatedAtPhase || null,
      };
    });
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_OVER, publicState);
    io.to(game.roomCode).emit(SOCKET_EVENTS.GAME_PHASE, publicState);
    return;
  }

  // 4. If game continues, advance to Day Discussion
  advanceToDayDiscussion(io, game);
}

module.exports = {
  registerRoomHandlers,
};
