const crypto = require("crypto");
const { PHASES, PLAYER_STATUS } = require("../constants/index.js");
const { roleAssignmentService } = require("./roleAssignmentService.js");

class GameStateService {
  constructor() {
    this.gamesById = new Map(); // gameId -> game
    this.gameByRoomCode = new Map(); // roomCode -> gameId
  }

  /**
   * Initializes a new game session from an eligible lobby room.
   */
  createGame(room) {
    if (!room) {
      throw new Error("Cannot create game from non-existent room");
    }

    const gameId = crypto.randomUUID();
    const cleanRoomCode = room.code.toUpperCase().trim();

    // 1. Snapshot eligible players
    const playerSnapshots = room.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      socketId: p.socketId,
      status: PLAYER_STATUS.ALIVE,
      isConnected: p.isConnected,
      isReady: false,
    }));

    // 2. Perform authoritative role assignment
    const roleAssignments = roleAssignmentService.assignRoles(
      playerSnapshots,
      room.config
    );

    const game = {
      id: gameId,
      roomId: room.id,
      roomCode: cleanRoomCode,
      phase: PHASES.ROLE_REVEAL,
      dayNumber: 0,
      nightNumber: 1,
      phaseStartedAt: Date.now(),
      phaseDeadline: null,
      winner: null,
      players: playerSnapshots,
      roleAssignments, // Private server state: playerId -> { role, faction, ... }
      readyPlayerIds: new Set(),
      actions: [],
      configSnapshot: { ...room.config },
    };

    this.gamesById.set(gameId, game);
    this.gameByRoomCode.set(cleanRoomCode, gameId);

    // Update room status
    room.status = PHASES.ROLE_REVEAL;

    return {
      game,
      publicState: this.getPublicGameState(gameId),
      privateRoles: roleAssignments,
    };
  }

  /**
   * Public game state serializer: guaranteed 100% free of secret role data.
   */
  getPublicGameState(gameId) {
    const game = this.gamesById.get(gameId);
    if (!game) return null;

    return {
      gameId: game.id,
      roomCode: game.roomCode,
      phase: game.phase,
      dayNumber: game.dayNumber,
      nightNumber: game.nightNumber,
      phaseStartedAt: game.phaseStartedAt,
      phaseDeadline: game.phaseDeadline,
      winner: game.winner,
      players: game.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        status: p.status,
        isConnected: p.isConnected,
        isReady: game.readyPlayerIds.has(p.id),
      })),
      allPlayersReady: game.players.every((p) => game.readyPlayerIds.has(p.id)),
    };
  }

  /**
   * Retrieves private role information authorized only for the requesting player.
   */
  getPlayerPrivateRole(gameId, playerId) {
    const game = this.gamesById.get(gameId);
    if (!game) return null;

    const assignment = game.roleAssignments.get(playerId);
    if (!assignment) return null;

    return {
      gameId: game.id,
      role: assignment.role,
      faction: assignment.faction,
      abilityDescription: assignment.abilityDescription,
      colorAccent: assignment.colorAccent,
    };
  }

  /**
   * Records a player's acknowledgement that they have viewed their secret role.
   */
  acknowledgeRole(gameId, playerId) {
    const game = this.gamesById.get(gameId);
    if (!game) {
      throw new Error("Active game not found");
    }

    game.readyPlayerIds.add(playerId);
    const player = game.players.find((p) => p.id === playerId);
    if (player) {
      player.isReady = true;
    }

    return this.getPublicGameState(gameId);
  }

  getGameByRoomCode(roomCode) {
    const gameId = this.gameByRoomCode.get(roomCode.toUpperCase().trim());
    return gameId ? this.gamesById.get(gameId) : null;
  }

  getGameById(gameId) {
    return this.gamesById.get(gameId);
  }
}

const gameStateService = new GameStateService();

module.exports = {
  GameStateService,
  gameStateService,
};
