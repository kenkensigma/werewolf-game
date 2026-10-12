import { describe, it, expect } from "vitest";
const {
  ROLES,
  FACTIONS,
  ROLE_FACTIONS,
  PHASES,
  SOCKET_EVENTS,
  ROLE_METADATA,
} = require("../src/constants/index.js");

describe("Game Constants", () => {
  it("should have all 6 core roles defined", () => {
    expect(ROLES.WEREWOLF).toBe("WEREWOLF");
    expect(ROLES.SEER).toBe("SEER");
    expect(ROLES.GUARD).toBe("GUARD");
    expect(ROLES.HUNTER).toBe("HUNTER");
    expect(ROLES.VILLAGER).toBe("VILLAGER");
    expect(ROLES.TROUBLEMAKER).toBe("TROUBLEMAKER");
  });

  it("should map roles to correct factions", () => {
    expect(ROLE_FACTIONS[ROLES.WEREWOLF]).toBe(FACTIONS.WEREWOLF);
    expect(ROLE_FACTIONS[ROLES.SEER]).toBe(FACTIONS.VILLAGE);
    expect(ROLE_FACTIONS[ROLES.GUARD]).toBe(FACTIONS.VILLAGE);
    expect(ROLE_FACTIONS[ROLES.HUNTER]).toBe(FACTIONS.VILLAGE);
    expect(ROLE_FACTIONS[ROLES.VILLAGER]).toBe(FACTIONS.VILLAGE);
    expect(ROLE_FACTIONS[ROLES.TROUBLEMAKER]).toBe(FACTIONS.INDEPENDENT);
  });

  it("should define all lifecycle phases", () => {
    expect(PHASES.LOBBY).toBe("LOBBY");
    expect(PHASES.ROLE_DISTRIBUTION).toBe("ROLE_DISTRIBUTION");
    expect(PHASES.ROLE_REVEAL).toBe("ROLE_REVEAL");
    expect(PHASES.NIGHT_1).toBe("NIGHT_1");
    expect(PHASES.DAY_DISCUSSION).toBe("DAY_DISCUSSION");
    expect(PHASES.DAY_VOTING).toBe("DAY_VOTING");
    expect(PHASES.NIGHT).toBe("NIGHT");
    expect(PHASES.NIGHT_RESOLUTION).toBe("NIGHT_RESOLUTION");
    expect(PHASES.GAME_OVER).toBe("GAME_OVER");
  });

  it("should contain metadata for every role without forbidden em dashes", () => {
    for (const roleKey of Object.keys(ROLES)) {
      const meta = ROLE_METADATA[roleKey];
      expect(meta).toBeDefined();
      expect(meta.name).toBeDefined();
      expect(meta.description).toBeDefined();
      expect(meta.description).not.toContain("—");
    }
  });

  it("should define core client and server socket events", () => {
    expect(SOCKET_EVENTS.ROOM_CREATE).toBe("room:create");
    expect(SOCKET_EVENTS.ROOM_JOIN).toBe("room:join");
    expect(SOCKET_EVENTS.GAME_START).toBe("game:start");
    expect(SOCKET_EVENTS.ROOM_STATE).toBe("room:state");
    expect(SOCKET_EVENTS.GAME_YOUR_ROLE).toBe("game:your-role");
  });
});
