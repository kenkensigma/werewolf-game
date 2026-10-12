# Werewolf Multiplayer — System Analysis & Technical Specification

> **Document type:** System Analysis / Functional Specification
> **Project:** Browser-Based Multiplayer Werewolf
> **Language:** JavaScript (no TypeScript)
> **Frontend:** React + Vite
> **Backend:** Node.js + Express + Socket.IO
> **Database:** PostgreSQL
> **Purpose:** Single source of truth for AI-assisted development

---

# 1. Project Overview

## 1.1 Product Description

Werewolf Multiplayer is a browser-based, real-time multiplayer social deduction game. Players join a room using a room code, receive secret roles, and attempt to achieve their faction's win condition through discussion, voting, and night actions.

One player acts as the room host and configures the game before starting. After the game starts, the server controls the entire gameplay lifecycle, including phases, timers, role abilities, voting, eliminations, reconnects, and victory conditions.

The application must support desktop and mobile browsers.

## 1.2 Core Objectives

1. Allow players to create and join private game rooms.
2. Support configurable role distribution and optional roles.
3. Run a complete multiplayer game with synchronized phases.
4. Provide private role information and role-specific abilities.
5. Support real-time discussion, voting, and night actions.
6. Resolve simultaneous night actions consistently.
7. Prevent cheating through server-side validation.
8. Handle disconnections, reconnections, and expired deadlines.
9. Display game results and reveal all roles after the game ends.
10. Provide an interface consistent with `design.md`.

## 1.3 Non-Goals for the Initial Version

Unless explicitly requested later, do not implement these features in the MVP:

* Public matchmaking and automatic player discovery.
* Ranked matchmaking, MMR, or competitive leaderboards.
* Spectator slots before a game starts.
* Multiple simultaneous games in one room.
* Custom roles created by users.
* Voice chat or video chat.
* AI-controlled players.
* Complex tournament systems.
* In-game purchases or monetization.

Build a reliable core game before introducing additional features.

---

# 2. Technology Stack

| Layer                   | Technology                                      | Responsibility                            |
| ----------------------- | ----------------------------------------------- | ----------------------------------------- |
| Frontend                | React + JavaScript                              | UI and player interaction                 |
| Build tool              | Vite                                            | Development and production builds         |
| Styling                 | CSS Modules or organized CSS                    | Design system and animations              |
| Backend                 | Node.js + JavaScript                            | Game rules and authoritative state        |
| HTTP server             | Express                                         | Health checks and REST endpoints          |
| Real-time communication | Socket.IO                                       | Multiplayer events and synchronization    |
| Database                | PostgreSQL                                      | Persistent users, rooms, and game records |
| Database access         | Prisma ORM or equivalent                        | Database queries and migrations           |
| Validation              | Zod or equivalent runtime validation            | Validate incoming data                    |
| Testing                 | Vitest + suitable Socket.IO integration testing | Unit and multiplayer tests                |

### Technical rules

* Use JavaScript (`.js` and `.jsx`), not TypeScript (`.ts` and `.tsx`).
* Use ES modules consistently.
* Keep frontend and backend responsibilities separate.
* Do not put authoritative game rules inside React components.
* Never trust a role, vote, action, phase, winner, or player status sent by a client.
* Use server-side validation for every gameplay event.
* Use CSS animations for card flips and transitions; animations must never determine game outcomes.
* Do not store secrets, passwords, or database credentials in frontend environment variables.
* Use environment variables for backend configuration.

Suggested structure:

```text
werewolf/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── lobby/
│   │   │   ├── gameplay/
│   │   │   ├── voting/
│   │   │   ├── night-actions/
│   │   │   └── results/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── socket/
│   │   ├── styles/
│   │   └── utils/
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   ├── game/
│   │   ├── rooms/
│   │   ├── socket/
│   │   ├── services/
│   │   ├── validation/
│   │   └── index.js
│   └── package.json
├── shared/
│   └── constants/
├── design.md
├── system-analysis.md
└── README.md
```

This is a suggested starting structure, not a reason to overengineer the MVP.

---

# 3. Actors and Permissions

## 3.1 Guest Player

A guest can:

* Create a room.
* Join an existing room with a valid room code.
* Enter a display name.
* View public room information.
* Receive a secret role after the game starts.
* Participate in gameplay while alive.
* Reconnect to an existing session when permitted.

A guest cannot:

* Access another player's secret role.
* Change game settings unless authorized.
* Start a game without host permission.
* Submit actions after being eliminated.
* Perform an ability belonging to another role.
* Manipulate the game timer, phase, or result.

## 3.2 Room Host

The host is the player responsible for configuring and starting a room.

The host can:

* Configure the number of Werewolves.
* Enable or disable the Troublemaker.
* Set the discussion timer.
* Start the game when all requirements are met.
* Initiate a rematch after the current game ends.

The host does not automatically receive special gameplay powers.

The host must obey all ordinary role restrictions. For example, a host who receives the Villager role cannot use the Seer's ability.

If the host disconnects during a game, the game must continue independently of the host's connection.

## 3.3 Living Player

A living player can:

* Participate in discussion.
* Vote during the voting phase.
* Perform abilities permitted by their role during the appropriate night phase.
* View public gameplay information.

## 3.4 Eliminated Player

An eliminated player becomes a spectator for the remainder of the current game.

An eliminated player can:

* View public game information.
* View the current phase and remaining timer.
* Observe public voting results and eliminations.
* Observe the game until it ends.

An eliminated player cannot:

* Vote.
* Submit night actions.
* Use gameplay chat.
* Influence the outcome through gameplay events.

**Important:** Eliminated players must not gain access to secret roles or private night actions merely because they are spectators.

---

# 4. Game Configuration and Role Distribution

## 4.1 Supported Roles

