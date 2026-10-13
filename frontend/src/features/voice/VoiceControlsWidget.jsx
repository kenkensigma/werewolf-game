import { useState, useEffect, useCallback } from "react";
import { voiceChatService } from "../../services/voiceChatService.js";
import "./VoiceControlsWidget.css";

export function VoiceControlsWidget({
  roomCode,
  currentPlayerId,
  players,
  currentUserId,
  phase,
  myRole,
}) {
  const [voiceState, setVoiceState] = useState({
    isMuted: true,
    isDeafened: false,
    isSpatialEnabled: true,
    isSpeaking: false,
    isConnected: false,
    peersCount: 0,
    speakingUsers: [],
    mutedUsers: [],
  });

  const [isJoining, setIsJoining] = useState(false);
  const [joinFailed, setJoinFailed] = useState(false);

  useEffect(() => {
    const unsub = voiceChatService.onStateChange((state) => {
      setVoiceState(state);
    });

    return () => {
      unsub();
    };
  }, []);

  // Update spatial audio positions whenever players, phase, or role changes
  useEffect(() => {
    if (voiceState.isConnected) {
      voiceChatService.updateSpatialAudio(players, currentUserId, phase, myRole);
    }
  }, [players, currentUserId, phase, myRole, voiceState.isConnected]);

  const handleJoinVoice = useCallback(async () => {
    if (!roomCode || !currentPlayerId) return;
    setIsJoining(true);
    setJoinFailed(false);
    const success = await voiceChatService.joinVoice(roomCode, currentPlayerId);
    setIsJoining(false);
    if (!success) {
      setJoinFailed(true);
    }
  }, [roomCode, currentPlayerId]);

  const handleToggleMute = useCallback(() => {
    voiceChatService.toggleMute();
  }, []);

  const handleToggleDeafen = useCallback(() => {
    voiceChatService.toggleDeafen();
  }, []);

  const handleToggleSpatial = useCallback(() => {
    voiceChatService.toggleSpatial();
  }, []);

  const handleLeaveVoice = useCallback(() => {
    voiceChatService.leaveVoice();
  }, []);

  // Not yet joined voice
  if (!voiceState.isConnected) {
    return (
      <div className="voice-controls-bar" role="region" aria-label="Voice Chat Controls">
        <div className="voice-info-pill">
          <span className="voice-title">
            <span className="voice-indicator-dot" aria-hidden="true" />
            Proximity Voice
          </span>
          <span className="voice-subtitle">
            {joinFailed ? "Microphone denied - text only" : "Click to join voice chat"}
          </span>
        </div>

        {!joinFailed && (
          <button
            type="button"
            className="voice-enable-btn"
            onClick={handleJoinVoice}
            disabled={isJoining}
            aria-label="Join Voice Chat"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
            </svg>
            {isJoining ? "Joining..." : "Join Voice"}
          </button>
        )}

        {joinFailed && (
          <button
            type="button"
            className="voice-enable-btn"
            onClick={handleJoinVoice}
            aria-label="Retry joining voice chat"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
            </svg>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="voice-controls-bar" role="region" aria-label="Proximity Voice Chat Controls">
      <div className="voice-info-pill">
        <span className="voice-title">
          <span
            className={`voice-indicator-dot ${voiceState.isSpeaking ? "active" : ""}`}
            aria-hidden="true"
          />
          Voice Chat
        </span>
        <span className="voice-subtitle">
          {voiceState.isSpeaking
            ? "Speaking..."
            : voiceState.isMuted
            ? "Muted"
            : `${voiceState.peersCount} peer${voiceState.peersCount !== 1 ? "s" : ""} connected`}
        </span>
      </div>

      {/* Mute / Unmute */}
      <button
        type="button"
        id="voice-btn-mute"
        className={`voice-btn ${voiceState.isMuted ? "is-muted" : voiceState.isSpeaking ? "is-speaking" : ""}`}
        onClick={handleToggleMute}
        aria-label={voiceState.isMuted ? "Unmute microphone" : "Mute microphone"}
        title={voiceState.isMuted ? "Unmute" : "Mute"}
      >
        {voiceState.isMuted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
          </svg>
        )}
      </button>

      {/* Deafen / Undeafen */}
      <button
        type="button"
        id="voice-btn-deafen"
        className={`voice-btn ${voiceState.isDeafened ? "is-deafened" : ""}`}
        onClick={handleToggleDeafen}
        aria-label={voiceState.isDeafened ? "Undeafen audio" : "Deafen audio output"}
        title={voiceState.isDeafened ? "Undeafen" : "Deafen"}
      >
        {voiceState.isDeafened ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        )}
      </button>

      {/* Spatial toggle */}
      <button
        type="button"
        id="voice-btn-spatial"
        className={`voice-btn ${voiceState.isSpatialEnabled ? "spatial-active" : ""}`}
        onClick={handleToggleSpatial}
        aria-label={voiceState.isSpatialEnabled ? "Disable spatial audio" : "Enable spatial audio"}
        title={voiceState.isSpatialEnabled ? "Spatial ON" : "Spatial OFF"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      </button>

      {/* Leave Voice */}
      <button
        type="button"
        id="voice-btn-leave"
        className="voice-btn"
        onClick={handleLeaveVoice}
        aria-label="Leave voice chat"
        title="Leave Voice"
        style={{ color: "#8d343b", borderColor: "rgba(141,52,59,0.4)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9H13V8c0-.55-.45-1-1-1s-1 .45-1 1v3H8.5c-.55 0-1 .45-1 1s.45 1 1 1H11v3c0 .55.45 1 1 1s1-.45 1-1v-3h2.5c.55 0 1-.45 1-1s-.45-1-1-1z" />
        </svg>
      </button>
    </div>
  );
}
