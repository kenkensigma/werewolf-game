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
  seerCount: z
    .number()
    .int("Seer count must be an integer")
    .min(0, "Seer count cannot be negative")
    .max(4, "Cannot exceed 4 Seers")
    .default(1),
  guardCount: z
    .number()
    .int("Guard count must be an integer")
    .min(0, "Guard count cannot be negative")
    .max(4, "Cannot exceed 4 Guards")
    .default(2),
  hunterCount: z
    .number()
    .int("Hunter count must be an integer")
    .min(0, "Hunter count cannot be negative")
    .max(4, "Cannot exceed 4 Hunters")
    .default(2),
  witchCount: z
    .number()
    .int("Witch count must be an integer")
    .min(0, "Witch count cannot be negative")
    .max(4, "Cannot exceed 4 Witches")
    .default(0),
  troublemakerEnabled: z.boolean().default(false),
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
