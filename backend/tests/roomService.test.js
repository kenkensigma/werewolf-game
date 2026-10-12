import { describe, it, expect, beforeEach } from "vitest";
const { RoomService } = require("../src/services/roomService.js");

describe("RoomService Unit Tests", () => {
  let roomService;

  beforeEach(() => {
    roomService = new RoomService();
  });

  it("should create a room with unique code and set creator as host", () => {
    const result = roomService.createRoom("Alice", "socket-1");
    expect(result.room).toBeDefined();
    expect(result.room.roomCode).toHaveLength(6);
    expect(result.room.players).toHaveLength(1);
    expect(result.room.players[0].displayName).toBe("Alice");
    expect(result.room.players[0].isHost).toBe(true);
    expect(result.room.hostId).toBe(result.player.id);
    expect(result.sessionToken).toBeDefined();
  });

  it("should allow players to join an existing lobby", () => {
    const { room: createdRoom } = roomService.createRoom("Alice", "socket-1");
    const joinResult = roomService.joinRoom(createdRoom.roomCode, "Bob", "socket-2");

    expect(joinResult.room.players).toHaveLength(2);
    expect(joinResult.player.displayName).toBe("Bob");
    expect(joinResult.player.isHost).toBe(false);
  });

  it("should reject joining with an invalid room code", () => {
    expect(() => {
      roomService.joinRoom("ZZZZZZ", "Charlie", "socket-3");
    }).toThrow(/not found/i);
  });

  it("should prevent duplicate display names in the same room", () => {
    const { room: createdRoom } = roomService.createRoom("Alice", "socket-1");
    expect(() => {
      roomService.joinRoom(createdRoom.roomCode, "Alice", "socket-2");
    }).toThrow(/already in this room/i);
  });

  it("should allow host to configure room settings and reject non-host", () => {
    const { room: createdRoom, player: hostPlayer } = roomService.createRoom("Alice", "socket-1");
    const { player: guestPlayer } = roomService.joinRoom(createdRoom.roomCode, "Bob", "socket-2");

    // Host updates settings
    const updated = roomService.configureRoom(createdRoom.roomCode, hostPlayer.id, {
      werewolfCount: 3,
      troublemakerEnabled: true,
      discussionTimer: 180,
    });

    expect(updated.config.werewolfCount).toBe(3);
    expect(updated.config.troublemakerEnabled).toBe(true);
    expect(updated.config.discussionTimer).toBe(180);

    // Non-host attempts to configure
    expect(() => {
      roomService.configureRoom(createdRoom.roomCode, guestPlayer.id, {
        werewolfCount: 1,
        troublemakerEnabled: false,
        discussionTimer: 60,
      });
    }).toThrow(/Only the room host/i);
  });

  it("should enforce minimum player rules: 8 for base game, 9 for Troublemaker", () => {
    const { room: createdRoom } = roomService.createRoom("Player1", "socket-1");
    const roomCode = createdRoom.roomCode;

    // Add 6 more players (total 7)
    for (let i = 2; i <= 7; i++) {
      roomService.joinRoom(roomCode, `Player${i}`, `socket-${i}`);
    }

    let state = roomService.getPublicRoomState(roomCode);
    expect(state.canStart).toBe(false);
    expect(state.validation.minPlayersRequired).toBe(8);

    // Add 8th player
    roomService.joinRoom(roomCode, "Player8", "socket-8");
    state = roomService.getPublicRoomState(roomCode);
    expect(state.canStart).toBe(true);
    expect(state.validation.villagerCount).toBe(1);

    // Enable Troublemaker: requires 9 players minimum
    const room = roomService.getRoomByCode(roomCode);
    roomService.configureRoom(roomCode, room.hostId, {
      werewolfCount: 2,
      troublemakerEnabled: true,
      discussionTimer: 240,
    });

    state = roomService.getPublicRoomState(roomCode);
    expect(state.canStart).toBe(false);
    expect(state.validation.minPlayersRequired).toBe(9);

    // Add 9th player
    roomService.joinRoom(roomCode, "Player9", "socket-9");
    state = roomService.getPublicRoomState(roomCode);
    expect(state.canStart).toBe(true);
    expect(state.validation.villagerCount).toBe(1);
  });

  it("should transfer host to another connected player when the host leaves", () => {
    const { room: createdRoom } = roomService.createRoom("Alice", "socket-1");
    roomService.joinRoom(createdRoom.roomCode, "Bob", "socket-2");

    const leaveResult = roomService.leaveRoom("socket-1");
    expect(leaveResult.roomDeleted).toBe(false);
    expect(leaveResult.room.players).toHaveLength(1);
    expect(leaveResult.room.players[0].displayName).toBe("Bob");
    expect(leaveResult.room.players[0].isHost).toBe(true);
    expect(leaveResult.room.hostId).toBe(leaveResult.room.players[0].id);
  });
});
