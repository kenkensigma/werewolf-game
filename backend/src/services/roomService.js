const crypto = require("crypto");
const { PHASES } = require("../constants/index.js");
const { generateRoomCode, generateSessionToken } = require("../utils/codeGenerator.js");
const { roomConfigSchema } = require("../validation/roomSchemas.js");

class RoomService {
  constructor() {
    this.roomsByCode = new Map();
    this.sessions = new Map(); // sessionToken -> { roomCode, playerId }
    this.socketToSession = new Map(); // socketId -> sessionToken
  }

  createRoom(displayName, socketId) {
    let roomCode = generateRoomCode();
    while (this.roomsByCode.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const roomId = crypto.randomUUID();
    const playerId = crypto.randomUUID();
    const sessionToken = generateSessionToken();

    const hostPlayer = {
      id: playerId,
      displayName: displayName.trim(),
      socketId,
      sessionToken,
      isHost: true,
      isConnected: true,
      joinedAt: Date.now(),
    };

    const room = {
      id: roomId,
      code: roomCode,
      status: PHASES.LOBBY,
      hostId: playerId,
      players: [hostPlayer],
      config: {
        werewolfCount: 2,
        seerCount: 1,
        guardCount: 2,
        hunterCount: 2,
        witchCount: 0,
        troublemakerEnabled: false,
        discussionTimer: 240, // 4 minutes per system.md
      },
      createdAt: Date.now(),
    };

    this.roomsByCode.set(roomCode, room);
    this.sessions.set(sessionToken, { roomCode, playerId });
    if (socketId) {
      this.socketToSession.set(socketId, sessionToken);
    }

    return {
      room: this.getPublicRoomState(roomCode),
      player: this.sanitizePlayer(hostPlayer),
      sessionToken,
    };
  }

  joinRoom(roomCode, displayName, socketId, existingSessionToken = null) {
    const cleanCode = roomCode.toUpperCase().trim();
    const room = this.roomsByCode.get(cleanCode);

    if (!room) {
      throw new Error(`Room with code "${cleanCode}" was not found`);
    }

    if (room.status !== PHASES.LOBBY) {
      throw new Error("This room is already in progress and cannot be joined");
    }

    // Check for reconnection using session token
    if (existingSessionToken && this.sessions.has(existingSessionToken)) {
      const session = this.sessions.get(existingSessionToken);
      if (session.roomCode === cleanCode) {
        const player = room.players.find((p) => p.id === session.playerId);
        if (player) {
          player.socketId = socketId;
          player.isConnected = true;
          if (displayName && displayName.trim()) {
            player.displayName = displayName.trim();
          }
          if (socketId) {
            this.socketToSession.set(socketId, existingSessionToken);
          }
          return {
            room: this.getPublicRoomState(cleanCode),
            player: this.sanitizePlayer(player),
            sessionToken: existingSessionToken,
            reconnected: true,
          };
        }
      }
    }

    // New player joining lobby
    if (room.players.length >= 16) {
      throw new Error("Room has reached maximum capacity (16 players)");
    }

    // Prevent duplicate active display names
    const trimmedName = displayName.trim();
    const existingName = room.players.some(
      (p) => p.displayName.toLowerCase() === trimmedName.toLowerCase() && p.isConnected
    );
    if (existingName) {
      throw new Error(`A player named "${trimmedName}" is already in this room`);
    }

    const playerId = crypto.randomUUID();
    const sessionToken = generateSessionToken();

    const newPlayer = {
      id: playerId,
      displayName: trimmedName,
      socketId,
      sessionToken,
      isHost: room.players.length === 0,
      isConnected: true,
      joinedAt: Date.now(),
    };

    room.players.push(newPlayer);
    this.sessions.set(sessionToken, { roomCode: cleanCode, playerId });
    if (socketId) {
      this.socketToSession.set(socketId, sessionToken);
    }

    return {
      room: this.getPublicRoomState(cleanCode),
      player: this.sanitizePlayer(newPlayer),
      sessionToken,
      reconnected: false,
    };
  }

  configureRoom(roomCode, playerId, newConfig) {
    const cleanCode = roomCode.toUpperCase().trim();
    const room = this.roomsByCode.get(cleanCode);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== PHASES.LOBBY) {
      throw new Error("Game settings can only be altered in the lobby");
    }

    if (room.hostId !== playerId) {
      throw new Error("Only the room host may configure game settings");
    }

    const validatedConfig = roomConfigSchema.partial().parse(newConfig);
    room.config = { ...room.config, ...validatedConfig };

    return this.getPublicRoomState(cleanCode);
  }

  leaveRoom(socketId) {
    const sessionToken = this.socketToSession.get(socketId);
    if (!sessionToken) return null;

    const session = this.sessions.get(sessionToken);
    if (!session) {
      this.socketToSession.delete(socketId);
      return null;
    }

    const room = this.roomsByCode.get(session.roomCode);
    if (!room) {
      this.sessions.delete(sessionToken);
      this.socketToSession.delete(socketId);
      return null;
    }

    // In lobby, voluntarily leaving removes the player entirely
    const playerIndex = room.players.findIndex((p) => p.id === session.playerId);
    if (playerIndex !== -1) {
      const leavingPlayer = room.players[playerIndex];
      room.players.splice(playerIndex, 1);
      this.sessions.delete(sessionToken);
      this.socketToSession.delete(socketId);

      // If room is now empty, delete room
      if (room.players.length === 0) {
        this.roomsByCode.delete(session.roomCode);
        return { roomCode: session.roomCode, roomDeleted: true };
      }

      // If host left, transfer host to next connected player
      if (leavingPlayer.isHost) {
        const nextHost = room.players.find((p) => p.isConnected) || room.players[0];
        if (nextHost) {
          room.hostId = nextHost.id;
          nextHost.isHost = true;
        }
      }

      return {
        roomCode: session.roomCode,
        room: this.getPublicRoomState(session.roomCode),
        leftPlayerId: session.playerId,
        roomDeleted: false,
      };
    }

    return null;
  }