| Role         | Faction     |              Quantity | Ability                                    |
| ------------ | ----------- | --------------------: | ------------------------------------------ |
| Werewolf     | Werewolf    |          Configurable | Selects a player to attack at night        |
| Seer         | Village     |             Exactly 1 | Investigates one player per night          |
| Guard        | Village     |             Exactly 2 | Protects one other living player per night |
| Hunter       | Village     |             Exactly 2 | May shoot one player or skip each night    |
| Villager     | Village     | Fills remaining slots | Participates in discussion and voting      |
| Troublemaker | Independent |                0 or 1 | Wins if eliminated by daytime voting       |

The Troublemaker is optional. The room host can enable or disable it before starting the game.

The game must have exactly one Seer, two Guards, and two Hunters.

## 4.2 Minimum Player Requirements

* Minimum room size: 8 players.
* If the Troublemaker is enabled, minimum room size: 9 players.
* The room cannot start unless the total role distribution is valid.
* All configured roles must fit within the available player slots.
* At least one Villager must remain after assigning all other roles.

The additional minimum for the Troublemaker is necessary because the base eight-player configuration already consumes all slots with the required roles and two Werewolves.

## 4.3 Werewolf Count

The host can configure the number of Werewolves before the game starts.

* Default: 2.
* Minimum: 1.
* Maximum: determined by the available player count while preserving all required roles and at least one Villager.

Do not hardcode a maximum Werewolf count without considering the selected player count and other enabled roles.

## 4.4 Discussion Timer

* Default discussion duration: 4 minutes.
* The host can configure the duration before the game starts.
* The backend is the authoritative source of the deadline.
* All clients display the remaining time based on the server-provided deadline.

Use a configurable and documented minimum and maximum timer duration. Validate it on the server.

## 4.5 Example: Eight Players

With eight players and the Troublemaker disabled:

| Role     | Quantity |
| -------- | -------: |
| Werewolf |        2 |
| Seer     |        1 |
| Guard    |        2 |
| Hunter   |        2 |
| Villager |        1 |
| Total    |        8 |

With nine players and the Troublemaker enabled:

| Role         | Quantity |
| ------------ | -------: |
| Werewolf     |        2 |
| Seer         |        1 |
| Guard        |        2 |
| Hunter       |        2 |
| Villager     |        1 |
| Troublemaker |        1 |
| Total        |        9 |

The server must generate role assignments randomly after a valid game start. Each player receives exactly one role.

## 4.6 Role Assignment Rules

1. Freeze the room configuration when the game starts.
2. Snapshot the eligible player list.
3. Validate player count and configuration.
4. Build the role list.
5. Shuffle the role list on the server using a suitable secure random source.
6. Assign exactly one role to each player.
7. Store role assignments in server-side game state.
8. Send each player only their own private role.
9. Send public room information without secret role assignments.

Never send the complete role mapping to every client and rely on the frontend to hide it.

---

# 5. Factions and Victory Conditions

## 5.1 Village Victory

The Village faction wins when there are no living Werewolves remaining.

This includes the Seer, Guards, Hunters, and Villagers.

The Village wins even if the Troublemaker is still alive, provided the Werewolves have been eliminated.

## 5.2 Werewolf Victory

The Werewolf faction wins when the number of living Werewolves is greater than or equal to the number of all other living players combined.

Formula:

```text
livingWerewolves >= livingNonWerewolves
```

Example:

* 2 Werewolves and 3 other living players: continue the game.
* 2 Werewolves and 2 other living players: Werewolf victory.
* 1 Werewolf and 1 other living player: Werewolf victory.
* 0 Werewolves: Village victory, subject to the Troublemaker's special victory rule.

The Troublemaker counts as a living non-Werewolf for parity calculations.

## 5.3 Troublemaker Victory

The Troublemaker wins only when the Troublemaker is eliminated by daytime voting.

The Troublemaker does not win if eliminated:

* By a Werewolf attack at night.
* By a Hunter's night attack.
* By any other non-voting elimination.

The Troublemaker's victory condition takes priority if the Troublemaker is eliminated by daytime voting.

If the Troublemaker wins, the game ends immediately, even if the Village or Werewolves would otherwise satisfy their victory conditions.

## 5.4 Victory Evaluation Order

### After daytime voting

1. Resolve the vote.
2. Determine whether a player was eliminated.
3. If the eliminated player is the Troublemaker, declare the Troublemaker the winner.
4. Otherwise, check whether all Werewolves have been eliminated.
5. If not, check Werewolf parity.
6. If no victory condition is met, begin the next night.

### After nighttime resolution

1. Resolve all night attacks and protections.
2. Eliminate the resulting targets.
3. Do not award the Troublemaker victory for a night elimination.
4. Check Village victory.
5. If the Village has not won, check Werewolf parity.
6. If no victory condition is met, begin the next day's discussion.

**Important:** Once the game reaches a terminal state, no new gameplay actions can be accepted.

---

# 6. Complete Game Lifecycle

The backend must manage the game through explicit states.

```text
LOBBY
  |
  | Host starts valid game
  v
ROLE_DISTRIBUTION
  |
  v
ROLE_REVEAL
  |
  v
NIGHT_1
  |
  | No night abilities on the first night
  v
DAY_DISCUSSION
  |
  v
DAY_VOTING
  |
  +---- Troublemaker voted out ----> GAME_OVER
  |
  +---- Village victory -----------> GAME_OVER
  |
  +---- Werewolf parity ----------> GAME_OVER
  |
  v
NIGHT
  |
  | Werewolf -> Seer -> Guard -> Hunter
  | Collect actions, then resolve together
  v
NIGHT_RESOLUTION
  |
  +---- Village victory -----------> GAME_OVER
  |
  +---- Werewolf parity ----------> GAME_OVER
  |
  v
DAY_DISCUSSION
  |
  v
DAY_VOTING
  |
  v
Repeat until GAME_OVER
```

The role reveal is a presentation state. Its animation duration must not determine when the actual game starts or when a deadline expires.

