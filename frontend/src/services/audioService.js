/**
 * Gothic Tabletop Audio & Atmosphere Service
 * 
 * Provides procedural Web Audio API synthesis for background music (BGM)
 * and sound effects (SFX), with independent volume control, mute toggles,
 * smooth crossfading, and persistent player preferences.
 * 
 * Zero external asset dependencies - works 100% offline and low-latency.
 */

const STORAGE_KEY = "werewolf_audio_preferences";

export const SFX_TYPES = Object.freeze({
  WOLF_HOWL: "wolf_howl",
  DEATH_BELL: "death_bell",
  GAVEL_STRIKE: "gavel_strike",
  ROLE_REVEAL: "role_reveal",
  MORNING_DAWN: "morning_dawn",
  NIGHT_FALLS: "night_falls",
  GAME_START: "game_start",
  POTION: "potion",
  ACTION_SUBMIT: "action_submit",
  VOTE: "vote",
  BUTTON_CLICK: "button_click",
});

export const BGM_TRACKS = Object.freeze({
  LOBBY: "lobby",
  NIGHT: "night",
  DAY_DISCUSSION: "day_discussion",
  DAY_VOTING: "day_voting",
  GAME_OVER: "game_over",
  SILENT: "silent",
});

export const TRACK_INFO = Object.freeze({
  [BGM_TRACKS.LOBBY]: {
    id: BGM_TRACKS.LOBBY,
    title: "Twilight Village",
    subtitle: "Medieval tavern & quiet anticipation",
    icon: "🏰",
  },
  [BGM_TRACKS.NIGHT]: {
    id: BGM_TRACKS.NIGHT,
    title: "The Blood Moon",
    subtitle: "Heartbeat pulse, howling wind & shadows",
    icon: "🐺",
  },
  [BGM_TRACKS.DAY_DISCUSSION]: {
    id: BGM_TRACKS.DAY_DISCUSSION,
    title: "Village Council",
    subtitle: "Pendulum tick & investigative inquiry",
    icon: "📜",
  },
  [BGM_TRACKS.DAY_VOTING]: {
    id: BGM_TRACKS.DAY_VOTING,
    title: "The Gallows Trial",
    subtitle: "Rising tension & accelerated heartbeat",
    icon: "⚖️",
  },
  [BGM_TRACKS.GAME_OVER]: {
    id: BGM_TRACKS.GAME_OVER,
    title: "Gothic Requiem",
    subtitle: "Cathedral toll & solemn verdict",
    icon: "⚰️",
  },
  [BGM_TRACKS.SILENT]: {
    id: BGM_TRACKS.SILENT,
    title: "Silence",
    subtitle: "Audio muted",
    icon: "🔇",
  },
});

class AudioService {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.reverbNode = null;

    // Load persisted preferences or use defaults
    const saved = this.loadPreferences();
    this.state = {
      bgmVolume: saved.bgmVolume ?? 0.35,
      sfxVolume: saved.sfxVolume ?? 0.65,
      isBgmMuted: saved.isBgmMuted ?? false,
      isSfxMuted: saved.isSfxMuted ?? false,
      isMasterMuted: saved.isMasterMuted ?? false,
      currentTrack: BGM_TRACKS.LOBBY,
      isPlaying: false,
      isUnlocked: false,
    };

    this.listeners = new Set();
    this.activeBgmProcess = null;
    this.bgmTrackGain = null; // internal track crossfade gain

