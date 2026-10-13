const ROLES = Object.freeze({
  WEREWOLF: "WEREWOLF",
  SEER: "SEER",
  GUARD: "GUARD",
  HUNTER: "HUNTER",
  WITCH: "WITCH",
  VILLAGER: "VILLAGER",
  TROUBLEMAKER: "TROUBLEMAKER",
});

const FACTIONS = Object.freeze({
  WEREWOLF: "WEREWOLF",
  VILLAGE: "VILLAGE",
  INDEPENDENT: "INDEPENDENT",
});

const ROLE_FACTIONS = Object.freeze({
  [ROLES.WEREWOLF]: FACTIONS.WEREWOLF,
  [ROLES.SEER]: FACTIONS.VILLAGE,
  [ROLES.GUARD]: FACTIONS.VILLAGE,
  [ROLES.HUNTER]: FACTIONS.VILLAGE,
  [ROLES.WITCH]: FACTIONS.VILLAGE,
  [ROLES.VILLAGER]: FACTIONS.VILLAGE,
  [ROLES.TROUBLEMAKER]: FACTIONS.INDEPENDENT,
});

const PLAYER_STATUS = Object.freeze({
  ALIVE: "ALIVE",
  ELIMINATED: "ELIMINATED",
});

const PHASES = Object.freeze({
  LOBBY: "LOBBY",
  ROLE_DISTRIBUTION: "ROLE_DISTRIBUTION",
  ROLE_REVEAL: "ROLE_REVEAL",
  NIGHT_1: "NIGHT_1",
  DAY_DISCUSSION: "DAY_DISCUSSION",
  DAY_VOTING: "DAY_VOTING",
  NIGHT: "NIGHT",
  NIGHT_RESOLUTION: "NIGHT_RESOLUTION",
  GAME_OVER: "GAME_OVER",
});

const ACTION_TYPES = Object.freeze({
  WEREWOLF_ATTACK: "WEREWOLF_ATTACK",
  SEER_INVESTIGATE: "SEER_INVESTIGATE",
  GUARD_PROTECT: "GUARD_PROTECT",
  HUNTER_SHOOT: "HUNTER_SHOOT",
  HUNTER_SKIP: "HUNTER_SKIP",
  WITCH_HEAL: "WITCH_HEAL",
  WITCH_POISON: "WITCH_POISON",
  WITCH_SKIP: "WITCH_SKIP",
});

const SEER_RESULTS = Object.freeze({
  WEREWOLF: "WEREWOLF",
  NOT_WEREWOLF: "NOT_WEREWOLF",
});

const SOCKET_EVENTS = Object.freeze({
  // Client to server
  ROOM_CREATE: "room:create",
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_CONFIGURE: "room:configure",
  GAME_START: "game:start",
  DISCUSSION_CHAT: "discussion:chat",
  VOTE_SUBMIT: "vote:submit",
  NIGHT_ACTION: "night:action",
  SESSION_RESUME: "session:resume",
  GAME_REMATCH: "game:rematch",

  // Proximity Voice Chat events
  VOICE_JOIN: "voice:join",
  VOICE_LEAVE: "voice:leave",
  VOICE_SIGNAL: "voice:signal",
  VOICE_MUTE: "voice:mute",
  VOICE_SPEAKING: "voice:speaking",
  VOICE_PEER_JOINED: "voice:peer-joined",
  VOICE_PEER_LEFT: "voice:peer-left",
  VOICE_MUTE_STATE: "voice:mute-state",
  VOICE_SPEAKING_STATE: "voice:speaking-state",

  // Server to client
  ROOM_STATE: "room:state",
  ROOM_ERROR: "room:error",
  GAME_STARTED: "game:started",
  GAME_YOUR_ROLE: "game:your-role",
  GAME_PHASE: "game:phase",
  DISCUSSION_MESSAGE: "discussion:message",
  VOTING_STATE: "voting:state",
  VOTING_RESULT: "voting:result",
  NIGHT_YOUR_TURN: "night:your-turn",
  NIGHT_SEER_RESULT: "night:seer-result",
  GAME_ELIMINATION: "game:elimination",
  GAME_OVER: "game:over",
  SESSION_RESUMED: "session:resumed",
});

const ROLE_METADATA = Object.freeze({
  [ROLES.WEREWOLF]: {
    name: "Werewolf",
    faction: FACTIONS.WEREWOLF,
    description: "Coordinate with your pack to hunt villagers in the dead of night.",
    colorAccent: "#8D343B",
  },
  [ROLES.SEER]: {
    name: "Seer",
    faction: FACTIONS.VILLAGE,
    description: "Peer into the darkness each night to discover who harbors the wolf curse.",
    colorAccent: "#7889A6",
  },
  [ROLES.GUARD]: {
    name: "Guard",
    faction: FACTIONS.VILLAGE,
    description: "Stand watch each night to protect one living soul from violence.",
    colorAccent: "#C6A66B",
  },
  [ROLES.HUNTER]: {
    name: "Hunter",
    faction: FACTIONS.VILLAGE,
    description: "Take aim under the moonlight: shoot a suspect each night, or hold your fire.",
    colorAccent: "#A7A2A0",
  },
  [ROLES.WITCH]: {
    name: "Witch",
    faction: FACTIONS.VILLAGE,
    description: "Brewmaster of mystical tonics. You hold an Elixir of Life to save the wolves' victim and a Poison Brew to slay a suspect.",
    colorAccent: "#9B59B6",
  },
  [ROLES.VILLAGER]: {
    name: "Villager",
    faction: FACTIONS.VILLAGE,
    description: "Unmask the beasts through keen deduction and vote them out during the day.",
    colorAccent: "#D8C8A8",
  },
  [ROLES.TROUBLEMAKER]: {
    name: "Troublemaker",
    faction: FACTIONS.INDEPENDENT,
    description: "Weave chaos and deception. You claim sole victory if voted out by daytime execution.",
    colorAccent: "#C59B55",
  },
});

module.exports = {
  ROLES,
  FACTIONS,
  ROLE_FACTIONS,
  PLAYER_STATUS,
  PHASES,
  ACTION_TYPES,
  SEER_RESULTS,
  SOCKET_EVENTS,
  ROLE_METADATA,
};
