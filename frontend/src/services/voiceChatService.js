import { getSocket } from "./socket.js";
import { SOCKET_EVENTS, PHASES, PLAYER_STATUS, ROLES } from "../constants/index.js";

// WebRTC ICE Servers Configuration (Public STUN servers for peer discovery)
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

class VoiceChatService {
  constructor() {
    this.localStream = null;
    this.audioContext = null;
    this.analyserNode = null;
    this.micSourceNode = null;

    // socketId -> { peerConnection: RTCPeerConnection, remoteStream: MediaStream, gainNode: GainNode, pannerNode: StereoPannerNode, playerId: string }
    this.peers = new Map();

    this.isMuted = true; // Start muted by default for user comfort
    this.isDeafened = false;
    this.isSpatialEnabled = true;
    this.isSpeaking = false;
    this.roomCode = null;
    this.currentPlayerId = null;

    this.speakingListeners = new Set();
    this.stateListeners = new Set();
    this.speakingUsers = new Set(); // Set of playerIds currently speaking
    this.mutedUsers = new Set();    // Set of playerIds currently muted

    this.analyserInterval = null;
    this.isInitialized = false;
  }

  onStateChange(listener) {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onSpeakingChange(listener) {
    this.speakingListeners.add(listener);
    return () => this.speakingListeners.delete(listener);
  }

  notifyState() {
    const state = {
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      isSpatialEnabled: this.isSpatialEnabled,
      isSpeaking: this.isSpeaking,
      isConnected: Boolean(this.localStream),
      peersCount: this.peers.size,
      speakingUsers: Array.from(this.speakingUsers),
      mutedUsers: Array.from(this.mutedUsers),
    };
    this.stateListeners.forEach((l) => l(state));
  }

  notifySpeaking() {
    this.speakingListeners.forEach((l) => l(Array.from(this.speakingUsers)));
  }

  /**
   * Initialize microphone capture and join voice signaling room.
   */
  async joinVoice(roomCode, playerId) {
    this.roomCode = roomCode;
    this.currentPlayerId = playerId;

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      // Start tracks in muted state
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });

      // 2. Setup WebAudio API AudioContext & AnalyserNode for volume detection
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        if (this.audioContext.state === "suspended") {
          await this.audioContext.resume();
        }

        this.micSourceNode = this.audioContext.createMediaStreamSource(stream);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.micSourceNode.connect(this.analyserNode);

