const { roomService } = require("../services/roomService.js");
const { gameStateService } = require("../services/gameStateService.js");
const { SOCKET_EVENTS, PHASES } = require("../constants/index.js");
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
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 8. Add Test Villagers (Dev tool for testing)
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

  // 9. Socket Disconnect
  socket.on("disconnect", () => {
    const result = roomService.handleDisconnect(socket.id);
    if (result && result.room) {
      io.to(result.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    }
  });
}

module.exports = {
  registerRoomHandlers,
};
