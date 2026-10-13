const {
  ROLES,
  PLAYER_STATUS,
  PHASES,
  ACTION_TYPES,
  SEER_RESULTS,
} = require("../constants/index.js");

const SKIP_TARGET = "SKIP";

class NightActionService {
  constructor() {
    this.actionsByGameId = new Map();
    // gameId -> { werewolfTargets: Map, seerTargets: Map, guardTargets: Map, hunterTargets: Map, witchActions: Map }
    this.witchPotionsByGameId = new Map();
    // gameId -> Map<witchId, { healUsed: boolean, poisonUsed: boolean }>
  }

  /**
   * Initializes action state for a night round.
   */
  initNight(gameId) {
    this.actionsByGameId.set(gameId, {
      werewolfTargets: new Map(), // werewolfId -> targetId
      seerTargets: new Map(),     // seerId -> targetId
      guardTargets: new Map(),    // guardId -> targetId
      hunterTargets: new Map(),   // hunterId -> targetId (or SKIP)
      witchActions: new Map(),    // witchId -> { heal: boolean, poisonTargetId: string|null, skip: boolean }
    });
  }

  getGameActions(gameId) {
    let actions = this.actionsByGameId.get(gameId);
    if (!actions) {
      this.initNight(gameId);
      actions = this.actionsByGameId.get(gameId);
    }
    return actions;
  }

  getWitchPotions(gameId, witchId) {
    let gamePotions = this.witchPotionsByGameId.get(gameId);
    if (!gamePotions) {
      gamePotions = new Map();
      this.witchPotionsByGameId.set(gameId, gamePotions);
    }
    let potions = gamePotions.get(witchId);
    if (!potions) {
      potions = { healUsed: false, poisonUsed: false };
      gamePotions.set(witchId, potions);
    }
    return potions;
  }