## 6.1 State Definitions

| State               | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| `LOBBY`             | Players join and the host configures the room                  |
| `ROLE_DISTRIBUTION` | The server validates configuration and assigns roles           |
| `ROLE_REVEAL`       | Clients reveal their private roles                             |
| `NIGHT_1`           | First night; no abilities are performed                        |
| `DAY_DISCUSSION`    | Living players discuss and prepare to vote                     |
| `DAY_VOTING`        | Living players vote to eliminate a player or skip              |
| `NIGHT`             | Role-specific actions are collected                            |
| `NIGHT_RESOLUTION`  | The server resolves all night actions together                 |
| `GAME_OVER`         | A winner is declared and the full role mapping can be revealed |

A rematch returns the room to `LOBBY` after the current game has ended and a valid new configuration is available.

## 6.2 Night Action Order

The server processes night actions in this logical order:

1. Werewolf.
2. Seer.
3. Guard.
4. Hunter.

These are action-collection stages, not immediate eliminations.

The server must collect the actions, apply protection rules, and resolve the results together at the end of the night.

The Hunter's attack is not an instant elimination. A target protected by a Guard must survive the Hunter's attack just as they would survive a Werewolf attack.

---

# 7. Detailed Phase Specifications

## 7.1 Lobby

The lobby displays:

* Room code.
* Player list.
* Player count.
* Host indicator.
* Current configuration.
* Ready or waiting status, if implemented.
* Start button for the host.
* Leave room button.
* Configuration controls for the host.

### Start conditions

The server must reject a start request if:

* The requester is not the host.
* The room is not in `LOBBY`.
* The player count is below the configured minimum.
* The role distribution is invalid.
* A required role is missing.
* The role distribution exceeds the available slots.
* There is no Villager remaining.
* The configuration contains invalid values.

Only the backend determines whether the game can start.

## 7.2 Role Distribution and Reveal

After a successful start:

1. Freeze room membership for the current game.
2. Generate the role assignment.
3. Initialize game state.
4. Initialize living player statuses.
5. Send each player their private role.
6. Broadcast a public game-start event.
7. Enter the role-reveal presentation.
8. Continue into `NIGHT_1` once the reveal stage is complete or its configured server-controlled deadline is reached.

### Role reveal animation

Follow `design.md`.

* Display a face-down role card.
* Flip the card using a 3D rotation.
* Reveal the player's role name, faction, and ability description.
* Do not reveal other players' roles.
* Allow reduced-motion preferences.
* Ensure a failed animation does not prevent game progression.

If a player reconnects after their role was assigned, the server must provide the correct role privately again.

## 7.3 First Night

The first night is a setup phase.

* Werewolves do not attack.
* The Seer does not investigate.
* Guards do not protect.
* Hunters do not shoot.
* No players are eliminated.

After the first night, the game enters `DAY_DISCUSSION`.

Do not accidentally execute normal night actions during `NIGHT_1`.

## 7.4 Day Discussion

During discussion:

* Living players can communicate through the in-game discussion chat.
* Eliminated players cannot send gameplay chat messages.
* The server broadcasts permitted chat messages to eligible room members.
* The discussion timer counts down using a server-authoritative deadline.
* The server automatically transitions to voting when the deadline expires.

The default discussion duration is four minutes.

A disconnected player remains part of the game unless a separate, explicitly defined removal policy is introduced.

Chat messages must be validated for length and payload structure. Apply reasonable rate limits.

The chat must not expose hidden role information automatically.

## 7.5 Day Voting

During voting, every living player may:

* Vote for one other living player.
* Select `SKIP`.
* Change their vote before the deadline.

Rules:

1. A player cannot vote for themselves.
2. A player cannot vote for an eliminated player.
3. An eliminated player cannot vote.
4. Each player has at most one active vote.
5. A changed vote replaces the previous vote.
6. The final active vote is used when voting ends.
7. Players who do not submit a vote are treated as abstaining.
8. The server determines the final outcome.

### Voting outcome

Count valid votes for each living candidate.

* A candidate must have strictly more votes than every other candidate to win the vote.
* A tie for the highest candidate vote count results in no elimination.
* If there are no valid candidate votes, there is no elimination.
* `SKIP` is not an elimination candidate.
* Abstentions are not candidate votes.
* A candidate receiving zero votes cannot be eliminated.
* A majority of all living players is not required; the highest candidate count wins if it is uniquely highest.

Examples:

| Vote distribution                   | Outcome         |
| ----------------------------------- | --------------- |
| A: 4, B: 2, C: 1                    | A is eliminated |
| A: 3, B: 3, C: 1                    | No elimination  |
| A: 2, B: 1, SKIP: 4                 | A is eliminated |
| A: 0, B: 0, SKIP: 5                 | No elimination  |
| A: 2, B: 2, all other votes abstain | No elimination  |

The host cannot manually override the vote result.

### Vote privacy

The MVP should display the final public voting result after the deadline.

Recommended default:

* Do not reveal individual vote selections while voting is still open.
* After resolution, show the public tally.
* Individual vote attribution may be shown after voting ends if this is the intended game rule.
* Do not expose private votes early through socket events or API responses.

## 7.6 Night Phase: Werewolf

All living Werewolves share a coordinated attack.

Rules:

* Each living Werewolf may submit one target.
* The target must be another living player.
* A Werewolf cannot target themselves.
* Werewolves can target other Werewolves unless a future explicit rule forbids it.
* The server validates each target.
* Werewolves can see only the information explicitly permitted to their faction.

### Coordinated target selection

The recommended MVP behavior is:

1. Collect one valid target selection from each living Werewolf.
2. If all living Werewolves select the same target, use that target.
3. If the selections differ, use the most frequently selected target.
4. If the target count is tied, resolve the attack as a skip.
5. If only one valid target is submitted before the deadline, use that target.
6. If no valid target is submitted, skip the Werewolf attack.

