const crypto = require("crypto");
const {
  ROLES,
  FACTIONS,
  ROLE_FACTIONS,
  ROLE_METADATA,
} = require("../constants/index.js");

class RoleAssignmentService {
  /**
   * Generates the role pool array based on player count and chamber configuration.
   */
  generateRolePool(totalPlayers, config) {
    const werewolfCount = config.werewolfCount ?? 2;
    const seerCount = config.seerCount !== undefined ? config.seerCount : 1;
    const guardCount =
      config.guardCount !== undefined
        ? config.guardCount
        : config.seerCount !== undefined
        ? 1
        : 2;
    const hunterCount =
      config.hunterCount !== undefined
        ? config.hunterCount
        : config.seerCount !== undefined
        ? 1
        : 2;
    const witchCount = config.witchCount !== undefined ? config.witchCount : 0;
    const troublemakerCount = config.troublemakerEnabled ? 1 : 0;

    const assignedSpecialCount =
      werewolfCount + seerCount + guardCount + hunterCount + witchCount + troublemakerCount;

    if (totalPlayers < assignedSpecialCount + 1) {
      throw new Error(
        `Insufficient players (${totalPlayers}) for configured roles. Minimum required: ${assignedSpecialCount + 1}`
      );
    }

    const pool = [];

    // 1. Werewolves
    for (let i = 0; i < werewolfCount; i++) {
      pool.push(ROLES.WEREWOLF);
    }

    // 2. Village special roles
    for (let i = 0; i < seerCount; i++) {
      pool.push(ROLES.SEER);
    }
    for (let i = 0; i < guardCount; i++) {
      pool.push(ROLES.GUARD);
    }
    for (let i = 0; i < hunterCount; i++) {
      pool.push(ROLES.HUNTER);
    }
    for (let i = 0; i < witchCount; i++) {
      pool.push(ROLES.WITCH);
    }

    // 3. Optional Troublemaker
    if (troublemakerCount > 0) {
      pool.push(ROLES.TROUBLEMAKER);
    }

    // 4. Fill remaining slots with Villagers
    const villagerCount = totalPlayers - pool.length;
    for (let i = 0; i < villagerCount; i++) {
      pool.push(ROLES.VILLAGER);
    }

    return pool;
  }

  /**
   * Cryptographically secure Fisher-Yates array shuffle.
   */
  secureShuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Generate uniform random index in [0, i]
      const randomBuffer = crypto.randomBytes(4);
      const randomInt = randomBuffer.readUInt32BE(0);
      const j = randomInt % (i + 1);

      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    return shuffled;
  }

  /**
   * Assigns roles securely to a list of players.
   * Returns a Map of playerId -> { role, faction, abilityDescription }
   */
  assignRoles(players, config) {
    if (!players || players.length === 0) {
      throw new Error("Cannot assign roles to empty player list");
    }

    const pool = this.generateRolePool(players.length, config);
    const shuffledRoles = this.secureShuffle(pool);

    const assignments = new Map();

    players.forEach((player, index) => {
      const role = shuffledRoles[index];
      const meta = ROLE_METADATA[role];
      const faction = ROLE_FACTIONS[role];

      assignments.set(player.id, {
        role,
        faction,
        abilityDescription: meta.description,
        colorAccent: meta.colorAccent,
      });
    });

    return assignments;
  }
}

const roleAssignmentService = new RoleAssignmentService();

module.exports = {
  RoleAssignmentService,
  roleAssignmentService,
};