    // Auto-unlock on first user interaction anywhere on the window
    this.setupUnlockListeners();
  }

  /* ========================================================================
   * Initialization & Web Audio Unlock
   * ======================================================================== */

  setupUnlockListeners() {
    if (typeof window === "undefined") return;

    const unlockHandler = () => {
      this.unlockAudioContext();
      window.removeEventListener("click", unlockHandler);
      window.removeEventListener("touchstart", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
    };

    window.addEventListener("click", unlockHandler, { passive: true });
    window.addEventListener("touchstart", unlockHandler, { passive: true });
    window.addEventListener("keydown", unlockHandler, { passive: true });
  }

  ensureContext() {
    if (typeof window === "undefined") return false;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        console.warn("[AudioService] Web Audio API is not supported in this environment");
        return false;
      }
      this.ctx = new AudioCtx();

      // Master Gain -> Destination
      this.masterGain = this.ctx.createGain();
      this.updateMasterGain();
      this.masterGain.connect(this.ctx.destination);

      // BGM Gain -> Master Gain
      this.bgmGain = this.ctx.createGain();
      this.updateBgmGain();
      this.bgmGain.connect(this.masterGain);

      // SFX Gain -> Master Gain
      this.sfxGain = this.ctx.createGain();
      this.updateSfxGain();
      this.sfxGain.connect(this.masterGain);

      // Synthetic Reverb / Delay Bus for gothic atmosphere
      this.reverbNode = this.createSyntheticReverb(this.ctx);
      this.reverbNode.output.connect(this.masterGain);
    }

    return true;
  }

  async unlockAudioContext() {
    if (!this.ensureContext()) return false;

    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn("[AudioService] Context resume failed:", err);
      }
    }

    if (!this.state.isUnlocked) {
      this.state.isUnlocked = true;
      this.emitState();

      // Start pending BGM if configured
      if (!this.state.isMasterMuted && !this.state.isBgmMuted && this.state.currentTrack) {
        this.playBgm(this.state.currentTrack);
      }
    }

    return true;
  }

  createSyntheticReverb(ctx) {
    // Lightweight cathedral delay-reverb feedback network
    const input = ctx.createGain();
    input.gain.value = 0.35;

    const delay = ctx.createDelay();
    delay.delayTime.value = 0.32;

    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;

    const output = ctx.createGain();
    output.gain.value = 0.4;

    input.connect(delay);
    delay.connect(filter);
    filter.connect(feedback);
    feedback.connect(delay);
    filter.connect(output);

    return { input, output };
  }

  /* ========================================================================
   * State Management & Persistence
   * ======================================================================== */

  loadPreferences() {
    if (typeof localStorage === "undefined") return {};
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  savePreferences() {
    if (typeof localStorage === "undefined") return;
    try {
      const payload = {
        bgmVolume: this.state.bgmVolume,
        sfxVolume: this.state.sfxVolume,
        isBgmMuted: this.state.isBgmMuted,
        isSfxMuted: this.state.isSfxMuted,
        isMasterMuted: this.state.isMasterMuted,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }

  getState() {
    return { ...this.state };
  }

  onStateChange(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  emitState() {
    const s = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(s);
      } catch (e) {
        console.error("[AudioService] Listener error:", e);
      }
    });
  }

  /* ========================================================================
   * Volume & Mute Controls
   * ======================================================================== */

  updateMasterGain() {
    if (!this.masterGain || !this.ctx) return;
    const vol = this.state.isMasterMuted ? 0 : 1;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  updateBgmGain() {
    if (!this.bgmGain || !this.ctx) return;
    const vol = this.state.isBgmMuted ? 0 : this.state.bgmVolume;
    this.bgmGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  updateSfxGain() {
    if (!this.sfxGain || !this.ctx) return;
    const vol = this.state.isSfxMuted ? 0 : this.state.sfxVolume;
    this.sfxGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
  }

  setBgmVolume(val) {
    const clamped = Math.max(0, Math.min(1, Number(val) || 0));
    this.state.bgmVolume = clamped;
    this.state.isBgmMuted = false;
    this.updateBgmGain();
    this.savePreferences();
    this.emitState();
  }

  setSfxVolume(val) {
    const clamped = Math.max(0, Math.min(1, Number(val) || 0));
    this.state.sfxVolume = clamped;
    this.state.isSfxMuted = false;
    this.updateSfxGain();
    this.savePreferences();
    this.emitState();
  }

  toggleBgmMute() {
    this.state.isBgmMuted = !this.state.isBgmMuted;
    this.updateBgmGain();
    this.savePreferences();
    this.emitState();
  }

  toggleSfxMute() {
    this.state.isSfxMuted = !this.state.isSfxMuted;
    this.updateSfxGain();
    this.savePreferences();
    this.emitState();
  }

  toggleMasterMute() {
    this.state.isMasterMuted = !this.state.isMasterMuted;
    this.updateMasterGain();
    this.savePreferences();
    this.emitState();
  }

  /* ========================================================================
   * Sound Effects (SFX) Synthesizer
   * ======================================================================== */

  playSfx(type) {
    if (this.state.isMasterMuted || this.state.isSfxMuted || this.state.sfxVolume <= 0.001) {
      return;
    }
    if (!this.ensureContext()) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    try {
      switch (type) {
        case SFX_TYPES.WOLF_HOWL:
          this.synthWolfHowl();
          break;
        case SFX_TYPES.DEATH_BELL:
          this.synthDeathBell();
          break;
        case SFX_TYPES.GAVEL_STRIKE:
          this.synthGavelStrike();
          break;
        case SFX_TYPES.ROLE_REVEAL:
          this.synthRoleReveal();
          break;
        case SFX_TYPES.MORNING_DAWN:
          this.synthMorningDawn();
          break;
        case SFX_TYPES.NIGHT_FALLS:
          this.synthNightFalls();
          break;
        case SFX_TYPES.GAME_START:
          this.synthGameStart();
          break;
        case SFX_TYPES.POTION:
          this.synthPotion();
          break;
        case SFX_TYPES.ACTION_SUBMIT:
          this.synthActionSubmit();
          break;
        case SFX_TYPES.VOTE:
          this.synthVote();
          break;
        case SFX_TYPES.BUTTON_CLICK:
          this.synthButtonClick();
          break;
        default:
          this.synthButtonClick();
      }
    } catch (err) {
      console.warn("[AudioService] Failed to synthesize SFX:", type, err);
    }
  }

  /**
   * Wolf Howl: Atmospheric pitch-gliding dual oscillator with formant resonance and vibrato.
   */
  synthWolfHowl() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 3.4;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sawtooth";

    // Pitch sweep: 180Hz -> 430Hz peak -> 405Hz sustain -> 250Hz descent
    osc1.frequency.setValueAtTime(190, now);
    osc1.frequency.exponentialRampToValueAtTime(430, now + 0.9);
    osc1.frequency.setValueAtTime(410, now + 1.8);
    osc1.frequency.exponentialRampToValueAtTime(260, now + duration);

    osc2.frequency.setValueAtTime(192, now);
    osc2.frequency.exponentialRampToValueAtTime(433, now + 0.9);
    osc2.frequency.setValueAtTime(413, now + 1.8);
    osc2.frequency.exponentialRampToValueAtTime(262, now + duration);

    // Vibrato LFO
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(5.4, now);
    lfoGain.gain.setValueAtTime(14, now);
    lfo.connect(osc1.frequency);
    lfo.connect(osc2.frequency);

    // Formant vocal filter
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(850, now + 0.9);
    filter.frequency.exponentialRampToValueAtTime(450, now + duration);
    filter.Q.value = 4.2;

    // Amplitude envelope
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.5);
    gain.gain.setValueAtTime(0.35, now + 1.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    if (this.reverbNode) {
      gain.connect(this.reverbNode.input);
    }

    lfo.start(now);
    osc1.start(now);
    osc2.start(now);
    lfo.stop(now + duration);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  /**
   * Gothic Death Bell / Bronze Gong: Inharmonic modal additive synthesis.
   */
  synthDeathBell() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const fund = 110; // A2 bronze bell tone
    const partials = [
      { ratio: 1.0, gain: 0.6, decay: 4.2 },
      { ratio: 2.0, gain: 0.35, decay: 3.5 },
      { ratio: 2.76, gain: 0.45, decay: 2.8 }, // Tierce (minor 3rd)
      { ratio: 5.4, gain: 0.3, decay: 1.8 },   // Quint
      { ratio: 8.93, gain: 0.25, decay: 1.2 },  // Nominal
      { ratio: 11.2, gain: 0.15, decay: 0.7 },
    ];

    partials.forEach((p, idx) => {
      const osc = ctx.createOscillator();
      const pGain = ctx.createGain();

      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      // Slight detune for metallic chorus beating
      const detuneOffset = (idx % 2 === 0 ? 1 : -1) * 0.8;
      osc.frequency.setValueAtTime(fund * p.ratio + detuneOffset, now);

      pGain.gain.setValueAtTime(p.gain * 0.4, now);
      pGain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(pGain);
      pGain.connect(this.sfxGain);

      if (this.reverbNode) {
        pGain.connect(this.reverbNode.input);
      }

      osc.start(now);
      osc.stop(now + p.decay);
    });

    // Sharp strike transient noise
    this.playNoiseTransient(now, 0.03, 900, 0.25);
  }

  /**
   * Gavel Strike: Wood impact with rapid pitch envelope and hollow body resonance.
   */
  synthGavelStrike() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Pitch drop thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);

    // Wood body bandpass resonance
    const woodOsc = ctx.createOscillator();
    const woodGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    woodOsc.type = "triangle";
    woodOsc.frequency.setValueAtTime(175, now);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(175, now);
    filter.Q.value = 6;

    woodGain.gain.setValueAtTime(0.5, now);
    woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    woodOsc.connect(filter);
    filter.connect(woodGain);
    woodGain.connect(this.sfxGain);

    woodOsc.start(now);
    woodOsc.stop(now + 0.18);

    // Click attack
    this.playNoiseTransient(now, 0.015, 1600, 0.35);
  }

  /**
   * Role Reveal: Celestial glass chime arpeggio cascade.
   */
  synthRoleReveal() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = [880, 1108.7, 1318.5, 1760, 2217.5]; // A5, C#6, E6, A6, C#7

    notes.forEach((freq, i) => {
      const noteTime = now + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      if (this.reverbNode) {
        gain.connect(this.reverbNode.input);
      }

      osc.start(noteTime);
      osc.stop(noteTime + 1.2);
    });
  }

  /**
   * Morning Dawn: Bright harmonious twin village bells.
   */
  synthMorningDawn() {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bells = [
      { time: now, freq: 523.25, decay: 2.2 },       // C5
      { time: now + 0.35, freq: 783.99, decay: 2.5 }, // G5
      { time: now + 0.75, freq: 1046.5, decay: 2.0 }, // C6
    ];

    bells.forEach((b) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(b.freq, b.time);

      gain.gain.setValueAtTime(0.35, b.time);
      gain.gain.exponentialRampToValueAtTime(0.0001, b.time + b.decay);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      if (this.reverbNode) {
        gain.connect(this.reverbNode.input);
      }

      osc.start(b.time);
      osc.stop(b.time + b.decay);
    });
  }

  /**
   * Night Falls: Deep descending occult pitch rumble with cold wind rush.
   */
  synthNightFalls() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 1.6);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.linearRampToValueAtTime(80, now + 2.0);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 2.2);

    // Wind gust
    this.playNoiseTransient(now, 1.8, 450, 0.25);
  }

  /**
   * Game Start: Resonant ceremonial horn / bronze strike.
   */
  synthGameStart() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = "sawtooth";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(146.8, now); // D3
    osc2.frequency.setValueAtTime(220.0, now); // A3

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.4);
    filter.frequency.exponentialRampToValueAtTime(300, now + 2.5);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    if (this.reverbNode) {
      gain.connect(this.reverbNode.input);
    }

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.6);
    osc2.stop(now + 2.6);
  }

  /**
   * Witch Potion: Bubbling magical elixir swirl.
   */
  synthPotion() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const bubbleTime = now + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const startF = 350 + i * 90;
      osc.frequency.setValueAtTime(startF, bubbleTime);
      osc.frequency.exponentialRampToValueAtTime(startF * 1.8, bubbleTime + 0.14);

      gain.gain.setValueAtTime(0.2, bubbleTime);
      gain.gain.exponentialRampToValueAtTime(0.001, bubbleTime + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(bubbleTime);
      osc.stop(bubbleTime + 0.15);
    }
  }

  /**
   * Action Submit: Subtle occult whisper / deep pulse.
   */
  synthActionSubmit() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Vote Counter Placement Tap
   */
  synthVote() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.06);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Button Click
   */
  synthButtonClick() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Helper: White noise transient generator
   */
  playNoiseTransient(startTime, duration, filterFreq, volume) {
    const ctx = this.ctx;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  /* ========================================================================
   * Background Music (BGM) Atmospheric Engine
   * ======================================================================== */

  playBgm(trackId) {
    if (!trackId || trackId === BGM_TRACKS.SILENT) {
      this.stopBgm();
      return;
    }

    // If already playing this track, don't restart
    if (this.state.currentTrack === trackId && this.activeBgmProcess) {
      return;
    }

    this.state.currentTrack = trackId;
    this.emitState();

    if (!this.ensureContext()) return;
    if (this.ctx.state === "suspended") {
      // Will auto-start once unlocked
      return;
    }

    // Stop current track with crossfade
    this.transitionToTrack(trackId);
  }

  stopBgm() {
    this.state.currentTrack = BGM_TRACKS.SILENT;
    this.state.isPlaying = false;
    this.emitState();

    if (this.bgmTrackGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.bgmTrackGain.gain.linearRampToValueAtTime(0.001, now + 0.8);
      setTimeout(() => {
        if (this.activeBgmProcess) {
          this.activeBgmProcess.stop();
          this.activeBgmProcess = null;
        }
      }, 850);
    } else if (this.activeBgmProcess) {
      this.activeBgmProcess.stop();
      this.activeBgmProcess = null;
    }
  }

  transitionToTrack(trackId) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const fadeTime = 1.0;

    // Fade out previous track
    if (this.bgmTrackGain) {
      this.bgmTrackGain.gain.linearRampToValueAtTime(0.001, now + fadeTime);
      const oldProcess = this.activeBgmProcess;
      setTimeout(() => {
        if (oldProcess) oldProcess.stop();
      }, fadeTime * 1000 + 50);
    }

    // Create new track gain node for crossfade
    const newTrackGain = ctx.createGain();
    newTrackGain.gain.setValueAtTime(0.001, now);
    newTrackGain.gain.linearRampToValueAtTime(1.0, now + fadeTime);
    newTrackGain.connect(this.bgmGain);

    this.bgmTrackGain = newTrackGain;
    this.state.isPlaying = true;

    // Start appropriate procedural generator
    switch (trackId) {
      case BGM_TRACKS.NIGHT:
        this.activeBgmProcess = this.startNightAmbient(newTrackGain);
        break;
      case BGM_TRACKS.DAY_DISCUSSION:
        this.activeBgmProcess = this.startDiscussionAmbient(newTrackGain);
        break;
      case BGM_TRACKS.DAY_VOTING:
        this.activeBgmProcess = this.startVotingAmbient(newTrackGain);
        break;
      case BGM_TRACKS.GAME_OVER:
        this.activeBgmProcess = this.startGameOverAmbient(newTrackGain);
        break;
      case BGM_TRACKS.LOBBY:
      default:
        this.activeBgmProcess = this.startLobbyAmbient(newTrackGain);
        break;
    }

    this.emitState();
  }

  /**
   * BGM 1: Lobby / Village Twilight
   * Warm minor chord pad, gentle plucked harp notes, cozy atmosphere.
   */
  startLobbyAmbient(outputGain) {
    const ctx = this.ctx;
    const nodes = [];
    let isRunning = true;
    let timerId = null;

    // Drone chord (Dm: D2 + A2)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const padGain = ctx.createGain();
    const padFilter = ctx.createBiquadFilter();

    osc1.type = "triangle";
    osc2.type = "sine";
    osc1.frequency.value = 73.42; // D2
    osc2.frequency.value = 110.0;  // A2

    padFilter.type = "lowpass";
    padFilter.frequency.value = 350;
    padGain.gain.value = 0.28;

    osc1.connect(padFilter);
    osc2.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(outputGain);

    osc1.start();
    osc2.start();
    nodes.push(osc1, osc2);

    // Random gentle harp pluck (D minor pentatonic notes: D3, F3, G3, A3, C4, D4)
    const scale = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66];
    const playHarpNote = () => {
      if (!isRunning) return;
      const now = ctx.currentTime;
      const freq = scale[Math.floor(Math.random() * scale.length)];

      const hOsc = ctx.createOscillator();
      const hGain = ctx.createGain();
      hOsc.type = "sine";
      hOsc.frequency.setValueAtTime(freq, now);

      hGain.gain.setValueAtTime(0.001, now);
      hGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      hGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      hOsc.connect(hGain);
      hGain.connect(outputGain);

      if (this.reverbNode) {
        hGain.connect(this.reverbNode.input);
      }

      hOsc.start(now);
      hOsc.stop(now + 2.8);

      const nextDelay = 2200 + Math.random() * 2800;
      timerId = setTimeout(playHarpNote, nextDelay);
    };

    timerId = setTimeout(playHarpNote, 1500);

    return {
      stop: () => {
        isRunning = false;
        if (timerId) clearTimeout(timerId);
        nodes.forEach((n) => {
          try { n.stop(); } catch {}
        });
      },
    };
  }

  /**
   * BGM 2: Night / The Blood Moon
   * Ominous sub-bass drone, rhythmic heartbeat pulse (54 BPM), cold howling wind.
   */
  startNightAmbient(outputGain) {
    const ctx = this.ctx;
    const nodes = [];
    let isRunning = true;
    let heartbeatTimer = null;

    // Sub-bass drone (C1 + C2 + F#2 tritone)
    const subOsc = ctx.createOscillator();
    const triOsc = ctx.createOscillator();
    const tritoneOsc = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = ctx.createBiquadFilter();

    subOsc.type = "sine";
    subOsc.frequency.value = 32.7; // C1
    triOsc.type = "triangle";
    triOsc.frequency.value = 65.41; // C2
    tritoneOsc.type = "sine";
    tritoneOsc.frequency.value = 92.5; // F#2 tension tritone

    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 110;
    droneGain.gain.value = 0.35;

    subOsc.connect(droneFilter);
    triOsc.connect(droneFilter);
    tritoneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(outputGain);

    subOsc.start();
    triOsc.start();
    tritoneOsc.start();
    nodes.push(subOsc, triOsc, tritoneOsc);

    // Heartbeat Pulse Generator: Lub-Dub every 1.15s (52 BPM)
    const playHeartbeat = () => {
      if (!isRunning) return;
      const now = ctx.currentTime;

      // Lub thump
      const lubOsc = ctx.createOscillator();
      const lubGain = ctx.createGain();
      lubOsc.type = "sine";
      lubOsc.frequency.setValueAtTime(56, now);
      lubOsc.frequency.exponentialRampToValueAtTime(34, now + 0.08);

      lubGain.gain.setValueAtTime(0.38, now);
      lubGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      lubOsc.connect(lubGain);
      lubGain.connect(outputGain);
      lubOsc.start(now);
      lubOsc.stop(now + 0.15);

      // Dub thump (150ms later)
      const dubOsc = ctx.createOscillator();
      const dubGain = ctx.createGain();
      dubOsc.type = "sine";
      dubOsc.frequency.setValueAtTime(48, now + 0.15);
      dubOsc.frequency.exponentialRampToValueAtTime(28, now + 0.22);

      dubGain.gain.setValueAtTime(0.24, now + 0.15);
      dubGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      dubOsc.connect(dubGain);
      dubGain.connect(outputGain);
      dubOsc.start(now + 0.15);
      dubOsc.stop(now + 0.28);

      heartbeatTimer = setTimeout(playHeartbeat, 1150);
    };

    heartbeatTimer = setTimeout(playHeartbeat, 800);

    return {
      stop: () => {
        isRunning = false;
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        nodes.forEach((n) => {
          try { n.stop(); } catch {}
        });
      },
    };
  }

  /**
   * BGM 3: Day Discussion / Village Council
   * Clock pendulum tick rhythm, inquisitive investigative minor pad.
   */
  startDiscussionAmbient(outputGain) {
    const ctx = this.ctx;
    const nodes = [];
    let isRunning = true;
    let tickTimer = null;

    // Investigative Drone (Am: A2 + E3)
    const padOsc = ctx.createOscillator();
    const padFilter = ctx.createBiquadFilter();
    const padGain = ctx.createGain();

    padOsc.type = "triangle";
    padOsc.frequency.value = 110.0; // A2
    padFilter.type = "lowpass";
    padFilter.frequency.value = 280;
    padGain.gain.value = 0.22;

    padOsc.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(outputGain);

    padOsc.start();
    nodes.push(padOsc);

    // Clock Pendulum Tick every 1.0s
    let tickTock = false;
    const playTick = () => {
      if (!isRunning) return;
      const now = ctx.currentTime;
      tickTock = !tickTock;

      const tOsc = ctx.createOscillator();
      const tGain = ctx.createGain();
      tOsc.type = "sine";
      tOsc.frequency.setValueAtTime(tickTock ? 780 : 640, now);

      tGain.gain.setValueAtTime(0.06, now);
      tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      tOsc.connect(tGain);
      tGain.connect(outputGain);

      tOsc.start(now);
      tOsc.stop(now + 0.04);

      tickTimer = setTimeout(playTick, 1000);
    };

    tickTimer = setTimeout(playTick, 500);

    return {
      stop: () => {
        isRunning = false;
        if (tickTimer) clearTimeout(tickTimer);
        nodes.forEach((n) => {
          try { n.stop(); } catch {}
        });
      },
    };
  }

  /**
   * BGM 4: Day Voting / The Gallows Trial
   * Fast heartbeat pulse (~86 BPM), double-time suspense ticks, rising drone.
   */
  startVotingAmbient(outputGain) {
    const ctx = this.ctx;
    const nodes = [];
    let isRunning = true;
    let pulseTimer = null;

    // Rising tension drone
    const droneOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    droneOsc.type = "sawtooth";
    droneOsc.frequency.value = 55.0; // A1
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(320, ctx.currentTime + 30);
    gain.gain.value = 0.26;

    droneOsc.connect(filter);
    filter.connect(gain);
    gain.connect(outputGain);

    droneOsc.start();
    nodes.push(droneOsc);

    // Fast Heartbeat (700ms period = ~86 BPM)
    const playFastHeartbeat = () => {
      if (!isRunning) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const pGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(64, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.08);

      pGain.gain.setValueAtTime(0.35, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(pGain);
      pGain.connect(outputGain);

      osc.start(now);
      osc.stop(now + 0.12);

      pulseTimer = setTimeout(playFastHeartbeat, 700);
    };

    pulseTimer = setTimeout(playFastHeartbeat, 400);

    return {
      stop: () => {
        isRunning = false;
        if (pulseTimer) clearTimeout(pulseTimer);
        nodes.forEach((n) => {
          try { n.stop(); } catch {}
        });
      },
    };
  }

  /**
   * BGM 5: Game Over / Gothic Requiem
   * Cathedral chords and distant funeral chimes.
   */
  startGameOverAmbient(outputGain) {
    const ctx = this.ctx;
    const nodes = [];
    let isRunning = true;
    let bellTimer = null;

    // Solemn Cathedral Chord (C minor: C2 + G2 + Eb3)
    const notes = [65.41, 98.0, 155.56];
    notes.forEach((freq) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.value = freq;
      filter.type = "lowpass";
      filter.frequency.value = 320;
      gain.gain.value = 0.18;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(outputGain);

      osc.start();
      nodes.push(osc);
    });

    // Slow distant funeral bell toll every 6 seconds
    const playToll = () => {
      if (!isRunning) return;
      const now = ctx.currentTime;
      const bellOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();

      bellOsc.type = "sine";
      bellOsc.frequency.setValueAtTime(130.8, now); // C3

      bellGain.gain.setValueAtTime(0.2, now);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

      bellOsc.connect(bellGain);
      bellGain.connect(outputGain);

      if (this.reverbNode) {
        bellGain.connect(this.reverbNode.input);
      }

      bellOsc.start(now);
      bellOsc.stop(now + 4.5);

      bellTimer = setTimeout(playToll, 6000);
    };

    bellTimer = setTimeout(playToll, 1200);

    return {
      stop: () => {
        isRunning = false;
        if (bellTimer) clearTimeout(bellTimer);
        nodes.forEach((n) => {
          try { n.stop(); } catch {}
        });
      },
    };
  }

  /**
   * Helper to map game phase to BGM track
   */
  playBgmForPhase(phase) {
    switch (phase) {
      case "NIGHT_1":
      case "NIGHT":
      case "NIGHT_RESOLUTION":
        this.playBgm(BGM_TRACKS.NIGHT);
        break;
      case "DAY_DISCUSSION":
        this.playBgm(BGM_TRACKS.DAY_DISCUSSION);
        break;
      case "DAY_VOTING":
        this.playBgm(BGM_TRACKS.DAY_VOTING);
        break;
      case "GAME_OVER":
        this.playBgm(BGM_TRACKS.GAME_OVER);
        break;
      case "ROLE_DISTRIBUTION":
      case "ROLE_REVEAL":
        // Keep Night or Lobby playing smoothly
        this.playBgm(BGM_TRACKS.NIGHT);
        break;
      case "LOBBY":
      default:
        this.playBgm(BGM_TRACKS.LOBBY);
        break;
    }
  }
}

export const audioService = new AudioService();
