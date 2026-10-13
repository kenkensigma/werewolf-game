import { describe, it, expect, beforeEach } from "vitest";
const { ROLES, FACTIONS, PLAYER_STATUS, ACTION_TYPES, PHASES } = require("../src/constants/index.js");
const { RoleAssignmentService } = require("../src/services/roleAssignmentService.js");
const { NightActionService, SKIP_TARGET } = require("../src/services/nightActionService.js");
const { NightResolutionService } = require("../src/services/nightResolutionService.js");
const { RoomService } = require("../src/services/roomService.js");

describe("Configurable Roles & Witch Mechanics", () => {
  let roleService;
  let actionService;
  let resolutionService;

  beforeEach(() => {
    roleService = new RoleAssignmentService();
    actionService = new NightActionService();
    resolutionService = new NightResolutionService(actionService);
  });

  describe("Custom Role Counts & Distribution", () => {
    it("should allow custom role counts: 1 Wolf, 1 Seer, 1 Guard, 1 Hunter, 1 Witch for 6 players", () => {
      const config = {
        werewolfCount: 1,
        seerCount: 1,
        guardCount: 1,
        hunterCount: 1,
        witchCount: 1,
        troublemakerEnabled: false,
        discussionTimer: 120,
      };

      const pool = roleService.generateRolePool(6, config);
      expect(pool).toHaveLength(6);

      const counts = pool.reduce((acc, r) => {
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});

      expect(counts[ROLES.WEREWOLF]).toBe(1);
      expect(counts[ROLES.SEER]).toBe(1);
      expect(counts[ROLES.GUARD]).toBe(1);
      expect(counts[ROLES.HUNTER]).toBe(1);
      expect(counts[ROLES.WITCH]).toBe(1);
      expect(counts[ROLES.VILLAGER]).toBe(1);
    });

    it("should reject start if player count does not guarantee at least 1 Villager", () => {
      const config = {
        werewolfCount: 2,
        seerCount: 1,
        guardCount: 2,
        hunterCount: 2,
        witchCount: 1,
        troublemakerEnabled: false,
      };

      // 2 + 1 + 2 + 2 + 1 = 8 special roles, needs at least 9 players
      expect(() => {
        roleService.generateRolePool(8, config);
      }).toThrow(/Insufficient players/i);
    });
  });

  describe("Witch Mechanics", () => {
    function createMockGame(roleMap) {
      const players = Object.keys(roleMap).map((id, idx) => ({
        id,
        displayName: `Player ${idx + 1}`,
        status: PLAYER_STATUS.ALIVE,
        isConnected: true,
      }));

      const roleAssignments = new Map();
      for (const [id, role] of Object.entries(roleMap)) {
        roleAssignments.set(id, {
          role,
          faction: role === ROLES.WEREWOLF ? FACTIONS.WEREWOLF : FACTIONS.VILLAGE,
          abilityDescription: "Test description",
        });
      }

      return {
        id: "game-witch-test",
        phase: PHASES.NIGHT,
        players,
        roleAssignments,
      };
    }

    it("should allow Witch to heal the werewolf victim with Elixir of Life", () => {
      const game = createMockGame({
        "wolf-1": ROLES.WEREWOLF,
        "seer-1": ROLES.SEER,
        "guard-1": ROLES.GUARD,
        "hunter-1": ROLES.HUNTER,
        "witch-1": ROLES.WITCH,
        "villager-1": ROLES.VILLAGER,
      });

      actionService.initNight(game.id);

      // Werewolf attacks villager-1
      actionService.submitAction(game, "wolf-1", ACTION_TYPES.WEREWOLF_ATTACK, "villager-1");

      // Witch uses heal elixir
      actionService.submitAction(game, "witch-1", ACTION_TYPES.WITCH_HEAL, null);

      const result = resolutionService.resolveNight(game);

      // villager-1 should be saved by Witch's heal!
      expect(result.eliminatedPlayerIds).toHaveLength(0);
      expect(result.peacefulNight).toBe(false);
      expect(result.allAttacksBlocked).toBe(true);

      const villager = game.players.find((p) => p.id === "villager-1");
      expect(villager.status).toBe(PLAYER_STATUS.ALIVE);
    });

    it("should allow Witch to poison a suspect with Poison Brew", () => {
      const game = createMockGame({
        "wolf-1": ROLES.WEREWOLF,
        "seer-1": ROLES.SEER,
        "guard-1": ROLES.GUARD,
        "hunter-1": ROLES.HUNTER,
        "witch-1": ROLES.WITCH,
        "villager-1": ROLES.VILLAGER,
      });

      actionService.initNight(game.id);

      // Werewolf attacks villager-1
      actionService.submitAction(game, "wolf-1", ACTION_TYPES.WEREWOLF_ATTACK, "villager-1");

      // Guard shields villager-1
      actionService.submitAction(game, "guard-1", ACTION_TYPES.GUARD_PROTECT, "villager-1");

      // Witch poisons wolf-1!
      actionService.submitAction(game, "witch-1", ACTION_TYPES.WITCH_POISON, "wolf-1");

      const result = resolutionService.resolveNight(game);

      // villager-1 was shielded by guard. wolf-1 was killed by Witch's poison!
      expect(result.eliminatedPlayerIds).toContain("wolf-1");
      expect(result.eliminatedPlayerIds).not.toContain("villager-1");

      const wolf = game.players.find((p) => p.id === "wolf-1");
      expect(wolf.status).toBe(PLAYER_STATUS.ELIMINATED);
    });

    it("should enforce single-use restriction on Witch potions across rounds", () => {
      const game = createMockGame({
        "wolf-1": ROLES.WEREWOLF,
        "witch-1": ROLES.WITCH,
        "villager-1": ROLES.VILLAGER,
        "villager-2": ROLES.VILLAGER,
      });

      actionService.initNight(game.id);

      // Round 1: Witch uses heal
      actionService.submitAction(game, "witch-1", ACTION_TYPES.WITCH_HEAL, null);
      resolutionService.resolveNight(game);

      // Round 2 begins
      actionService.initNight(game.id);

      // Attempting to use heal again must throw error
      expect(() => {
        actionService.submitAction(game, "witch-1", ACTION_TYPES.WITCH_HEAL, null);
      }).toThrow(/already been consumed/i);
    });
  });
});
