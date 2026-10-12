const { roomService } = require("../services/roomService.js");
const { SOCKET_EVENTS } = require("../constants/index.js");
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

      if (typeof callback === "function") {
        callback({
          success: true,
          room: result.room,
          player: result.player,
        });
      }

      io.to(result.room.roomCode).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 6. Socket Disconnect
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
