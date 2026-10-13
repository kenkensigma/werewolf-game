import { useState, useEffect, useRef, useCallback } from "react";
import { audioService, SFX_TYPES, TRACK_INFO, BGM_TRACKS } from "../../services/audioService.js";
import "./AudioControlsWidget.css";

export function AudioControlsWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [audioState, setAudioState] = useState(audioService.getState());
  const panelRef = useRef(null);

  useEffect(() => {
    const unsub = audioService.onStateChange((nextState) => {
      setAudioState(nextState);
    });
    return () => unsub();
  }, []);

  // Close panel on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!audioState.isUnlocked) {
      audioService.unlockAudioContext();
    }
  };

  const handleBgmVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    audioService.setBgmVolume(val);
  };

  const handleSfxVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    audioService.setSfxVolume(val);
  };

  const handleToggleBgmMute = () => {
    audioService.toggleBgmMute();
  };

  const handleToggleSfxMute = () => {
    audioService.toggleSfxMute();
  };

  const handleToggleMasterMute = () => {
    audioService.toggleMasterMute();
  };

  const handleUnlockAudio = () => {
    audioService.unlockAudioContext();
  };

  const handleTestSfx = (sfxType) => {
    audioService.playSfx(sfxType);
  };

  const isGloballyMuted = audioState.isMasterMuted || (audioState.isBgmMuted && audioState.isSfxMuted);
  const currentTrackMeta = TRACK_INFO[audioState.currentTrack] || TRACK_INFO[BGM_TRACKS.LOBBY];

  const bgmPercent = Math.round(audioState.bgmVolume * 100);
  const sfxPercent = Math.round(audioState.sfxVolume * 100);

  return (
    <div className="audio-widget-container" ref={panelRef}>
      {/* Floating Trigger Button */}
      <button
        type="button"
        className={`audio-trigger-btn ${isGloballyMuted ? "is-muted" : ""}`}
        onClick={handleToggleOpen}
        aria-label="Audio & Atmosphere Settings"
        aria-expanded={isOpen}
      >
        {/* Equalizer animation when playing and not muted */}
        {!isGloballyMuted && audioState.isPlaying && !audioState.isBgmMuted ? (
          <div className="audio-equalizer" aria-hidden="true">
            <span className="audio-eq-bar" />
            <span className="audio-eq-bar" />
            <span className="audio-eq-bar" />
          </div>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {isGloballyMuted ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
        )}

        <span>{isGloballyMuted ? "Muted" : `${bgmPercent}%`}</span>

        {!audioState.isUnlocked && (
          <span
            className="audio-status-dot needs-unlock"
            title="Click to awaken audio"
            aria-label="Audio awaiting interaction"
          />
        )}
      </button>

      {/* Settings Popover */}
      {isOpen && (
        <div className="audio-panel" role="dialog" aria-label="Audio Controls">
          {/* Header */}
          <div className="audio-panel-header">
            <h3 className="audio-panel-title">
              <span>🎵</span> Atmosphere & Audio
            </h3>
            <button
              type="button"
              className={`audio-master-mute-btn ${audioState.isMasterMuted ? "is-muted" : ""}`}
              onClick={handleToggleMasterMute}
              title={audioState.isMasterMuted ? "Unmute All Audio" : "Mute All Audio"}
            >
              {audioState.isMasterMuted ? "Unmute All" : "Mute All"}
            </button>
          </div>

          {/* Autoplay Unlock Notice (if not yet unlocked) */}
          {!audioState.isUnlocked && (
            <div className="audio-unlock-banner">
              <p>Browser requires a gesture to start audio.</p>
              <button
                type="button"
                className="audio-unlock-btn"
                onClick={handleUnlockAudio}
              >
                Awaken Atmosphere 🔔
              </button>
            </div>
          )}

          {/* Current BGM Track Pill */}
          <div className="audio-track-info">
            <span className="audio-track-icon">{currentTrackMeta.icon}</span>
            <div className="audio-track-details">
              <div className="audio-track-title">{currentTrackMeta.title}</div>
              <div className="audio-track-sub">{currentTrackMeta.subtitle}</div>
            </div>
          </div>

          {/* BGM Volume Slider */}
          <div className="audio-section">
            <div className="audio-section-header">
              <span className="audio-section-label">Music (BGM)</span>
              <span className="audio-section-value">
                {audioState.isBgmMuted ? "Muted" : `${bgmPercent}%`}
              </span>
            </div>
            <div className="audio-slider-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={audioState.isBgmMuted ? 0 : audioState.bgmVolume}
                onChange={handleBgmVolumeChange}
                className="audio-slider"
                aria-label="Background Music Volume"
              />
              <button
                type="button"
                className={`audio-mute-toggle-btn ${audioState.isBgmMuted ? "is-muted" : ""}`}
                onClick={handleToggleBgmMute}
                title={audioState.isBgmMuted ? "Unmute Music" : "Mute Music"}
              >
                {audioState.isBgmMuted ? "🔇" : "🔊"}
              </button>
            </div>
          </div>

          {/* SFX Volume Slider */}
          <div className="audio-section">
            <div className="audio-section-header">
              <span className="audio-section-label">Sound Effects (SFX)</span>
              <span className="audio-section-value">
                {audioState.isSfxMuted ? "Muted" : `${sfxPercent}%`}
              </span>
            </div>
            <div className="audio-slider-row">
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={audioState.isSfxMuted ? 0 : audioState.sfxVolume}
                onChange={handleSfxVolumeChange}
                className="audio-slider"
                aria-label="Sound Effects Volume"
              />
              <button
                type="button"
                className={`audio-mute-toggle-btn ${audioState.isSfxMuted ? "is-muted" : ""}`}
                onClick={handleToggleSfxMute}
                title={audioState.isSfxMuted ? "Unmute SFX" : "Mute SFX"}
              >
                {audioState.isSfxMuted ? "🔇" : "🔔"}
              </button>
            </div>
          </div>

          {/* Quick SFX Test Grid */}
          <div className="audio-test-section">
            <div className="audio-test-title">Test Sound Effects</div>
            <div className="audio-test-grid">
              <button
                type="button"
                className="audio-test-chip"
                onClick={() => handleTestSfx(SFX_TYPES.WOLF_HOWL)}
                title="Wolf Howl (Night phase)"
              >
                🐺 Howl
              </button>
              <button
                type="button"
                className="audio-test-chip"
                onClick={() => handleTestSfx(SFX_TYPES.DEATH_BELL)}
                title="Gothic Death Bell (Elimination)"
              >
                🔔 Bell
              </button>
              <button
                type="button"
                className="audio-test-chip"
                onClick={() => handleTestSfx(SFX_TYPES.GAVEL_STRIKE)}
                title="Wooden Gavel (Voting)"
              >
                🔨 Gavel
              </button>
              <button
                type="button"
                className="audio-test-chip"
                onClick={() => handleTestSfx(SFX_TYPES.ROLE_REVEAL)}
                title="Mystic Shimmer (Role reveal)"
              >
                ✨ Reveal
              </button>
            </div>
          </div>

          <div className="audio-panel-footer">
            <span>Settings saved automatically</span>
          </div>
        </div>
      )}
    </div>
  );
}
