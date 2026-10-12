const { z } = require("zod");

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(24, "Name must not exceed 24 characters")
  .regex(/^[\w\s-]+$/, "Name can only contain letters, numbers, spaces, and hyphens");

const roomCodeSchema = z
  .string()
  .trim()
  .length(6, "Room code must be exactly 6 characters")
  .toUpperCase();

const roomConfigSchema = z.object({
  werewolfCount: z
    .number()
    .int("Werewolf count must be an integer")
    .min(1, "At least 1 Werewolf is required")
    .max(8, "Cannot exceed 8 Werewolves"),
  troublemakerEnabled: z.boolean(),
  discussionTimer: z
    .number()
    .int("Discussion timer must be an integer in seconds")
    .min(15, "Minimum discussion duration is 15 seconds")
    .max(600, "Maximum discussion duration is 10 minutes"),
});

const createRoomSchema = z.object({
  displayName: displayNameSchema,
});

const joinRoomSchema = z.object({
  displayName: displayNameSchema,
  roomCode: roomCodeSchema,
  sessionToken: z.string().optional(),
});

module.exports = {
  displayNameSchema,
  roomCodeSchema,
  roomConfigSchema,
  createRoomSchema,
  joinRoomSchema,
};
