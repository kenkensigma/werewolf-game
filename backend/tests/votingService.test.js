import { describe, it, expect, beforeEach } from "vitest";
const { VotingService, SKIP_TARGET } = require("../src/services/votingService.js");
const { PHASES, PLAYER_STATUS, ROLES, FACTIONS } = require("../src/constants/index.js");

describe("VotingService Unit Tests", () => {
  let votingService;
  let fakeGame;

  beforeEach(() => {
    votingService = new VotingService();
    fakeGame = {
      id: "game-123",
      phase: PHASES.DAY_VOTING,
      players: [
        { id: "p1", displayName: "Alice", status: PLAYER_STATUS.ALIVE },
        { id: "p2", displayName: "Bob", status: PLAYER_STATUS.ALIVE },
        { id: "p3", displayName: "Charlie", status: PLAYER_STATUS.ALIVE },
        { id: "p4", displayName: "David", status: PLAYER_STATUS.ALIVE },
        { id: "p5", displayName: "Eve", status: PLAYER_STATUS.ELIMINATED },
      ],
      roleAssignments: new Map([
        ["p1", { role: ROLES.VILLAGER, faction: FACTIONS.VILLAGE }],
        ["p2", { role: ROLES.WEREWOLF, faction: FACTIONS.WEREWOLF }],
        ["p3", { role: ROLES.SEER, faction: FACTIONS.VILLAGE }],
        ["p4", { role: ROLES.TROUBLEMAKER, faction: FACTIONS.INDEPENDENT }],
        ["p5", { role: ROLES.GUARD, faction: FACTIONS.VILLAGE }],
      ]),
    };
  });

  it("should accept valid vote for another living player", () => {
    const result = votingService.submitVote(fakeGame, "p1", "p2");
    expect(result.voterId).toBe("p1");
    expect(result.targetId).toBe("p2");
    expect(result.votesSubmittedCount).toBe(1);
  });

  it("should reject self-voting with clear error", () => {
    expect(() => {
      votingService.submitVote(fakeGame, "p1", "p1");
    }).toThrow(/cannot cast a vote for yourself/i);
  });

  it("should reject voting for an already eliminated player", () => {
    expect(() => {
      votingService.submitVote(fakeGame, "p1", "p5");
    }).toThrow(/already eliminated/i);
  });

  it("should reject eliminated player attempting to cast vote", () => {
    expect(() => {
      votingService.submitVote(fakeGame, "p5", "p1");
    }).toThrow(/eliminated players cannot vote/i);
  });

  it("should replace previous vote when player changes their mind", () => {
    votingService.submitVote(fakeGame, "p1", "p2");
    expect(votingService.getVotesCount("game-123")).toBe(1);

    votingService.submitVote(fakeGame, "p1", "p3");
    expect(votingService.getVotesCount("game-123")).toBe(1);

    const resolution = votingService.resolveVotes(fakeGame);
    expect(resolution.eliminatedPlayerId).toBe("p3");
    expect(resolution.eliminatedPlayerName).toBe("Charlie");
  });

  it("should eliminate candidate with unique strictly highest votes", () => {
    votingService.submitVote(fakeGame, "p1", "p2"); // Alice -> Bob
    votingService.submitVote(fakeGame, "p3", "p2"); // Charlie -> Bob
    votingService.submitVote(fakeGame, "p4", "p1"); // David -> Alice

    const resolution = votingService.resolveVotes(fakeGame);
    expect(resolution.eliminatedPlayerId).toBe("p2");
    expect(resolution.eliminatedPlayerName).toBe("Bob");
    expect(resolution.isTie).toBe(false);
    expect(resolution.isTroublemakerWin).toBe(false);
  });

  it("should resolve tied votes as no elimination", () => {
    votingService.submitVote(fakeGame, "p1", "p2"); // Alice -> Bob
    votingService.submitVote(fakeGame, "p3", "p1"); // Charlie -> Alice

    const resolution = votingService.resolveVotes(fakeGame);
    expect(resolution.eliminatedPlayerId).toBeNull();
    expect(resolution.isTie).toBe(true);
    expect(resolution.reason).toMatch(/tie occurred/i);
  });

  it("should handle SKIP votes without eliminating candidates", () => {
    votingService.submitVote(fakeGame, "p1", SKIP_TARGET);
    votingService.submitVote(fakeGame, "p2", SKIP_TARGET);

    const resolution = votingService.resolveVotes(fakeGame);
    expect(resolution.eliminatedPlayerId).toBeNull();
    expect(resolution.skipCount).toBe(2);
  });

  it("should declare immediate victory if Troublemaker is eliminated by daytime vote", () => {
    // Vote out David (p4: Troublemaker)
    votingService.submitVote(fakeGame, "p1", "p4");
    votingService.submitVote(fakeGame, "p2", "p4");
    votingService.submitVote(fakeGame, "p3", "p4");

    const resolution = votingService.resolveVotes(fakeGame);
    expect(resolution.eliminatedPlayerId).toBe("p4");
    expect(resolution.eliminatedPlayerName).toBe("David");
    expect(resolution.isTroublemakerWin).toBe(true);
    expect(resolution.reason).toMatch(/Troublemaker and successfully deceived/i);
  });
});
