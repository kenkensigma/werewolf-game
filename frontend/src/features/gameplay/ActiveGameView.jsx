import { useState, useEffect } from "react";
import { PHASES, PLAYER_STATUS } from "../../constants/index.js";
import { GameHeader } from "./GameHeader.jsx";
import { PlayerTableGrid } from "./PlayerTableGrid.jsx";
import { DiscussionChat } from "./DiscussionChat.jsx";
import { VotingPanel } from "./VotingPanel.jsx";
import { EliminationBanner } from "./EliminationBanner.jsx";
import { NightActionPanel } from "./NightActionPanel.jsx";
import { SeerInvestigationModal } from "./SeerInvestigationModal.jsx";
import "./ActiveGameView.css";

export function ActiveGameView({
  gameState,
  currentPlayer,
  privateRole,
  isHost,
  chatMessages,
  onSendMessage,
  onProceedToVote,
  onProceedToResolution,
  onSubmitVote,
  votingState,
  latestVotingResult,
  onDismissVotingResult,
  onSubmitNightAction,
  submittedNightTargetId,
  onProceedToDawn,
  seerInvestigationResult,
  onDismissSeerResult,
  latestElimination,
  onDismissElimination,
}) {
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [isSkipSelected, setIsSkipSelected] = useState(false);
  const [submittedVoteTargetId, setSubmittedVoteTargetId] = useState(null);

  const phase = gameState?.phase;
  const players = gameState?.players || [];
  const currentUserId = currentPlayer?.id;

  // Reset local selection when game phase transitions
  useEffect(() => {
    setSelectedCandidateId(null);
    setIsSkipSelected(false);
    if (phase !== PHASES.DAY_VOTING) {
      setSubmittedVoteTargetId(null);
    }
  }, [phase]);

  const currentSelfRecord = players.find((p) => p.id === currentUserId);
  const isAlive = currentSelfRecord ? currentSelfRecord.status === PLAYER_STATUS.ALIVE : true;

  const selectedCandidate = players.find((p) => p.id === selectedCandidateId) || null;
  const livingCandidates = players.filter(
    (p) => p.status === PLAYER_STATUS.ALIVE && p.id !== currentUserId
  );

  const handleSelectCandidate = (candidateId) => {
    setSelectedCandidateId(candidateId);
    setIsSkipSelected(false);
  };

  const handleSelectSkip = () => {
    setIsSkipSelected(true);
    setSelectedCandidateId(null);
  };

  const handleConfirmVote = (targetId) => {
    setSubmittedVoteTargetId(targetId);
    onSubmitVote(targetId);
  };

  const isVotingMode = phase === PHASES.DAY_VOTING;
  const isNightMode = phase === PHASES.NIGHT;
  const isTargetingMode = isVotingMode || isNightMode;
  const hasSubmittedAction = isVotingMode
    ? Boolean(submittedVoteTargetId)
    : Boolean(submittedNightTargetId);

  return (
    <div className="active-game-view" role="main" aria-label="Active Werewolf Game">
      {/* 1. Header with Phase and Countdown Timer */}
      <GameHeader
        phase={phase}
        dayNumber={gameState?.dayNumber}
        nightNumber={gameState?.nightNumber}
        phaseDeadline={gameState?.phaseDeadline}
        isHost={isHost}
        onProceedToVote={onProceedToVote}
      />

      {/* 2. Elimination Banner for Voting Results or Night Notices */}
      {latestVotingResult && (
        <EliminationBanner
          result={latestVotingResult}
          onDismiss={onDismissVotingResult}
        />
      )}

      {latestElimination && !latestVotingResult && (
        <EliminationBanner
          result={latestElimination}
          onDismiss={onDismissElimination}
        />
      )}

      {/* 3. Seer Investigation Modal (3D private card reveal) */}
      {seerInvestigationResult && (
        <SeerInvestigationModal
          targetName={seerInvestigationResult.targetName}
          result={seerInvestigationResult.result}
          onDismiss={onDismissSeerResult}
        />
      )}

      {/* 4. Main Gameplay Columns */}
      <div className="gameplay-columns">
        {/* Left Column: Living/Eliminated Player Grid */}
        <div className="gameplay-left-col">
          <PlayerTableGrid
            players={players}
            currentUserId={currentUserId}
            selectedCandidateId={selectedCandidateId}
            isVotingMode={isTargetingMode}
            onSelectCandidate={handleSelectCandidate}
            hasVoted={hasSubmittedAction}
          />
        </div>

        {/* Right Column: Dynamic Phase Action Panel */}
        <div className="gameplay-right-col">
          {phase === PHASES.NIGHT_1 && (
            <div className="gothic-panel night-setup-panel" role="region" aria-label="First Night Setup">
              <div className="panel-header">
                <h3 className="panel-title">First Night</h3>
                <span className="phase-cycle-label">Quiet Shadows</span>
              </div>
              <p className="night-flavor-text font-editorial">
                A shroud of mist descends upon the village. On this inaugural night, all souls sleep in fragile peace. No claws strike, and no visions disturb the quiet dark.
              </p>
              <div className="night-waiting-box">
                <span className="tabular-nums">Preparing for the first dawn...</span>
              </div>
            </div>
          )}

          {phase === PHASES.DAY_DISCUSSION && (
            <DiscussionChat
              messages={chatMessages}
              currentUserId={currentUserId}
              isAlive={isAlive}
              onSendMessage={onSendMessage}
            />
          )}

          {phase === PHASES.DAY_VOTING && (
            <VotingPanel
              selectedCandidate={selectedCandidate}
              isSkipSelected={isSkipSelected}
              onSelectSkip={handleSelectSkip}
              onSubmitVote={handleConfirmVote}
              submittedTargetId={submittedVoteTargetId}
              votesCastCount={votingState?.votesCastCount || 0}
              totalVoters={votingState?.totalVoters || livingCandidates.length + 1}
              isAlive={isAlive}
              isHost={isHost}
              onProceedToResolution={onProceedToResolution}
            />
          )}

          {phase === PHASES.NIGHT && (
            <NightActionPanel
              privateRole={privateRole}
              selectedCandidate={selectedCandidate}
              livingCandidates={livingCandidates}
              onSelectCandidate={handleSelectCandidate}
              onSubmitNightAction={onSubmitNightAction}
              submittedTargetId={submittedNightTargetId}
              isAlive={isAlive}
              isHost={isHost}
              onProceedToDawn={onProceedToDawn}
            />
          )}

          {phase === PHASES.GAME_OVER && (
            <div className="gothic-panel game-over-panel" role="region" aria-label="Match Concluded">
              <div className="panel-header">
                <h3 className="panel-title" style={{ color: "var(--color-gold)" }}>Match Concluded</h3>
                <span className="phase-cycle-label">Final Judgement</span>
              </div>
              <h4 className="game-over-winner-title font-display">
                {gameState?.winner === "TROUBLEMAKER"
                  ? "Troublemaker Victory"
                  : gameState?.winner === "VILLAGE"
                  ? "Village Victory"
                  : "Werewolf Victory"}
              </h4>
              <p className="font-editorial" style={{ color: "var(--color-parchment)", fontSize: "var(--text-base)" }}>
                {gameState?.winReason}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