A player changing their selection before the deadline replaces their previous selection.

If the game is configured with one Werewolf, that Werewolf's valid target becomes the attack target.

## 7.7 Night Phase: Seer

The Seer investigates one player per night after the Werewolf action stage.

Rules:

* The Seer must be alive.
* The target must be another living player.
* The Seer cannot investigate themselves.
* The Seer may investigate the same player on consecutive nights.
* The server determines the target's faction classification.
* The result is delivered privately to the Seer.

The result must be exactly one of:

* `WEREWOLF`
* `NOT_WEREWOLF`

The Seer must not receive the target's exact role name.

Therefore:

| Target role  | Seer result    |
| ------------ | -------------- |
| Werewolf     | `WEREWOLF`     |
| Seer         | `NOT_WEREWOLF` |
| Guard        | `NOT_WEREWOLF` |
| Hunter       | `NOT_WEREWOLF` |
| Villager     | `NOT_WEREWOLF` |
| Troublemaker | `NOT_WEREWOLF` |

### Seer card reveal

Follow `design.md`.

* Display a private investigation card.
* Flip the card to reveal the result.
* Use a distinct visual treatment for `WEREWOLF` and `NOT_WEREWOLF`.
* Only the Seer receives the result event.
* Do not broadcast the result to the room.
* Do not include the result in a public game-state snapshot.

The server may persist the investigation result for auditing and reconnection. It must remain private.

## 7.8 Night Phase: Guard

Each living Guard chooses one other living player to protect.

Rules:

* A Guard cannot protect themselves.
* A Guard may protect the same target on consecutive nights.
* Multiple Guards may protect the same player.
* Two Guards protecting the same target do not create two separate layers of protection.
* Protection blocks all night attacks against that target, including Werewolf and Hunter attacks.

The server records protection selections without exposing them publicly.

If a Guard submits no valid target before the deadline, that Guard's protection is skipped.

## 7.9 Night Phase: Hunter

Each living Hunter may choose one living player to shoot or select `SKIP`.

Rules:

* The Hunter can use this ability every night while alive.
* The Hunter cannot target themselves.
* The target must be alive when the action is accepted.
* The Hunter can choose to skip.
* The Hunter's attack is resolved at the end of the night.
* A Guard protecting the target blocks the Hunter's attack.
* A Hunter cannot perform an action after being eliminated.
* The target is not eliminated immediately when the Hunter submits the action.

If both Hunters target the same unprotected player, the target is eliminated once.

If the Hunters target different unprotected players, both targets are eliminated.

If a Hunter's target is protected, that attack does not eliminate the target.

If the Hunter does not submit an action before the deadline, the default action is `SKIP`.

---

# 8. Night Resolution Engine

This is one of the most important backend systems. Implement it as a deterministic, testable server-side service.

## 8.1 Resolution Principles

* Collect all actions before resolving any eliminations.
* Do not modify player life status during action collection.
* Use one snapshot of the living players at the start of the resolution.
* Apply all Guard protection selections.
* Evaluate every attack against the protection set.
* Deduplicate eliminated player IDs.
* Apply all eliminations together.
* Check victory conditions only after the complete resolution.

This prevents action-order bugs where the first attack changes the validity of another action midway through the same night.

## 8.2 Resolution Algorithm

```text
1. Freeze the night action set.
2. Snapshot living players.
3. Determine the coordinated Werewolf target.
4. Collect valid Seer investigations.
5. Build the Guard protection set.
6. Collect valid Hunter attacks.
7. Build the complete set of attacks.
8. Remove attacks against protected targets.
9. Deduplicate surviving attack targets.
10. Mark all resulting targets as eliminated.
11. Publish public elimination results.
12. Check Village victory.
13. Check Werewolf parity.
14. If no winner exists, begin the next day.
```

The Seer's investigation result is based on the target's role, not on whether the target survives that night.

### Example

Suppose:

* Werewolves attack Player A.
* Hunter 1 shoots Player B.
* Hunter 2 shoots Player C.
* Guard 1 protects Player A.
* Guard 2 protects Player B.

Result:

* Player A survives.
* Player B survives.
* Player C is eliminated.

All three actions are evaluated together.

### Another example

Suppose both Hunters shoot Player C, and Player C is not protected.

Result:

* Player C is eliminated once.
* The server does not create duplicate eliminations.
* The game checks victory conditions after all attacks have been resolved.

## 8.3 Missing Actions

The server must never wait indefinitely for a player.

At the night deadline:

* Missing Werewolf selections follow the coordinated-target rules.
* Missing Seer investigation means no investigation.
* Missing Guard protection means no protection from that Guard.
* Missing Hunter selection means `SKIP`.

If an ability is unavailable because its owner is eliminated before the relevant action stage, that ability must not execute.

For the MVP, use a clearly defined action deadline for each stage and transition automatically when the deadline expires.

---

# 9. Elimination and Public Information

## 9.1 Player Status

Each game participant has a server-controlled status:

```text
ALIVE
ELIMINATED
```

A player can transition from `ALIVE` to `ELIMINATED` only once per game.

No gameplay action can return an eliminated player to life in the MVP.

## 9.2 Public Elimination Information

When the game resolves eliminations, broadcast:

* Eliminated player IDs.
* Display names.
* Elimination phase: `DAY_VOTE` or `NIGHT`.
* Public vote totals when applicable.
* Current living-player count.
* Updated phase and game status.

Do not reveal the eliminated player's role during the ongoing game.

All roles are revealed only after the game ends.

## 9.3 Death During the Night

If a player is attacked by multiple sources, the server must not create multiple elimination records for the same player.

If a protected player is attacked by multiple sources, all attacks against that player are blocked.

If a player is eliminated at night, their role remains secret until `GAME_OVER`.

---

# 10. Voting and Night Action Data Models

The following structures describe conceptual runtime state, not a requirement to expose every field to the frontend.

