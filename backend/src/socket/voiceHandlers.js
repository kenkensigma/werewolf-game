const { SOCKET_EVENTS } = require("../constants/index.js");

// roomCode -> Map<socketId, { playerId, isMuted, isSpeaking }>
const voiceRooms = new Map();

function registerVoiceHandlers(io, socket) {
  // 1. Join Voice Channel
  socket.on(SOCKET_EVENTS.VOICE_JOIN, ({ roomCode, playerId }, callback) => {
    try {
      if (!roomCode || !playerId) {
        throw new Error("Room code and player ID are required to join voice");
      }

      const cleanCode = roomCode.toUpperCase().trim();
      const channelName = `voice:${cleanCode}`;

      socket.join(channelName);

      if (!voiceRooms.has(cleanCode)) {
        voiceRooms.set(cleanCode, new Map());
      }
      const roomPeers = voiceRooms.get(cleanCode);

      // List existing peers in the voice channel before adding self
      const existingPeers = Array.from(roomPeers.entries())
        .filter(([sid]) => sid !== socket.id)
        .map(([sid, info]) => ({
          socketId: sid,
          playerId: info.playerId,
          isMuted: info.isMuted,
          isSpeaking: info.isSpeaking,
        }));

      // Register this socket
      roomPeers.set(socket.id, {
        playerId,
        isMuted: false,
        isSpeaking: false,
      });

      // Announce to other peers that a new user joined voice
      socket.to(channelName).emit(SOCKET_EVENTS.VOICE_PEER_JOINED, {
        socketId: socket.id,
        playerId,
      });

      if (typeof callback === "function") {
        callback({
          success: true,
          peers: existingPeers,
        });
      }
    } catch (err) {
      if (typeof callback === "function") {
        callback({ success: false, error: err.message });
      }
    }
  });

  // 2. WebRTC Peer Signaling Relay (Offer, Answer, ICE Candidate)
  socket.on(SOCKET_EVENTS.VOICE_SIGNAL, ({ to, signal }) => {
    if (!to || !signal) return;
    io.to(to).emit(SOCKET_EVENTS.VOICE_SIGNAL, {
      from: socket.id,
      signal,
    });
  });

  // 3. Mute / Unmute State Relay
  socket.on(SOCKET_EVENTS.VOICE_MUTE, ({ roomCode, isMuted }) => {
    if (!roomCode) return;
    const cleanCode = roomCode.toUpperCase().trim();
    const roomPeers = voiceRooms.get(cleanCode);
    if (roomPeers && roomPeers.has(socket.id)) {
      roomPeers.get(socket.id).isMuted = Boolean(isMuted);
      const playerId = roomPeers.get(socket.id).playerId;
      io.to(`voice:${cleanCode}`).emit(SOCKET_EVENTS.VOICE_MUTE_STATE, {
        socketId: socket.id,
        playerId,
        isMuted: Boolean(isMuted),
      });
    }
  });

  // 4. Speaking Indicator State Relay
  socket.on(SOCKET_EVENTS.VOICE_SPEAKING, ({ roomCode, isSpeaking }) => {
    if (!roomCode) return;
    const cleanCode = roomCode.toUpperCase().trim();
    const roomPeers = voiceRooms.get(cleanCode);
    if (roomPeers && roomPeers.has(socket.id)) {
      roomPeers.get(socket.id).isSpeaking = Boolean(isSpeaking);
      const playerId = roomPeers.get(socket.id).playerId;
      io.to(`voice:${cleanCode}`).emit(SOCKET_EVENTS.VOICE_SPEAKING_STATE, {
        socketId: socket.id,
        playerId,
        isSpeaking: Boolean(isSpeaking),
      });
    }
  });

  // 5. Leave Voice Channel
  socket.on(SOCKET_EVENTS.VOICE_LEAVE, ({ roomCode }, callback) => {
    cleanupSocketVoice(io, socket, roomCode);
    if (typeof callback === "function") {
      callback({ success: true });
    }
  });

  // 6. Cleanup Voice on Disconnect
  socket.on("disconnect", () => {
    cleanupSocketVoice(io, socket);
  });
}

function cleanupSocketVoice(io, socket, targetRoomCode = null) {
  for (const [roomCode, roomPeers] of voiceRooms.entries()) {
    if (targetRoomCode && roomCode !== targetRoomCode.toUpperCase().trim()) {
      continue;
    }

    if (roomPeers.has(socket.id)) {
      const { playerId } = roomPeers.get(socket.id);
      roomPeers.delete(socket.id);

      socket.leave(`voice:${roomCode}`);

      io.to(`voice:${roomCode}`).emit(SOCKET_EVENTS.VOICE_PEER_LEFT, {
        socketId: socket.id,
        playerId,
      });

      if (roomPeers.size === 0) {
        voiceRooms.delete(roomCode);
      }
    }
  }
}

module.exports = {
  registerVoiceHandlers,
};