  /**
   * Submits a role action during the night phase.
   */
  submitAction(game, actorId, actionType, targetId) {
    if (game.phase !== PHASES.NIGHT) {
      throw new Error("Night actions are only permitted during the night phase");
    }

    const actor = game.players.find((p) => p.id === actorId);
    if (!actor) throw new Error("Actor not found in game");

    if (actor.status !== PLAYER_STATUS.ALIVE) {
      throw new Error("Eliminated players cannot perform night abilities");
    }

    const roleInfo = game.roleAssignments.get(actorId);
    if (!roleInfo) throw new Error("Role assignment not found");
    const role = roleInfo.role;

    const actions = this.getGameActions(game.id);
    const cleanTarget = targetId === SKIP_TARGET ? SKIP_TARGET : targetId;

    // Validate self-targeting rules for target-dependent actions
    if (
      actionType !== ACTION_TYPES.WITCH_HEAL &&
      actionType !== ACTION_TYPES.WITCH_SKIP &&
      cleanTarget !== SKIP_TARGET &&
      cleanTarget !== null &&
      cleanTarget !== undefined
    ) {
      if (cleanTarget === actorId) {
        throw new Error("You cannot target yourself with this ability");
      }

      const targetPlayer = game.players.find((p) => p.id === cleanTarget);
      if (!targetPlayer) {
        throw new Error("Target player not found in game");
      }

      if (targetPlayer.status !== PLAYER_STATUS.ALIVE) {
        throw new Error("Cannot target an already eliminated player");
      }
    }

    // Role-specific action validation
    switch (actionType) {
      case ACTION_TYPES.WEREWOLF_ATTACK: {
        if (role !== ROLES.WEREWOLF) {
          throw new Error("Only living Werewolves may coordinate night attacks");
        }
        if (cleanTarget === SKIP_TARGET) {
          throw new Error("Werewolves must select a valid player target");
        }
        actions.werewolfTargets.set(actorId, cleanTarget);
        break;
      }

      case ACTION_TYPES.SEER_INVESTIGATE: {
        if (role !== ROLES.SEER) {
          throw new Error("Only the Seer may divine hidden identities");
        }
        if (cleanTarget === SKIP_TARGET) {
          throw new Error("The Seer must select a living player to investigate");
        }
        actions.seerTargets.set(actorId, cleanTarget);
        break;
      }

      case ACTION_TYPES.GUARD_PROTECT: {
        if (role !== ROLES.GUARD) {
          throw new Error("Only living Guards may protect villagers");
        }
        if (cleanTarget === SKIP_TARGET) {
          throw new Error("Guards must select a living player to protect");
        }
        actions.guardTargets.set(actorId, cleanTarget);
        break;
      }

      case ACTION_TYPES.HUNTER_SHOOT:
      case ACTION_TYPES.HUNTER_SKIP: {
        if (role !== ROLES.HUNTER) {
          throw new Error("Only living Hunters may wield weapons at night");
        }
        actions.hunterTargets.set(actorId, cleanTarget);
        break;
      }

      case ACTION_TYPES.WITCH_HEAL: {
        if (role !== ROLES.WITCH) {
          throw new Error("Only living Witches may concoct healing elixirs");
        }
        const potions = this.getWitchPotions(game.id, actorId);
        if (potions.healUsed) {
          throw new Error("Your healing elixir has already been consumed this match");
        }
        const existing = actions.witchActions.get(actorId) || {};
        actions.witchActions.set(actorId, { ...existing, heal: true });
        break;
      }

      case ACTION_TYPES.WITCH_POISON: {
        if (role !== ROLES.WITCH) {
          throw new Error("Only living Witches may brew lethal poison");
        }
        const potions = this.getWitchPotions(game.id, actorId);
        if (potions.poisonUsed) {
          throw new Error("Your lethal poison brew has already been consumed this match");
        }
        if (!cleanTarget || cleanTarget === SKIP_TARGET) {
          throw new Error("You must select a living player to administer poison to");
        }
        const existing = actions.witchActions.get(actorId) || {};
        actions.witchActions.set(actorId, { ...existing, poisonTargetId: cleanTarget });
        break;
      }

      case ACTION_TYPES.WITCH_SKIP: {
        if (role !== ROLES.WITCH) {
          throw new Error("Only living Witches may perform witch abilities");
        }
        actions.witchActions.set(actorId, { skip: true });
        break;
      }

      default:
        throw new Error(`Unknown night action type: ${actionType}`);
    }

    return {
      success: true,
      actorId,
      actionType,
      targetId: cleanTarget,
      witchPotions: role === ROLES.WITCH ? this.getWitchPotions(game.id, actorId) : undefined,
    };
  }

  /**
   * Resolves the coordinated Werewolf pack target per system.md Section 7.6.
   */
  getCoordinatedWerewolfTarget(game) {
    const actions = this.getGameActions(game.id);
    const livingWerewolves = game.players.filter((p) => {
      const info = game.roleAssignments.get(p.id);
      return p.status === PLAYER_STATUS.ALIVE && info?.role === ROLES.WEREWOLF;
    });

    if (livingWerewolves.length === 0) return null;

    const tally = new Map();
    for (const wolf of livingWerewolves) {
      const target = actions.werewolfTargets.get(wolf.id);
      if (target && target !== SKIP_TARGET) {
        tally.set(target, (tally.get(target) || 0) + 1);
      }
    }

    if (tally.size === 0) return null;

    const sortedTargets = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
    const highest = sortedTargets[0];
    const secondHighest = sortedTargets[1];

    // If tied, resolve attack as skip per system.md Section 7.6 rule 4
    if (secondHighest && highest[1] === secondHighest[1]) {
      return null;
    }

    return highest[0]; // Target player ID
  }

  /**
   * Divines faction classification for the Seer per system.md Section 7.7.
   * STRICTLY returns 'WEREWOLF' or 'NOT_WEREWOLF'. Never exposes exact role.
   */
  investigateTarget(game, targetId) {
    const targetAssignment = game.roleAssignments.get(targetId);
    if (!targetAssignment) {
      return SEER_RESULTS.NOT_WEREWOLF;
    }

    return targetAssignment.role === ROLES.WEREWOLF
      ? SEER_RESULTS.WEREWOLF
      : SEER_RESULTS.NOT_WEREWOLF;
  }
}

const nightActionService = new NightActionService();

module.exports = {
  NightActionService,
  nightActionService,
  SKIP_TARGET,
};