## 10.1 Game State

```js
{
  gameId: "game-id",
  roomId: "room-id",
  status: "IN_PROGRESS",
  phase: "DAY_DISCUSSION",
  dayNumber: 1,
  nightNumber: 1,
  phaseStartedAt: 0,
  phaseDeadline: 0,
  winner: null,
  players: [],
  actions: []
}
```

Use real server-generated IDs and timestamps. The example values are illustrative.

## 10.2 Game Player

```js
{
  gamePlayerId: "game-player-id",
  userId: "user-id",
  displayName: "Player Name",
  role: "SEER",
  faction: "VILLAGE",
  status: "ALIVE",
  eliminatedAt: null,
  eliminatedBy: null
}
```

This object is a private server-side representation. Never broadcast it directly to all clients.

## 10.3 Vote Record

```js
{
  gameId: "game-id",
  voterId: "player-id",
  targetId: "player-id",
  submittedAt: 0
}
```

Represent `SKIP` explicitly using a validated action value or a separate nullable target field. Never allow arbitrary target strings to bypass validation.

Only the server determines which vote is active.

## 10.4 Night Action Record

```js
{
  gameId: "game-id",
  nightNumber: 2,
  actorId: "player-id",
  role: "GUARD",
  actionType: "PROTECT",
  targetId: "player-id",
  submittedAt: 0
}
```

Store action records server-side. Protect them from unauthorized access.

Private action history must not be included in public room snapshots.

---

# 11. Database Design

Use PostgreSQL for persistent data.

Runtime game state may be kept in server memory for the MVP, but the design must avoid relying on browser state as the source of truth.

For a production deployment with multiple server instances, plan for shared state, durable deadlines, and recovery after server restarts.

## 11.1 `users`

Stores registered accounts if account registration is implemented.

Suggested fields:

* `id`
* `username`
* `email`, nullable if guest-only identity is supported
* `password_hash`, nullable if no password login is implemented
* `created_at`
* `updated_at`

Never store plaintext passwords.

If the MVP uses guest-only players, do not force a complete account system before gameplay can work.

## 11.2 `rooms`

Stores room metadata.

Suggested fields:

* `id`
* `code`, unique
* `host_user_id` or equivalent host identity
* `status`
* `max_players`, if a maximum is configured
* `created_at`
* `updated_at`
* `expires_at`

The room code must be unique, validated, and sufficiently difficult to guess if private-room security requires it.

## 11.3 `room_players`

Stores current room membership.

Suggested fields:

* `id`
* `room_id`
* `user_id` or guest session identity
* `display_name`
* `is_host`
* `connected_at`
* `last_seen_at`
* `joined_at`

Add constraints that prevent the same session from occupying multiple player slots in the same room.

## 11.4 `games`

Stores game sessions.

Suggested fields:

* `id`
* `room_id`
* `status`
* `phase`
* `day_number`
* `night_number`
* `winner`
* `config_snapshot`
* `started_at`
* `ended_at`
* `created_at`

The configuration snapshot preserves the actual settings used by the game, even if room settings later change.

## 11.5 `game_players`

Stores participant roles and game-specific status.

Suggested fields:

* `id`
* `game_id`
* `user_id` or session identity
* `display_name_snapshot`
* `role`
* `faction`
* `status`
* `eliminated_at`
* `eliminated_by`
* `joined_at`

The role mapping is secret while the game is in progress. Enforce this in API and socket serialization, not just in frontend UI.

## 11.6 `game_actions`

Stores votes and night actions when persistence is enabled.

Suggested fields:

* `id`
* `game_id`
* `game_player_id`
* `action_type`
* `target_game_player_id`, nullable for skip
* `phase_number`
* `submitted_at`
* `resolved_at`, nullable
* `metadata`, if required

Restrict access to private action records.

## 11.7 Database Integrity

* Use foreign keys between related records.
* Add indexes for room codes and frequently queried game relationships.
* Use transactions for critical state changes.
* Prevent duplicate elimination records for the same player in the same game.
* Persist role assignment and game-start state atomically.
* Ensure a rematch creates a new game record rather than overwriting historical results.
* Do not persist transient UI state unless there is a clear reason.

---

# 12. Real-Time Socket.IO Architecture

Socket.IO handles gameplay communication between clients and the server.

The server must authenticate or validate each socket session before allowing gameplay events.

## 12.1 Client-to-Server Events

| Event             | Purpose                    | Validation                                        |
| ----------------- | -------------------------- | ------------------------------------------------- |
| `room:create`     | Create a room              | Valid session and configuration                   |
| `room:join`       | Join a room by code        | Valid code, room capacity, joinable status        |
| `room:leave`      | Leave a room               | Verify membership and current game restrictions   |
| `room:configure`  | Change lobby settings      | Host only; lobby only                             |
| `game:start`      | Start the game             | Host only; valid player count and roles           |
| `discussion:chat` | Send a chat message        | Living player, correct phase, rate limit          |
| `vote:submit`     | Submit or change a vote    | Living player, voting phase, valid target         |
| `night:action`    | Submit a role action       | Correct role, living player, correct stage        |
| `session:resume`  | Resume an existing session | Valid reconnect credential                        |
| `game:rematch`    | Start a new game cycle     | Game over, valid room state, authorized requester |

Every incoming event must validate:

* Payload shape.
* Player identity.
* Room membership.
* Game membership.
* Current phase.
* Player status.
* Role permission.
* Target validity.
* Deadline.
* Action duplication or replacement rules.

## 12.2 Server-to-Client Events