        this.startVoiceActivityDetection();
      }

      // 3. Register Socket.IO signaling listeners
      this.setupSignalingListeners();

      // 4. Emit voice:join to server
      const socket = getSocket();
      socket.emit(
        SOCKET_EVENTS.VOICE_JOIN,
        { roomCode, playerId },
        ({ success, peers, error }) => {
          if (!success) {
            console.warn("Failed to join voice room:", error);
            return;
          }

          // Initiate WebRTC peer connection with each existing peer in the room
          peers?.forEach((peer) => {
            this.createPeerConnection(peer.socketId, peer.playerId, true);
          });
        }
      );

      this.isInitialized = true;
      this.notifyState();
      return true;
    } catch (err) {
      console.warn("Microphone access unavailable or denied:", err.message);
      this.notifyState();
      return false;
    }
  }

  /**
   * Sets up Socket.IO voice signaling handlers.
   */
  setupSignalingListeners() {
    const socket = getSocket();

    // Another player joined voice -> create peer connection as receiver (wait for offer)
    socket.off(SOCKET_EVENTS.VOICE_PEER_JOINED);
    socket.on(SOCKET_EVENTS.VOICE_PEER_JOINED, ({ socketId, playerId }) => {
      this.createPeerConnection(socketId, playerId, false);
    });

    // Signaling message received (Offer, Answer, or ICE Candidate)
    socket.off(SOCKET_EVENTS.VOICE_SIGNAL);
    socket.on(SOCKET_EVENTS.VOICE_SIGNAL, async ({ from, signal }) => {
      await this.handleSignal(from, signal);
    });

    // Peer left voice
    socket.off(SOCKET_EVENTS.VOICE_PEER_LEFT);
    socket.on(SOCKET_EVENTS.VOICE_PEER_LEFT, ({ socketId, playerId }) => {
      this.removePeer(socketId);
      if (playerId) {
        this.speakingUsers.delete(playerId);
        this.mutedUsers.delete(playerId);
        this.notifySpeaking();
        this.notifyState();
      }
    });

    // Peer mute state changed
    socket.off(SOCKET_EVENTS.VOICE_MUTE_STATE);
    socket.on(SOCKET_EVENTS.VOICE_MUTE_STATE, ({ playerId, isMuted }) => {
      if (isMuted) {
        this.mutedUsers.add(playerId);
        this.speakingUsers.delete(playerId);
      } else {
        this.mutedUsers.delete(playerId);
      }
      this.notifySpeaking();
      this.notifyState();
    });

    // Peer speaking state changed
    socket.off(SOCKET_EVENTS.VOICE_SPEAKING_STATE);
    socket.on(SOCKET_EVENTS.VOICE_SPEAKING_STATE, ({ playerId, isSpeaking }) => {
      if (isSpeaking) {
        this.speakingUsers.add(playerId);
      } else {
        this.speakingUsers.delete(playerId);
      }
      this.notifySpeaking();
      this.notifyState();
    });
  }

  /**
   * Create RTCPeerConnection for a remote peer with spatial audio nodes.
   */
  createPeerConnection(targetSocketId, targetPlayerId, isInitiator) {
    if (this.peers.has(targetSocketId)) {
      return this.peers.get(targetSocketId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const socket = getSocket();

    // Add local mic audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Send local ICE candidates to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit(SOCKET_EVENTS.VOICE_SIGNAL, {
          to: targetSocketId,
          signal: { candidate: event.candidate },
        });
      }
    };

    let gainNode = null;
    let pannerNode = null;

    // When remote audio track arrives, connect through WebAudio pipeline
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (this.audioContext) {
        try {
          const source = this.audioContext.createMediaStreamSource(remoteStream);
          gainNode = this.audioContext.createGain();

          if (this.audioContext.createStereoPanner) {
            pannerNode = this.audioContext.createStereoPanner();
            source.connect(gainNode);
            gainNode.connect(pannerNode);
            pannerNode.connect(this.audioContext.destination);
          } else {
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
          }

          const peerData = this.peers.get(targetSocketId);
          if (peerData) {
            peerData.gainNode = gainNode;
            peerData.pannerNode = pannerNode;
            peerData.remoteStream = remoteStream;
          }
        } catch (e) {
          console.warn("Could not setup audio context pipeline for peer:", e);
        }
      }
    };

    const peerRecord = {
      peerConnection: pc,
      playerId: targetPlayerId,
      gainNode: null,
      pannerNode: null,
      remoteStream: null,
    };
    this.peers.set(targetSocketId, peerRecord);

    // If initiator, create and send SDP offer
    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit(SOCKET_EVENTS.VOICE_SIGNAL, {
            to: targetSocketId,
            signal: { sdp: pc.localDescription },
          });
        })
        .catch((err) => console.warn("Error creating offer:", err));
    }

    this.notifyState();
    return peerRecord;
  }

  /**
   * Handles incoming WebRTC signal from a peer.
   */
  async handleSignal(fromSocketId, signal) {
    let peerRecord = this.peers.get(fromSocketId);
    if (!peerRecord) {
      peerRecord = this.createPeerConnection(fromSocketId, null, false);
    }
    const pc = peerRecord.peerConnection;
    const socket = getSocket();

    try {
      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit(SOCKET_EVENTS.VOICE_SIGNAL, {
            to: fromSocketId,
            signal: { sdp: pc.localDescription },
          });
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.warn("Signal handling error:", err);
    }
  }

  /**
   * Voice Activity Detection (VAD) via AnalyserNode RMS calculation.
   */
  startVoiceActivityDetection() {
    if (this.analyserInterval) clearInterval(this.analyserInterval);

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.analyserInterval = setInterval(() => {
      if (this.isMuted || !this.localStream) {
        if (this.isSpeaking) {
          this.setSpeaking(false);
        }
        return;
      }

      this.analyserNode.getByteTimeDomainData(dataArray);

      // Compute Root Mean Square (RMS) volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      const SPEAKING_THRESHOLD = 0.035;
      const nowSpeaking = rms > SPEAKING_THRESHOLD;

      if (nowSpeaking !== this.isSpeaking) {
        this.setSpeaking(nowSpeaking);
      }
    }, 120);
  }

  setSpeaking(speaking) {
    this.isSpeaking = speaking;
    if (this.currentPlayerId) {
      if (speaking) {
        this.speakingUsers.add(this.currentPlayerId);
      } else {
        this.speakingUsers.delete(this.currentPlayerId);
      }
      this.notifySpeaking();
    }

    const socket = getSocket();
    if (socket && this.roomCode) {
      socket.emit(SOCKET_EVENTS.VOICE_SPEAKING, {
        roomCode: this.roomCode,
        isSpeaking: speaking,
      });
    }

    this.notifyState();
  }

  /**
   * Toggle local microphone mute.
   */
  toggleMute() {
    this.isMuted = !this.isMuted;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }

    if (this.isMuted && this.isSpeaking) {
      this.setSpeaking(false);
    }

    if (this.currentPlayerId) {
      if (this.isMuted) {
        this.mutedUsers.add(this.currentPlayerId);
      } else {
        this.mutedUsers.delete(this.currentPlayerId);
      }
    }

    const socket = getSocket();
    if (socket && this.roomCode) {
      socket.emit(SOCKET_EVENTS.VOICE_MUTE, {
        roomCode: this.roomCode,
        isMuted: this.isMuted,
      });
    }

    this.notifyState();
    return this.isMuted;
  }

  /**
   * Toggle deafen (mute incoming audio from all peers).
   */
  toggleDeafen() {
    this.isDeafened = !this.isDeafened;
    this.updateSpatialAudio();
    this.notifyState();
    return this.isDeafened;
  }

  /**
   * Toggle 3D spatial proximity attenuation.
   */
  toggleSpatial() {
    this.isSpatialEnabled = !this.isSpatialEnabled;
    this.updateSpatialAudio();
    this.notifyState();
    return this.isSpatialEnabled;
  }

  /**
   * Spatial & Proximity attenuation calculations.
   * Updates GainNode and StereoPannerNode based on table order and game rules.
   */
  updateSpatialAudio(players = [], currentUserId = null, phase = null, myRole = null) {
    if (!this.audioContext) return;

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    const meIndex = players.findIndex((p) => p.id === currentUserId);
    const totalPlayers = players.length;
    const mePlayer = players.find((p) => p.id === currentUserId);
    const meAlive = mePlayer ? mePlayer.status === PLAYER_STATUS.ALIVE : true;

    for (const [, peerData] of this.peers.entries()) {
      if (!peerData.gainNode) continue;

      if (this.isDeafened) {
        peerData.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        continue;
      }

      const peerPlayer = players.find((p) => p.id === peerData.playerId);
      const peerAlive = peerPlayer ? peerPlayer.status === PLAYER_STATUS.ALIVE : true;

      // 1. Elimination Mute Rule:
      // Living cannot hear ghosts!
      if (meAlive && !peerAlive) {
        peerData.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        continue;
      }

      // 2. Night Phase Rule:
      // The village sleeps in quiet darkness during night phases.
      if (phase === PHASES.NIGHT || phase === PHASES.NIGHT_1) {
        peerData.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        continue;
      }

      // 3. Spatial Table Distance Attenuation & Stereo Pan:
      let targetGain = 1.0;
      let targetPan = 0.0;

      if (this.isSpatialEnabled && meIndex !== -1 && totalPlayers > 1) {
        const peerIndex = players.findIndex((p) => p.id === peerData.playerId);
        if (peerIndex !== -1) {
          const diff = (peerIndex - meIndex + totalPlayers) % totalPlayers;
          const angle = (diff / totalPlayers) * 2 * Math.PI;

          // Stereo pan: left is negative, right is positive
          targetPan = Math.sin(angle) * 0.7;

          // Distance across table: 0 for direct neighbor up to 1.0 for opposite
          const distanceNorm = Math.sqrt((1 - Math.cos(angle)) ** 2 + Math.sin(angle) ** 2) / 2;
          // Gain scales gently from 1.0 down to 0.60
          targetGain = Math.max(0.60, 1.0 - distanceNorm * 0.40);
        }
      }

      peerData.gainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.1);
      if (peerData.pannerNode && peerData.pannerNode.pan) {
        peerData.pannerNode.pan.setTargetAtTime(targetPan, this.audioContext.currentTime, 0.1);
      }
    }
  }

  removePeer(socketId) {
    const peerData = this.peers.get(socketId);
    if (peerData) {
      peerData.peerConnection.close();
      this.peers.delete(socketId);
    }
  }

  leaveVoice() {
    if (this.analyserInterval) {
      clearInterval(this.analyserInterval);
      this.analyserInterval = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    for (const [socketId] of this.peers.entries()) {
      this.removePeer(socketId);
    }

    const socket = getSocket();
    if (socket && this.roomCode) {
      socket.emit(SOCKET_EVENTS.VOICE_LEAVE, { roomCode: this.roomCode });
    }

    this.speakingUsers.clear();
    this.mutedUsers.clear();
    this.isSpeaking = false;
    this.isInitialized = false;
    this.notifyState();
  }
}

export const voiceChatService = new VoiceChatService();
