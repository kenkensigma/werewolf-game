const { PHASES, PLAYER_STATUS, ROLES } = require("../constants/index.js");

const SKIP_TARGET = "SKIP";

class VotingService {
  constructor() {
    this.votesByGameId = new Map(); // gameId -> Map<voterId, targetId>
  }

  /**
   * Initializes or clears voting state for a game round.
   */
  initVoting(gameId) {
    this.votesByGameId.set(gameId, new Map());
  }

  /**
   * Submits or changes a vote for a living player.
   */
  submitVote(game, voterId, targetId) {
    if (game.phase !== PHASES.DAY_VOTING) {
      throw new Error("Voting is only permitted during the day voting phase");
    }

    const voter = game.players.find((p) => p.id === voterId);
    if (!voter) {
      throw new Error("Voter not found in game");
    }

    if (voter.status !== PLAYER_STATUS.ALIVE) {
      throw new Error("Eliminated players cannot vote");
    }

    // Target validation
    const cleanTarget = targetId === SKIP_TARGET ? SKIP_TARGET : targetId;

    if (cleanTarget !== SKIP_TARGET) {
      if (cleanTarget === voterId) {
        throw new Error("You cannot cast a vote for yourself");
      }

      const candidate = game.players.find((p) => p.id === cleanTarget);
      if (!candidate) {
        throw new Error("Vote target does not exist in this game");
      }

      if (candidate.status !== PLAYER_STATUS.ALIVE) {
        throw new Error("Cannot vote for an already eliminated player");
      }
    }

    let gameVotes = this.votesByGameId.get(game.id);
    if (!gameVotes) {
      gameVotes = new Map();
      this.votesByGameId.set(game.id, gameVotes);
    }

    // Replace previous vote
    gameVotes.set(voterId, cleanTarget);

    const livingPlayers = game.players.filter((p) => p.status === PLAYER_STATUS.ALIVE);
    const votesSubmittedCount = gameVotes.size;

    return {
      voterId,
      targetId: cleanTarget,
      totalLivingPlayers: livingPlayers.length,
      votesSubmittedCount,
      allVotesIn: votesSubmittedCount >= livingPlayers.length,
    };
  }

  /**
   * Resolves the voting outcome per system.md Section 7.5.
   * - Must have strictly more votes than all other candidates.
   * - Ties for highest count result in NO elimination.
   * - SKIP is not an elimination candidate.
   * - Troublemaker voted out wins immediately.
   */
  resolveVotes(game) {
    const gameVotes = this.votesByGameId.get(game.id) || new Map();
    const livingPlayers = game.players.filter((p) => p.status === PLAYER_STATUS.ALIVE);

    const tally = new Map(); // candidateId -> count
    let skipCount = 0;

    for (const [, targetId] of gameVotes.entries()) {
      if (targetId === SKIP_TARGET) {
        skipCount++;
      } else {
        const count = tally.get(targetId) || 0;
        tally.set(targetId, count + 1);
      }
    }

    // Convert tally to readable format
    const candidateResults = [];
    tally.forEach((voteCount, candidateId) => {
      const candidate = game.players.find((p) => p.id === candidateId);
      if (candidate && candidate.status === PLAYER_STATUS.ALIVE) {
        candidateResults.push({
          candidateId,
          displayName: candidate.displayName,
          voteCount,
        });
      }
    });

    // Sort descending by vote count
    candidateResults.sort((a, b) => b.voteCount - a.voteCount);

    let eliminatedCandidate = null;
    let isTie = false;
    let reason = "No elimination occurred";

    if (candidateResults.length > 0) {
      const highest = candidateResults[0];
      const secondHighest = candidateResults[1];

      if (highest.voteCount > 0) {
        if (!secondHighest || highest.voteCount > secondHighest.voteCount) {
          // Strictly highest unique candidate
          eliminatedCandidate = highest;
          reason = `${highest.displayName} received the highest unique vote count (${highest.voteCount} votes).`;
        } else {
          isTie = true;
          reason = `A tie occurred between candidates with ${highest.voteCount} votes each. No one is executed.`;
        }
      }
    } else {
      reason = "No candidate votes were cast. No one is executed.";
    }

    // Check Troublemaker daytime victory if someone was eliminated
    let isTroublemakerWin = false;
    let eliminatedRole = null;

    if (eliminatedCandidate) {
      const playerRecord = game.players.find((p) => p.id === eliminatedCandidate.candidateId);
      if (playerRecord) {
        playerRecord.status = PLAYER_STATUS.ELIMINATED;
        playerRecord.eliminatedAtPhase = PHASES.DAY_VOTING;

        // Retrieve private role assignment from game
        const roleInfo = game.roleAssignments.get(eliminatedCandidate.candidateId);
        eliminatedRole = roleInfo?.role;

        if (eliminatedRole === ROLES.TROUBLEMAKER) {
          isTroublemakerWin = true;
          reason = `${eliminatedCandidate.displayName} was the Troublemaker and successfully deceived the village into executing them!`;
        }
      }
    }

    // Clear votes for this round
    this.votesByGameId.delete(game.id);

    return {
      eliminatedPlayerId: eliminatedCandidate ? eliminatedCandidate.candidateId : null,
      eliminatedPlayerName: eliminatedCandidate ? eliminatedCandidate.displayName : null,
      isTie,
      reason,
      skipCount,
      tally: candidateResults,
      isTroublemakerWin,
      eliminatedRole,
    };
  }

  getVotesCount(gameId) {
    const gameVotes = this.votesByGameId.get(gameId);
    return gameVotes ? gameVotes.size : 0;
  }
}

const votingService = new VotingService();

module.exports = {
  VotingService,
  votingService,
  SKIP_TARGET,
};