| Event                | Recipient             | Purpose                          |
| -------------------- | --------------------- | -------------------------------- |
| `room:state`         | Room members          | Public room information          |
| `room:error`         | Requesting client     | Explain a rejected request       |
| `game:started`       | Room members          | Announce the new game            |
| `game:your-role`     | Individual player     | Reveal private role              |
| `game:phase`         | Room members          | Update phase and deadline        |
| `discussion:message` | Eligible room members | Broadcast permitted chat         |
| `voting:state`       | Room members          | Public voting status             |
| `voting:result`      | Room members          | Publish resolved vote outcome    |
| `night:your-turn`    | Eligible role owner   | Request the role's action        |
| `night:seer-result`  | Seer only             | Deliver investigation result     |
| `game:elimination`   | Room members          | Publish public eliminations      |
| `game:over`          | Room members          | Announce winner and reveal roles |
| `session:resumed`    | Reconnected client    | Confirm restored session state   |

Use acknowledgements for important client requests so the UI can distinguish accepted actions from rejected actions.

## 12.3 Public and Private Payloads

Maintain separate serializers for public and private information.

Example public state:

```js
{
  roomId: "room-id",
  gameId: "game-id",
  phase: "DAY_DISCUSSION",
  dayNumber: 1,
  players: [
    {
      id: "player-1",
      displayName: "Player One",
      status: "ALIVE"
    }
  ],
  phaseDeadline: 0
}
```

Example private role payload:

```js
{
  gameId: "game-id",
  role: "SEER",
  faction: "VILLAGE",
  abilityDescription: "Investigate one player each night."
}
```

Example private Seer result:

```js
{
  gameId: "game-id",
  nightNumber: 2,
  targetId: "player-3",
  result: "WEREWOLF"
}
```

These examples are illustrative. Use consistent ID formats and event schemas throughout the application.

Never send a complete role mapping or another player's private investigation result to unauthorized clients.

---

# 13. Server-Authoritative State Management

The backend is the sole authority for:

* Player identity and room membership.
* Role assignments.
* Player life status.
* Current game phase.
* Phase deadlines.
* Voting records.
* Night actions.
* Attack targets.
* Guard protections.
* Elimination results.
* Victory conditions.
* Final role reveal.

The frontend is responsible for rendering state and sending user intent.

### Example

The client sends:

```js
socket.emit("vote:submit", {
  targetId: "player-3"
});
```

The client does not send:

```js
{
  voterId: "player-1",
  phase: "DAY_VOTING",
  isAlive: true,
  winner: "VILLAGE"
}
```

The server must derive the player's identity, phase, status, and eligibility from its own trusted state.

Never trust client-submitted values for game-critical fields.

---

# 14. Timers and Phase Transitions

All phase transitions must be controlled by the backend.

## 14.1 Timer Design

When a phase starts:

1. Record `phaseStartedAt`.
2. Calculate `phaseDeadline`.
3. Broadcast the phase and deadline.
4. Accept valid actions until the deadline.
5. Close the phase when the deadline is reached.
6. Resolve pending actions.
7. Check victory conditions.
8. Start the next phase if the game continues.

Clients calculate the displayed countdown from the deadline. The displayed timer is not authoritative.

## 14.2 Deadline Enforcement

A request that arrives after its deadline must be rejected, even if the client still displays time remaining.

The server must check the deadline when processing the action, not only when a timer callback runs.

Timer callbacks may execute late due to event-loop delays. The deadline remains the source of truth.

## 14.3 Reconnection and Timers

Reconnecting a player must not restart the phase timer.

The server sends the current phase and original deadline to the reconnecting player.

A disconnected player remains subject to normal deadlines and default-action rules.

---

# 15. Reconnection and Host Disconnection

## 15.1 Player Reconnection

When a player disconnects:

* Preserve their game identity.
* Preserve their role and life status.
* Preserve their submitted votes and actions.
* Do not create a duplicate player slot on reconnect.
* Continue the game according to its existing deadlines.

When a player reconnects:

1. Validate their session or reconnect credential.
2. Restore the existing room membership.
3. Retrieve the current authoritative game state.
4. Send public state.
5. Send their own private role if a game is active.
6. Send only private action information they are authorized to recover.
7. Resume normal participation if they are alive and the phase permits it.

Do not identify a returning player by display name alone.

## 15.2 Host Disconnection

The game continues even when the host disconnects.

The host is a room-management role, not the owner of the running game state.

Recommended fallback:

* If the host disconnects during a game, do not interrupt gameplay.
* If host control must be transferred, use a documented timeout, such as 60 seconds.
* Transfer host permissions to an eligible connected player according to a deterministic rule.
* Do not transfer the host role in a way that changes a player's gameplay role.
* Do not allow host transfer to modify an active game's rules.

If the host disconnects during the lobby, the application may transfer host control or close the room after a configured timeout. Document and implement one consistent policy.

---

# 16. Security and Anti-Cheat Requirements

## 16.1 Role Privacy

* Send each role through a private server-to-client event.
* Never include role assignments in public room state.
* Never expose roles through client-readable database queries.
* Reveal all roles only after the game ends.
* Do not rely on CSS visibility or hidden React components for confidentiality.

## 16.2 Action Validation

Reject actions when:

* The player is not a member of the game.
* The player is eliminated.
* The game is over.
* The phase is incorrect.
* The player has the wrong role.
* The target does not exist.
* The target is eliminated.
* The player targets themselves when prohibited.
* The request arrives after the deadline.
* The payload is malformed.
* The request violates action replacement rules.

## 16.3 Session Security

* Use secure session or reconnect credentials.
* Never expose session secrets in public room events.
* Validate room membership for every event.
* Configure appropriate CORS origins.
* Use HTTPS/WSS in production.
* Apply rate limits to room creation, joining, and chat.
* Avoid logging passwords, session secrets, or private role information.
* Use environment variables for credentials and secrets.

## 16.4 Randomness

Generate roles on the server using a secure random source suitable for shuffling.

Do not let clients choose or predict their role assignment.

The server must verify the final role count after shuffling.

## 16.5 Information Leakage

The following must remain private during an active game:

* Other players' exact roles.
* The complete role assignment.
* Seer investigation results.
* Guard protection choices.
* Hunter targets before public resolution.
* Private Werewolf selections.
* Unresolved votes when voting privacy is enabled.

