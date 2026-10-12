const crypto = require("crypto");
const { PHASES, PLAYER_STATUS, ROLES, FACTIONS } = require("../constants/index.js");
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

  /**
   * Transitions the game to the next phase with an optional duration deadline.
   */
  transitionPhase(gameId, nextPhase, durationSeconds = null) {
    const game = this.gamesById.get(gameId);
    if (!game) {
      throw new Error("Active game not found");
    }

    game.phase = nextPhase;
    game.phaseStartedAt = Date.now();
    game.phaseDeadline = durationSeconds ? Date.now() + durationSeconds * 1000 : null;

    if (nextPhase === PHASES.DAY_DISCUSSION) {
      game.dayNumber += 1;
    } else if (nextPhase === PHASES.NIGHT) {
      game.nightNumber += 1;
    }

    return this.getPublicGameState(gameId);
  }

  /**
   * Evaluates victory conditions per system.md Section 5.
   */
  checkVictoryConditions(game) {
    const livingPlayers = game.players.filter((p) => p.status === PLAYER_STATUS.ALIVE);

    let livingWerewolves = 0;
    let livingNonWerewolves = 0;

    for (const player of livingPlayers) {
      const roleAssignment = game.roleAssignments.get(player.id);
      if (roleAssignment?.role === ROLES.WEREWOLF) {
        livingWerewolves += 1;
      } else {
        livingNonWerewolves += 1;
      }
    }

    // 1. Village Victory: No living Werewolves
    if (livingWerewolves === 0) {
      return {
        gameOver: true,
        winner: FACTIONS.VILLAGE,
        reason: "All Werewolves have been eliminated. The Village is safe once more!",
      };
    }

    // 2. Werewolf Parity Victory: livingWerewolves >= livingNonWerewolves
    if (livingWerewolves >= livingNonWerewolves) {
      return {
        gameOver: true,
        winner: FACTIONS.WEREWOLF,
        reason: `The Werewolves have reached parity (${livingWerewolves} beasts vs ${livingNonWerewolves} villagers) and overpowered the town!`,
      };
    }

    return {
      gameOver: false,
      winner: null,
      reason: "The conflict continues.",
    };
  }

  /**
   * Appends a validated in-game chat message.
   */
  addChatMessage(gameId, senderId, text) {
    const game = this.gamesById.get(gameId);
    if (!game) throw new Error("Game not found");

    if (game.phase !== PHASES.DAY_DISCUSSION) {
      throw new Error("Discussion chat is only open during the day discussion phase");
    }

    const sender = game.players.find((p) => p.id === senderId);
    if (!sender) throw new Error("Sender not found");

    if (sender.status !== PLAYER_STATUS.ALIVE) {
      throw new Error("Eliminated players cannot speak in discussion chat");
    }

    const message = {
      id: crypto.randomUUID(),
      senderId: sender.id,
      senderName: sender.displayName,
      text: text.trim().slice(0, 300),
      timestamp: Date.now(),
    };

    if (!game.chatMessages) {
      game.chatMessages = [];
    }
    game.chatMessages.push(message);

    return message;
  }

  getChatMessages(gameId) {
    const game = this.gamesById.get(gameId);
    return game?.chatMessages || [];
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
