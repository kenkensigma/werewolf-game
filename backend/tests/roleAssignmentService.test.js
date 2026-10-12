import { describe, it, expect } from "vitest";
const {
  RoleAssignmentService,
} = require("../src/services/roleAssignmentService.js");
const {
  GameStateService,
} = require("../src/services/gameStateService.js");
const { ROLES, FACTIONS, PHASES, PLAYER_STATUS } = require("../src/constants/index.js");

describe("RoleAssignmentService & GameStateService Tests", () => {
  const roleService = new RoleAssignmentService();

  it("should generate exact role distribution for standard 8-player game", () => {
    const config = {
      werewolfCount: 2,
      troublemakerEnabled: false,
      discussionTimer: 240,
    };

    const pool = roleService.generateRolePool(8, config);
    expect(pool).toHaveLength(8);

    const counts = pool.reduce((acc, r) => {
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});

    expect(counts[ROLES.WEREWOLF]).toBe(2);
    expect(counts[ROLES.SEER]).toBe(1);
    expect(counts[ROLES.GUARD]).toBe(2);
    expect(counts[ROLES.HUNTER]).toBe(2);
    expect(counts[ROLES.VILLAGER]).toBe(1);
    expect(counts[ROLES.TROUBLEMAKER]).toBeUndefined();
  });

  it("should generate exact role distribution for 9-player game with Troublemaker", () => {
    const config = {
      werewolfCount: 2,
      troublemakerEnabled: true,
      discussionTimer: 240,
    };

    const pool = roleService.generateRolePool(9, config);
    expect(pool).toHaveLength(9);

    const counts = pool.reduce((acc, r) => {
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});

    expect(counts[ROLES.WEREWOLF]).toBe(2);
    expect(counts[ROLES.SEER]).toBe(1);
    expect(counts[ROLES.GUARD]).toBe(2);
    expect(counts[ROLES.HUNTER]).toBe(2);
    expect(counts[ROLES.TROUBLEMAKER]).toBe(1);
    expect(counts[ROLES.VILLAGER]).toBe(1);
  });

  it("should securely assign unique valid roles to every player", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({
      id: `player-${i + 1}`,
      displayName: `Player ${i + 1}`,
    }));

    const config = { werewolfCount: 2, troublemakerEnabled: false };
    const assignments = roleService.assignRoles(players, config);

    expect(assignments.size).toBe(8);

    for (const player of players) {
      const assigned = assignments.get(player.id);
      expect(assigned).toBeDefined();
      expect(assigned.role).toBeDefined();
      expect(assigned.faction).toBeDefined();
      expect(assigned.abilityDescription).toBeDefined();
      expect(assigned.abilityDescription).not.toContain("—");
    }
  });

  it("GameStateService: creates game without leaking secret roles in public state", () => {
    const gameStateService = new GameStateService();
    const fakeRoom = {
      id: "room-uuid",
      code: "ABC123",
      status: PHASES.LOBBY,
      hostId: "player-1",
      players: Array.from({ length: 8 }, (_, i) => ({
        id: `player-${i + 1}`,
        displayName: `Villager ${i + 1}`,
        socketId: `socket-${i + 1}`,
        isConnected: true,
      })),
      config: { werewolfCount: 2, troublemakerEnabled: false, discussionTimer: 240 },
    };

    const { game, publicState } = gameStateService.createGame(fakeRoom);

    expect(game.phase).toBe(PHASES.ROLE_REVEAL);
    expect(publicState.phase).toBe(PHASES.ROLE_REVEAL);
    expect(publicState.players).toHaveLength(8);

    // CRITICAL SECURITY CHECK: Public state players MUST NOT contain role properties
    for (const p of publicState.players) {
      expect(p.role).toBeUndefined();
      expect(p.faction).toBeUndefined();
      expect(p.status).toBe(PLAYER_STATUS.ALIVE);
      expect(p.isReady).toBe(false);
    }

    // Authorized private role retrieval
    const privateRole = gameStateService.getPlayerPrivateRole(game.id, "player-1");
    expect(privateRole).toBeDefined();
    expect(privateRole.role).toBeDefined();
    expect(privateRole.faction).toBeDefined();

    // Acknowledge role
    const updatedState = gameStateService.acknowledgeRole(game.id, "player-1");
    const playerOnePublic = updatedState.players.find((p) => p.id === "player-1");
    expect(playerOnePublic.isReady).toBe(true);

    // Test rematch reset
    gameStateService.resetGameForRematch("ROOM88");
    expect(gameStateService.getGameByRoomCode("ROOM88")).toBeNull();
  });
});