Check socket events, API responses, database access, logs, and error messages for accidental leakage.

---

# 17. Frontend Functional Requirements

The frontend must consume authoritative server state and provide feedback for every action.

## 17.1 Main Screens

1. Landing page.
2. Create room.
3. Join room.
4. Lobby.
5. Private role reveal.
6. Night phase.
7. Seer investigation result.
8. Day discussion.
9. Day voting.
10. Elimination announcement.
11. Game-over results.
12. Reconnection and error states.

## 17.2 Role Card

The role card must:

* Begin face down.
* Flip to reveal the current player's role.
* Display the role name, faction, and ability description.
* Use the visual language defined in `design.md`.
* Respect reduced-motion preferences.
* Work on mobile and desktop.

## 17.3 Seer Investigation Card

The investigation card must:

* Show the selected target.
* Flip to reveal the investigation result.
* Display only `WEREWOLF` or `NOT WEREWOLF`.
* Be visible only to the Seer.
* Remain consistent with the server result after reconnection.

The animation must not generate or determine the result.

## 17.4 Voting Interface

The voting interface must:

* Display eligible living targets.
* Prevent self-voting in the UI.
* Provide a `SKIP` option.
* Allow vote changes until the deadline.
* Show whether the current vote was accepted.
* Display a clear locked state when voting closes.
* Handle rejected requests without falsely updating the confirmed vote.

Frontend restrictions are usability aids. The server must independently enforce every rule.

## 17.5 Error and Loading States

Handle:

* Failed room creation.
* Invalid room codes.
* Full rooms.
* Unauthorized configuration changes.
* Failed actions.
* Expired phases.
* Disconnections.
* Reconnection attempts.
* Server errors.
* Games that have already ended.

Do not leave a player on a permanent loading screen after a recoverable failure.

---

# 18. Suggested Backend Modules

Keep the implementation modular, but avoid unnecessary abstraction.

## `RoomService`

Responsible for:

* Room creation.
* Room-code generation.
* Joining and leaving.
* Lobby configuration.
* Host permissions.
* Room expiration.

## `RoleAssignmentService`

Responsible for:

* Validating role configuration.
* Generating the role list.
* Shuffling roles.
* Assigning one role per player.
* Verifying role distribution.

## `GameStateService`

Responsible for:

* Creating game state.
* Managing phase transitions.
* Tracking player status.
* Tracking day and night numbers.
* Building public state snapshots.

## `VotingService`

Responsible for:

* Validating votes.
* Replacing existing votes.
* Closing voting.
* Counting votes.
* Resolving ties and skips.

## `NightActionService`

Responsible for:

* Validating role actions.
* Storing private actions.
* Handling missing actions.
* Determining the coordinated Werewolf target.
* Returning the Seer's private result.

## `NightResolutionService`

Responsible for:

* Collecting valid attacks.
* Applying Guard protection.
* Resolving simultaneous attacks.
* Deduplicating eliminations.
* Applying player status changes.

## `WinConditionService`

Responsible for:

* Checking Village victory.
* Checking Werewolf parity.
* Checking Troublemaker victory.
* Returning the terminal game result.

## `GameTimerService`

Responsible for:

* Recording phase deadlines.
* Closing expired phases.
* Triggering transitions.
* Preventing stale timers from affecting a newer phase.

## `SocketEventService`

Responsible for:

* Registering Socket.IO handlers.
* Validating incoming event payloads.
* Checking player permissions.
* Calling the appropriate service.
* Emitting public or private events to the correct recipients.

These modules can begin as simple JavaScript files. Extract or combine modules based on actual complexity.

---

# 19. Testing Requirements

Do not consider the game complete merely because the lobby looks correct.

## 19.1 Role Assignment Tests

* Eight-player game with the Troublemaker disabled is valid.
* Eight-player game with the Troublemaker enabled is rejected.
* Nine-player game with the Troublemaker enabled is valid.
* Every player receives exactly one role.
* Exactly one Seer is assigned.
* Exactly two Guards are assigned.
* Exactly two Hunters are assigned.
* The configured number of Werewolves is respected.
* At least one Villager remains.
* Invalid role distributions cannot start.

## 19.2 Voting Tests

* Living player can vote for another living player.
* Player can change their vote.
* Player cannot vote for themselves.
* Player cannot vote for an eliminated player.
* Eliminated player cannot vote.
* Vote is rejected outside the voting phase.
* Vote is rejected after the deadline.
* Unique highest candidate count results in elimination.
* Tied highest candidate count results in no elimination.
* `SKIP` does not eliminate a player.
* Missing votes are treated as abstentions.
* Troublemaker voted out wins immediately.

## 19.3 Night Action Tests

* Werewolves select one coordinated target.
* Tied Werewolf target selection skips the attack.
* One valid Werewolf selection is used when other selections are missing.
* No valid Werewolf selection skips the attack.
* Seer receives only a faction classification.
* Seer result is private.
* Guard cannot protect themselves.
* Guard can protect the same player on consecutive nights.
* Two Guards protecting the same target do not create extra layers.
* Guard protection blocks Werewolf attacks.
* Guard protection blocks Hunter attacks.
* Hunter can skip.
* Hunter cannot target themselves.
* Multiple attacks on one target produce one elimination.
* Different unprotected targets can be eliminated in the same night.
* Missing actions follow the documented defaults.
* Eliminated players cannot submit actions.

## 19.4 Victory Tests

* No living Werewolves results in Village victory, unless the Troublemaker has already won.
* Werewolf parity results in Werewolf victory.
* A Troublemaker killed at night does not win from that elimination.
* A Troublemaker eliminated by daytime voting wins immediately.
* No new actions are accepted after game over.
* A victory check happens after the complete night resolution, not after each individual attack.

## 19.5 Multiplayer and Reliability Tests