  handleDisconnect(socketId) {
    const sessionToken = this.socketToSession.get(socketId);
    if (!sessionToken) return null;

    const session = this.sessions.get(sessionToken);
    if (!session) {
      this.socketToSession.delete(socketId);
      return null;
    }

    const room = this.roomsByCode.get(session.roomCode);
    if (!room) return null;

    const player = room.players.find((p) => p.id === session.playerId);
    if (player) {
      player.isConnected = false;
      this.socketToSession.delete(socketId);

      // In lobby, if host disconnects, transfer host to an active connected player
      if (room.status === PHASES.LOBBY && player.isHost) {
        const nextActiveHost = room.players.find((p) => p.isConnected);
        if (nextActiveHost) {
          player.isHost = false;
          nextActiveHost.isHost = true;
          room.hostId = nextActiveHost.id;
        }
      }

      return {
        roomCode: session.roomCode,
        room: this.getPublicRoomState(session.roomCode),
        player,
      };
    }

    return null;
  }

  addTestPlayers(roomCode, targetCount = null) {
    const cleanCode = roomCode.toUpperCase().trim();
    const room = this.roomsByCode.get(cleanCode);
    if (!room) throw new Error("Room not found");
    if (room.status !== PHASES.LOBBY) throw new Error("Can only add test players in lobby");

    const validation = this.validateStartConditions(room);
    const needed = targetCount || validation.minPlayersRequired;
    const testNames = [
      "Lord Gabriel",
      "Brother Thomas",
      "Sister Agnes",
      "Miller John",
      "Blacksmith Karl",
      "Innkeeper Marta",
      "Alchemist Silas",
      "Baroness Elspeth",
      "Huntsman Viktor",
    ];

    while (room.players.length < needed) {
      const idx = room.players.length;
      const baseName = testNames[(idx - 1) % testNames.length] || `Villager ${idx + 1}`;
      const name = room.players.some((p) => p.displayName === baseName)
        ? `${baseName} ${idx + 1}`
        : baseName;

      const playerId = crypto.randomUUID();
      const sessionToken = generateSessionToken();

      const botPlayer = {
        id: playerId,
        displayName: name,
        socketId: null,
        sessionToken,
        isHost: false,
        isConnected: true,
        joinedAt: Date.now(),
      };

      room.players.push(botPlayer);
      this.sessions.set(sessionToken, { roomCode: cleanCode, playerId });
    }

    return this.getPublicRoomState(cleanCode);
  }

  validateStartConditions(room) {
    const errors = [];
    const totalPlayers = room.players.length;
    const connectedPlayers = room.players.filter((p) => p.isConnected).length;

    const werewolfCount = room.config.werewolfCount ?? 2;
    const seerCount = room.config.seerCount ?? 1;
    const guardCount = room.config.guardCount ?? 2;
    const hunterCount = room.config.hunterCount ?? 2;
    const witchCount = room.config.witchCount ?? 0;
    const troublemakerCount = room.config.troublemakerEnabled ? 1 : 0;

    const specialRolesTotal =
      werewolfCount + seerCount + guardCount + hunterCount + witchCount + troublemakerCount;
    
    // Minimum players required to fit all roles and preserve at least 1 Villager
    const minPlayersRequired = specialRolesTotal + 1;
    const effectiveMin = Math.max(4, minPlayersRequired);

    if (totalPlayers < effectiveMin) {
      errors.push(
        `Room requires at least ${effectiveMin} players (currently ${totalPlayers})`
      );
    }

    if (connectedPlayers < totalPlayers) {
      errors.push(
        `${totalPlayers - connectedPlayers} player(s) are currently disconnected`
      );
    }

    const villagerCount = totalPlayers - specialRolesTotal;
    if (villagerCount < 1) {
      errors.push(
        `Configuration leaves no slots for Villagers. Need at least 1 Villager.`
      );
    }

    return {
      valid: errors.length === 0,
      minPlayersRequired: effectiveMin,
      totalPlayers,
      connectedPlayers,
      villagerCount: Math.max(0, villagerCount),
      errors,
    };
  }

  getPublicRoomState(roomCode) {
    const room = this.roomsByCode.get(roomCode);
    if (!room) return null;

    const validation = this.validateStartConditions(room);

    return {
      roomId: room.id,
      roomCode: room.code,
      status: room.status,
      hostId: room.hostId,
      config: { ...room.config },
      players: room.players.map((p) => this.sanitizePlayer(p)),
      validation,
      canStart: validation.valid,
    };
  }

  sanitizePlayer(player) {
    return {
      id: player.id,
      displayName: player.displayName,
      isHost: player.isHost,
      isConnected: player.isConnected,
    };
  }

  getRoomByCode(roomCode) {
    return this.roomsByCode.get(roomCode.toUpperCase().trim());
  }

  getPlayerBySession(sessionToken) {
    const session = this.sessions.get(sessionToken);
    if (!session) return null;
    const room = this.roomsByCode.get(session.roomCode);
    if (!room) return null;
    const player = room.players.find((p) => p.id === session.playerId);
    return player ? { room, player } : null;
  }
}

// Export singleton instance
const roomService = new RoomService();
module.exports = {
  RoomService,
  roomService,
};
