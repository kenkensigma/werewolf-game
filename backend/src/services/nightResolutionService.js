const {
  PLAYER_STATUS,
  PHASES,
  ROLES,
} = require("../constants/index.js");
const { nightActionService, SKIP_TARGET } = require("./nightActionService.js");
const { gameStateService } = require("./gameStateService.js");

class NightResolutionService {
  constructor(actionService = null) {
    this.actionService = actionService || nightActionService;
  }

  /**
   * Deterministic simultaneous night resolution engine (system.md Section 8.2).
   */
  resolveNight(game) {
    const actions = this.actionService.getGameActions(game.id);

    // 1. Snapshot living players at the start of resolution
    const livingPlayersSnapshot = new Set(
      game.players
        .filter((p) => p.status === PLAYER_STATUS.ALIVE)
        .map((p) => p.id)
    );

    // 2. Determine coordinated Werewolf target
    const werewolfTargetId = this.actionService.getCoordinatedWerewolfTarget(game);

    // 3. Build Guard protection set
    const protectedPlayerIds = new Set();
    for (const [guardId, targetId] of actions.guardTargets.entries()) {
      if (livingPlayersSnapshot.has(guardId) && targetId && targetId !== SKIP_TARGET) {
        if (livingPlayersSnapshot.has(targetId)) {
          protectedPlayerIds.add(targetId);
        }
      }
    }

    // 4. Collect valid Hunter attacks
    const hunterAttacks = [];
    for (const [hunterId, targetId] of actions.hunterTargets.entries()) {
      if (
        livingPlayersSnapshot.has(hunterId) &&
        targetId &&
        targetId !== SKIP_TARGET &&
        livingPlayersSnapshot.has(targetId)
      ) {
        hunterAttacks.push({
          hunterId,
          targetId,
        });
      }
    }

    // 5. Build raw attack list
    const incomingAttacks = [];

    if (werewolfTargetId && livingPlayersSnapshot.has(werewolfTargetId)) {
      incomingAttacks.push({
        source: ROLES.WEREWOLF,
        targetId: werewolfTargetId,
      });
    }

    for (const hunterAttack of hunterAttacks) {
      incomingAttacks.push({
        source: ROLES.HUNTER,
        targetId: hunterAttack.targetId,
      });
    }

    // 6. Filter attacks against Guard protection set
    const successfulAttacks = incomingAttacks.filter(
      (attack) => !protectedPlayerIds.has(attack.targetId)
    );

    // 7. Deduplicate surviving eliminated targets
    const eliminatedPlayerIds = Array.from(
      new Set(successfulAttacks.map((a) => a.targetId))
    );

    // 8. Apply eliminations simultaneously to game state
    const eliminatedPlayers = [];

    for (const eliminatedId of eliminatedPlayerIds) {
      const playerRecord = game.players.find((p) => p.id === eliminatedId);
      if (playerRecord) {
        playerRecord.status = PLAYER_STATUS.ELIMINATED;
        playerRecord.eliminatedAtPhase = PHASES.NIGHT;
        eliminatedPlayers.push({
          id: playerRecord.id,
          displayName: playerRecord.displayName,
        });
      }
    }

    // 9. Check victory conditions after all night eliminations have applied
    const victory = gameStateService.checkVictoryConditions(game);

    // 10. Clean up night action state for this game
    this.actionService.initNight(game.id);

    return {
      werewolfTargetId,
      protectedPlayerIds: Array.from(protectedPlayerIds),
      hunterAttacks,
      eliminatedPlayerIds,
      eliminatedPlayers,
      allAttacksBlocked: incomingAttacks.length > 0 && eliminatedPlayerIds.length === 0,
      peacefulNight: incomingAttacks.length === 0,
      victory,
    };
  }
}

const nightResolutionService = new NightResolutionService();

module.exports = {
  NightResolutionService,
  nightResolutionService,
};