* Players receive synchronized phase changes.
* A reconnect does not create a duplicate player.
* A reconnect preserves the role and current life status.
* Reconnection does not restart a phase timer.
* Host disconnection does not stop the game.
* Unauthorized clients cannot read private role data.
* Public snapshots do not contain private night actions.
* Duplicate events do not create duplicate eliminations.
* A stale timer cannot transition a newer phase.
* Invalid payloads are rejected safely.
* A rematch creates a new game without exposing the previous game's secrets prematurely.

Use unit tests for rules and integration tests for real multiplayer event flows.

---

# 20. Implementation Roadmap

Build the system in small, testable stages.

## Phase 1 — Project Foundation

* Initialize React + Vite using JavaScript.
* Initialize the Node.js backend.
* Configure Socket.IO.
* Configure PostgreSQL and migrations.
* Create shared constants for roles, phases, and statuses.
* Implement a basic health-check endpoint.
* Verify that multiple browser clients can connect.

**Completion criteria:** Frontend and backend communicate successfully.

## Phase 2 — Lobby and Rooms

* Create rooms.
* Generate unique room codes.
* Join rooms.
* Display player lists.
* Implement host permissions.
* Configure Werewolf count, Troublemaker, and discussion timer.
* Validate start conditions.

**Completion criteria:** Multiple players can join one lobby and the server rejects invalid configurations.

## Phase 3 — Role Distribution

* Implement role configuration validation.
* Shuffle and assign roles on the server.
* Deliver private role events.
* Create public state serializers.
* Implement role reveal UI.

**Completion criteria:** Every player receives their own role without gaining access to others' roles.

## Phase 4 — Discussion and Voting

* Implement discussion chat.
* Implement server-authoritative deadlines.
* Implement vote submission and replacement.
* Implement vote resolution.
* Implement elimination.
* Implement Troublemaker victory.
* Implement ordinary victory checks.

**Completion criteria:** A complete discussion and voting cycle works across multiple browsers.

## Phase 5 — Night Actions

* Implement `NIGHT_1` with no actions.
* Implement Werewolf target coordination.
* Implement Seer investigation.
* Implement Guard protection.
* Implement Hunter attacks and skips.
* Implement the simultaneous night resolution engine.
* Implement private Seer card reveal.

**Completion criteria:** Night actions resolve correctly, including overlapping attacks and protection.

## Phase 6 — Complete Game Lifecycle

* Connect all phases.
* Implement timers and automatic transitions.
* Implement final victory checks.
* Reveal all roles after game over.
* Implement rematch.

**Completion criteria:** A complete game can run from lobby to final result without manual server intervention.

## Phase 7 — Reconnection and Security

* Implement session recovery.
* Restore private role information securely.
* Handle host disconnection.
* Validate every gameplay event.
* Apply rate limiting.
* Test information leakage and unauthorized actions.

**Completion criteria:** The game remains consistent when clients disconnect, reconnect, or submit invalid requests.

## Phase 8 — Polish and Deployment

* Apply `design.md`.
* Refine card flip animations.
* Add sound effects if desired.
* Add loading, error, and empty states.
* Test mobile layouts.
* Test accessibility and reduced motion.
* Prepare environment configuration and deployment documentation.

**Completion criteria:** The application is stable, usable, responsive, and ready for deployment.

---

# 21. Definition of Done

The MVP is complete only when all of the following are true:

* [ ] Players can create and join rooms.
* [ ] Host configuration is validated by the server.
* [ ] Role distribution follows the specified rules.
* [ ] Role information is private during the game.
* [ ] The role reveal card works.
* [ ] The first night contains no actions.
* [ ] Discussion and voting work with synchronized timers.
* [ ] Votes can be changed until the deadline.
* [ ] Ties and skips resolve correctly.
* [ ] All four active night roles work as specified.
* [ ] Seer investigation results are private.
* [ ] Guard protection blocks both types of night attack.
* [ ] Night actions resolve simultaneously.
* [ ] Eliminations are not duplicated.
* [ ] Village, Werewolf, and Troublemaker victory conditions work.
* [ ] Eliminated players cannot perform gameplay actions.
* [ ] Reconnection preserves game state.
* [ ] Host disconnection does not interrupt an active game.
* [ ] Game over reveals all roles.
* [ ] Rematch creates a clean new game.
* [ ] Critical game rules have automated tests.
* [ ] The frontend and backend use JavaScript, not TypeScript.

---

# 22. Mandatory Instructions for the AI Developer

When using this document to implement the project, follow these instructions.

1. Treat this document as the authoritative specification for gameplay rules.
2. Read `design.md` before implementing the UI.
3. Use JavaScript throughout the project. Do not introduce TypeScript.
4. Implement backend rules before building complex frontend interactions.
5. Do not invent new roles, abilities, or victory conditions.
6. Do not expose secret roles or night actions through public state.
7. Do not resolve night attacks immediately when submitted.
8. Do not let frontend animations determine game state.
9. Do not rely on client-side validation for security.
10. Do not skip edge cases documented in the testing requirements.
11. Keep implementations modular without creating unnecessary abstractions.
12. Use consistent naming for events, roles, phases, and player statuses.
13. Write tests for each core rule before marking the feature complete.
14. Do not silently change a rule if it appears ambiguous. Identify the ambiguity and ask for clarification.
15. Do not implement all features in a single giant code dump. Work incrementally, verify each stage, and maintain working code.
16. Update documentation when a deliberate, approved system change is made.
17. If `design.md` describes a visual interaction, implement it in accordance with the server-authoritative rules in this document.
18. Never claim a feature is complete without implementing and testing its behavior.

## Final Engineering Principle

**The frontend presents the game. The backend runs the game. The database preserves the game.**

A visually impressive Werewolf game is not complete unless every player sees a consistent state, every action is validated, private information remains private, and the same game rules produce the same outcome regardless of which player submitted an action first.
