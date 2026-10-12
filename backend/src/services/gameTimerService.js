class GameTimerService {
  constructor() {
    this.timersByGameId = new Map(); // gameId -> { timeoutId, deadline, phase, onExpire }
  }

  /**
   * Starts an authoritative server phase timer.
   */
  startTimer(gameId, phase, durationSeconds, onExpire) {
    this.cancelTimer(gameId);

    const now = Date.now();
    const durationMs = Math.max(1000, durationSeconds * 1000);
    const deadline = now + durationMs;

    const timeoutId = setTimeout(() => {
      this.timersByGameId.delete(gameId);
      if (typeof onExpire === "function") {
        try {
          onExpire();
        } catch (err) {
          console.error(`Error in timer expiry for game ${gameId} in phase ${phase}:`, err);
        }
      }
    }, durationMs);

    this.timersByGameId.set(gameId, {
      timeoutId,
      startedAt: now,
      deadline,
      phase,
      onExpire,
    });

    return {
      startedAt: now,
      deadline,
      durationSeconds,
    };
  }

  /**
   * Cancels any active timer for a game.
   */
  cancelTimer(gameId) {
    const existing = this.timersByGameId.get(gameId);
    if (existing) {
      clearTimeout(existing.timeoutId);
      this.timersByGameId.delete(gameId);
    }
  }

  /**
   * Retrieves remaining seconds for the active timer.
   */
  getRemainingSeconds(gameId) {
    const timer = this.timersByGameId.get(gameId);
    if (!timer) return 0;
    const remainingMs = timer.deadline - Date.now();
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }

  getActiveTimer(gameId) {
    return this.timersByGameId.get(gameId) || null;
  }
}

const gameTimerService = new GameTimerService();

module.exports = {
  GameTimerService,
  gameTimerService,
};
