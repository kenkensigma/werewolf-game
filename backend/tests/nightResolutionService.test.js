import { describe, it, expect, beforeEach } from "vitest";
const {
  NightActionService,
  SKIP_TARGET,
} = require("../src/services/nightActionService.js");
const {
  NightResolutionService,
} = require("../src/services/nightResolutionService.js");
const {
  ROLES,
  FACTIONS,
  PHASES,
  PLAYER_STATUS,
  ACTION_TYPES,
  SEER_RESULTS,
} = require("../src/constants/index.js");

describe("Night Action & Resolution Engine Unit Tests", () => {
  let actionService;
  let resolutionService;
  let fakeGame;

  beforeEach(() => {
    actionService = new NightActionService();
    resolutionService = new NightResolutionService(actionService);

    fakeGame = {
      id: "game-night-test",
      phase: PHASES.NIGHT,
      players: [
        { id: "w1", displayName: "Wolf1", status: PLAYER_STATUS.ALIVE },
        { id: "w2", displayName: "Wolf2", status: PLAYER_STATUS.ALIVE },
        { id: "s1", displayName: "Seer1", status: PLAYER_STATUS.ALIVE },
        { id: "g1", displayName: "Guard1", status: PLAYER_STATUS.ALIVE },
        { id: "g2", displayName: "Guard2", status: PLAYER_STATUS.ALIVE },
        { id: "h1", displayName: "Hunter1", status: PLAYER_STATUS.ALIVE },
        { id: "h2", displayName: "Hunter2", status: PLAYER_STATUS.ALIVE },
        { id: "v1", displayName: "Villager1", status: PLAYER_STATUS.ALIVE },
        { id: "v2", displayName: "Villager2", status: PLAYER_STATUS.ALIVE },
        { id: "v3", displayName: "DeadVillager", status: PLAYER_STATUS.ELIMINATED },
      ],
      roleAssignments: new Map([
        ["w1", { role: ROLES.WEREWOLF, faction: FACTIONS.WEREWOLF }],
        ["w2", { role: ROLES.WEREWOLF, faction: FACTIONS.WEREWOLF }],
        ["s1", { role: ROLES.SEER, faction: FACTIONS.VILLAGE }],
        ["g1", { role: ROLES.GUARD, faction: FACTIONS.VILLAGE }],
        ["g2", { role: ROLES.GUARD, faction: FACTIONS.VILLAGE }],
        ["h1", { role: ROLES.HUNTER, faction: FACTIONS.VILLAGE }],
        ["h2", { role: ROLES.HUNTER, faction: FACTIONS.VILLAGE }],
        ["v1", { role: ROLES.VILLAGER, faction: FACTIONS.VILLAGE }],
        ["v2", { role: ROLES.VILLAGER, faction: FACTIONS.VILLAGE }],
        ["v3", { role: ROLES.VILLAGER, faction: FACTIONS.VILLAGE }],
      ]),
    };
  });

  it("should eliminate unprotected player attacked by Werewolves", () => {
    actionService.submitAction(fakeGame, "w1", ACTION_TYPES.WEREWOLF_ATTACK, "v1");
    actionService.submitAction(fakeGame, "w2", ACTION_TYPES.WEREWOLF_ATTACK, "v1");

    const result = resolutionService.resolveNight(fakeGame);
    expect(result.eliminatedPlayerIds).toContain("v1");
    expect(fakeGame.players.find((p) => p.id === "v1").status).toBe(PLAYER_STATUS.ELIMINATED);
  });

  it("should protect player from Werewolf attack when guarded", () => {
    // Werewolves attack Villager1
    actionService.submitAction(fakeGame, "w1", ACTION_TYPES.WEREWOLF_ATTACK, "v1");
    actionService.submitAction(fakeGame, "w2", ACTION_TYPES.WEREWOLF_ATTACK, "v1");
    // Guard1 protects Villager1
    actionService.submitAction(fakeGame, "g1", ACTION_TYPES.GUARD_PROTECT, "v1");

    const result = resolutionService.resolveNight(fakeGame);
    expect(result.protectedPlayerIds).toContain("v1");
    expect(result.eliminatedPlayerIds).not.toContain("v1");
    expect(fakeGame.players.find((p) => p.id === "v1").status).toBe(PLAYER_STATUS.ALIVE);
  });

  it("should protect player from Hunter attack when guarded", () => {
    // Hunter1 shoots Villager2, Guard2 protects Villager2
    actionService.submitAction(fakeGame, "h1", ACTION_TYPES.HUNTER_SHOOT, "v2");
    actionService.submitAction(fakeGame, "g2", ACTION_TYPES.GUARD_PROTECT, "v2");

    const result = resolutionService.resolveNight(fakeGame);
    expect(result.eliminatedPlayerIds).not.toContain("v2");
    expect(fakeGame.players.find((p) => p.id === "v2").status).toBe(PLAYER_STATUS.ALIVE);
  });

  it("should eliminate target once when attacked by both Hunters simultaneously", () => {
    actionService.submitAction(fakeGame, "h1", ACTION_TYPES.HUNTER_SHOOT, "v1");
    actionService.submitAction(fakeGame, "h2", ACTION_TYPES.HUNTER_SHOOT, "v1");

    const result = resolutionService.resolveNight(fakeGame);
    expect(result.eliminatedPlayerIds).toHaveLength(1);
    expect(result.eliminatedPlayerIds[0]).toBe("v1");
  });

  it("should eliminate multiple unprotected targets attacked by different sources", () => {
    // Wolves attack Villager1, Hunter1 shoots Wolf2
    actionService.submitAction(fakeGame, "w1", ACTION_TYPES.WEREWOLF_ATTACK, "v1");
    actionService.submitAction(fakeGame, "w2", ACTION_TYPES.WEREWOLF_ATTACK, "v1");
    actionService.submitAction(fakeGame, "h1", ACTION_TYPES.HUNTER_SHOOT, "w2");

    const result = resolutionService.resolveNight(fakeGame);
    expect(result.eliminatedPlayerIds).toContain("v1");
    expect(result.eliminatedPlayerIds).toContain("w2");
    expect(result.eliminatedPlayerIds).toHaveLength(2);
  });

  it("should skip Werewolf attack when wolf votes are tied", () => {
    actionService.submitAction(fakeGame, "w1", ACTION_TYPES.WEREWOLF_ATTACK, "v1");
    actionService.submitAction(fakeGame, "w2", ACTION_TYPES.WEREWOLF_ATTACK, "v2");

    const target = actionService.getCoordinatedWerewolfTarget(fakeGame);
    expect(target).toBeNull();

    const result = resolutionService.resolveNight(fakeGame);
    expect(result.werewolfTargetId).toBeNull();
    expect(result.eliminatedPlayerIds).not.toContain("v1");
    expect(result.eliminatedPlayerIds).not.toContain("v2");
  });

  it("should return strictly WEREWOLF or NOT_WEREWOLF for Seer investigation", () => {
    const wolfResult = actionService.investigateTarget(fakeGame, "w1");
    expect(wolfResult).toBe(SEER_RESULTS.WEREWOLF);

    const villagerResult = actionService.investigateTarget(fakeGame, "v1");
    expect(villagerResult).toBe(SEER_RESULTS.NOT_WEREWOLF);

    const guardResult = actionService.investigateTarget(fakeGame, "g1");
    expect(guardResult).toBe(SEER_RESULTS.NOT_WEREWOLF);
  });

  it("should reject self-targeting for all role abilities", () => {
    expect(() => {
      actionService.submitAction(fakeGame, "w1", ACTION_TYPES.WEREWOLF_ATTACK, "w1");
    }).toThrow(/cannot target yourself/i);

    expect(() => {
      actionService.submitAction(fakeGame, "g1", ACTION_TYPES.GUARD_PROTECT, "g1");
    }).toThrow(/cannot target yourself/i);

    expect(() => {
      actionService.submitAction(fakeGame, "s1", ACTION_TYPES.SEER_INVESTIGATE, "s1");
    }).toThrow(/cannot target yourself/i);

    expect(() => {
      actionService.submitAction(fakeGame, "h1", ACTION_TYPES.HUNTER_SHOOT, "h1");
    }).toThrow(/cannot target yourself/i);
  });

  it("should reject eliminated players attempting to perform night actions", () => {
    expect(() => {
      actionService.submitAction(fakeGame, "v3", ACTION_TYPES.HUNTER_SHOOT, "v1");
    }).toThrow(/eliminated players cannot perform/i);
  });
});
