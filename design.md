# Werewolf — Design System & UI/UX Specification

## 01. Product Vision

Design a browser-based multiplayer Werewolf game that feels like a mysterious tabletop game brought to life.

The interface should combine the atmosphere of dark fantasy, the tactile feeling of physical playing cards, and smooth cinematic transitions. It must feel immersive without sacrificing readability, speed, or usability during actual gameplay.

The experience should be driven by three visual elements:

1. **Secret Role Cards** — the central interaction for revealing a player's identity.
2. **Phase Atmosphere** — distinct visual moods for night, day, voting, and game over.
3. **Meaningful Motion** — animations that communicate game events rather than decorating every interaction.

The interface must work on desktop and mobile browsers.

### Core Design Principles

* Atmospheric, not excessively dark.
* Mysterious, but always readable.
* Dramatic animations for important moments only.
* Card-focused gameplay instead of dashboard-style layouts.
* Distinct visual identities for roles and game phases.
* Clear feedback for every action, selection, and state change.
* No unnecessary UI elements competing with the current game phase.

---

## 02. Visual Direction

### Art Direction: Gothic Tabletop

Use the visual language of premium fantasy board games, illustrated role cards, candlelit rooms, old manuscripts, and subtle moonlight.

The design should feel handcrafted and intentional rather than resembling a generic AI-generated gaming dashboard.

### Visual Characteristics

* Deep charcoal backgrounds with warm ivory text.
* Muted burgundy for danger and Werewolf-related elements.
* Antique gold for important interactions and selected cards.
* Desaturated blue-gray for night atmosphere.
* Warm parchment tones for daytime discussion.
* Fine borders, restrained textures, and controlled shadows.
* Illustrated role artwork with consistent framing and lighting.

### Avoid

* Neon purple and cyan cyberpunk aesthetics.
* Excessive gradients on text.
* Glassmorphism everywhere.
* Excessive glowing borders.
* Generic SaaS dashboard layouts.
* Large rounded cards for every element.
* Emoji as the primary role artwork.
* Random decorative particles throughout the entire interface.
* Animating every button, panel, and text element.
* Fake 3D effects on elements that do not need them.

The game should feel like a carefully art-directed digital board game, not a generic gaming template.

---

## 03. Color System

### Base Palette

| Token                    | Hex       | Usage                              |
| ------------------------ | --------- | ---------------------------------- |
| `--color-void`           | `#101114` | Main application background        |
| `--color-surface`        | `#191A1F` | Main panels and gameplay surfaces  |
| `--color-surface-raised` | `#23242B` | Elevated panels and menus          |
| `--color-border`         | `#3A3940` | Borders and separators             |
| `--color-ivory`          | `#F0E8D9` | Primary text                       |
| `--color-muted`          | `#A7A2A0` | Secondary text                     |
| `--color-gold`           | `#C6A66B` | Primary accent and selected states |
| `--color-burgundy`       | `#8D343B` | Danger and Werewolf actions        |
| `--color-moonlight`      | `#7889A6` | Night phase and Seer effects       |
| `--color-parchment`      | `#D8C8A8` | Day phase accents                  |
| `--color-success`        | `#78957A` | Successful actions                 |
| `--color-warning`        | `#C59B55` | Warnings and time pressure         |

### Color Rules

* Use `--color-void` as the primary gameplay background.
* Use ivory rather than pure white for most text.
* Reserve gold for active selections, key actions, and important emphasis.
* Burgundy must not be the only indicator that an action is dangerous.
* Night and day phases should change the atmosphere, not make the entire application switch between unrelated themes.
* Maintain accessible text contrast for all essential information.

---

## 04. Typography

Use three complementary typefaces.

### Display Typeface: Cinzel

Use for:

* Game title.
* Role names.
* Important chapter headings.
* Dramatic game-over announcements.

### Interface Typeface: Inter

Use for:

* Buttons.
* Player names.
* Voting counts.
* Timers.
* Settings and system messages.

### Optional Editorial Typeface: Cormorant Garamond

Use sparingly for:

* Flavor text.
* Role descriptions.
* Atmospheric section labels.

### Typography Scale

| Token            | Size | Usage                               |
| ---------------- | ---: | ----------------------------------- |
| `--text-xs`      | 12px | Small metadata                      |
| `--text-sm`      | 14px | Secondary labels                    |
| `--text-base`    | 16px | Main interface text                 |
| `--text-lg`      | 20px | Panel headings                      |
| `--text-xl`      | 26px | Role names and key titles           |
| `--text-2xl`     | 36px | Major game announcements            |
| `--text-display` | 48px | Landing page hero, used selectively |

Rules:

* Do not make every heading oversized.
* Use Cinzel for atmosphere, not for long paragraphs.
* Use Inter for timers and numerical information.
* Use tabular numerals for countdowns and voting counts.
* Avoid excessive bold text.
* Avoid gradient text and text shadows as default styling.
* Keep body text comfortably readable on mobile screens.

---

## 05. Layout System

### Application Structure

The game should have five main screen categories:

1. Landing Page
2. Lobby
3. Role Reveal
4. Active Gameplay
5. Game Results

Each screen should have its own hierarchy, but all must share the same color tokens, typography, spacing, and motion language.

### Spacing Scale

Use a consistent 4px-based spacing system:

* 4px — icon and label spacing.
* 8px — compact controls.
* 12px — related content.
* 16px — standard component spacing.
* 24px — section spacing.
* 32px — major layout separation.
* 48px — large visual breaks.
* 64px — hero and cinematic layouts.

### Layout Rules

* Center the main role card during reveal phases.
* Keep essential player information visible without overwhelming the game.
* Use a fixed, readable content width for discussion and voting.
* Keep important controls within comfortable thumb reach on mobile.
* Do not force all gameplay screens into a uniform three-column layout.
* Use flexible compositions based on the current phase.

---

## 06. Card Design System

Cards are the signature visual component of Werewolf.

### A. Secret Role Card

The back of the card should have a recognizable shared design.

Visual details:

* Deep charcoal or black surface.
* Thin antique-gold border.
* Symmetrical occult-inspired ornamentation.
* A central moon, wolf sigil, or original game emblem.
* Subtle embossed texture.
* No role name or identity on the back.

The card front contains:

* Role illustration.
* Role name.
* Team alignment.
* Short ability description.
* Optional role-specific decorative details.

Each role card uses the same structural template. Only its artwork, accent color, symbol, and content change.

### B. Card Dimensions

Desktop:

* Approx. 280–340px wide.
* Approx. 400–480px tall.

Mobile:

* Approx. 230–280px wide.
* Height scales proportionally.

Use a consistent portrait aspect ratio of approximately 3:4.

### C. Card Materials

Use restrained visual depth:

* Fine borders.
* Soft contact shadows.
* Subtle paper grain.
* Controlled highlights on gold details.

Avoid heavy bevels, excessive glow, and thick ornamental frames that reduce artwork space.

---

## 07. Signature Interaction: Role Reveal

This is the first major cinematic interaction after the host starts the game.

### Sequence

1. Fade into a darkened reveal screen.
2. Display the player's name and a short instruction.
3. Present one face-down role card in the center.
4. Show a clear interaction cue: “Reveal Your Role”.
5. On interaction, rotate the card around its vertical axis.
6. At the midpoint, switch from card back to card front.
7. Complete the rotation and settle into the revealed state.
8. Display the role name and ability description.
9. Provide a “Continue” action when the reveal is complete.

### Motion Specification

* Initial entrance: 350–500ms.
* Card flip: 650–850ms.
* Front-face reveal: around the 50% point of the flip.
* Final settling: subtle and brief.
* Background dimming: 300–450ms.

Use a 3D CSS transform with perspective and `rotateY()`.

The card front and back must be positioned on the same plane using `backface-visibility: hidden`. Prevent both faces from becoming visible simultaneously.

### Important Rules

* Each player reveals their own role privately.
* Do not reveal other players' roles in the same shared screen.
* The card flip is triggered by an intentional user interaction.
* Do not force repeated flips when a player reconnects.
* Provide a reduced-motion alternative.
* Keep role identity out of public room events and public DOM content.

The visual animation is client-side. Role assignment and authorization remain server-side.

---

## 08. Signature Interaction: Seer Investigation

The Seer investigation must have a distinct animation from the initial role reveal.

The purpose is to communicate the discovery of hidden information.

### Sequence

1. Enter the night atmosphere.
2. Show the living-player selection interface.
3. The Seer selects a target.
4. Confirm the selection before submitting the action.
5. Transition to a private investigation screen.
6. Display a face-down investigation card.
7. Flip the card with a slightly slower, suspenseful motion.
8. Reveal one of two outcomes:

   * WEREWOLF
   * NOT WEREWOLF
9. Allow the Seer to acknowledge the result.
10. Return to the night interface or wait for the next phase.

### Visual Treatment

For the investigation card:

* Use the same base card geometry as the role card.
* Replace the full role illustration with a simple result emblem.
* Use muted burgundy for a Werewolf result.
* Use moonlight blue-gray or ivory for a non-Werewolf result.
* Keep decorative details secondary to the result text.

### Confidentiality

The result is visible only to the Seer.

Never broadcast the result through a public room event. The server should send it through a private event to the authenticated Seer connection.

The Seer sees only the target's team classification, not their exact role.

---

## 09. Phase Atmosphere

Each phase should have a recognizable visual identity.

### Night Phase

Atmosphere:

* Deep charcoal backgrounds.
* Desaturated blue-gray lighting.
* Sparse moonlight accents.
* Subtle, slow environmental movement.

Role actions:

* Werewolf: muted burgundy accents.
* Seer: moonlight blue-gray.
* Guard: antique gold or muted steel.
* Hunter: restrained burgundy or warm metallic accents.

Keep the atmosphere subtle enough that player names and target selections remain readable.

### Day Phase

Atmosphere:

* Warmer parchment accents.
* Ivory text and restrained gold details.
* Slightly brighter surfaces.
* A sense of exposure and public discussion.

The background should not become pure white. Preserve the dark fantasy identity.

### Voting Phase

Make voting more functional and focused.

* Show living players as clear selectable targets.
* Display selection with a strong border and an icon or label.
* Show remaining time prominently.
* Make vote confirmation explicit.
* Distinguish submitted, pending, and locked states.
* Do not reveal individual votes before the rules permit it.

### Game Over

Use a dedicated result composition:

* A prominent winner announcement.
* Restrained role-themed illustration or emblem.
* A list of players and their revealed roles.
* A short summary of eliminations.
* Rematch and return-to-lobby actions.

Do not use confetti or generic celebratory animations for every outcome. The ending should reflect the game's atmosphere.

---

## 10. Player Selection and Voting Components

### Player Tile

Each player tile may contain:

* Player display name.
* Alive or eliminated state.
* Connection indicator where relevant.
* Selected state.
* Voting state when disclosure is allowed.

Rules:

* Never display the real role before game over.
* Do not use role colors on unidentified players.
* Use a distinct visual treatment for eliminated players.
* Disable actions against invalid or eliminated targets.
* Do not communicate state through color alone.

### Voting States

Define explicit UI states:

* `IDLE`
* `SELECTED`
* `SUBMITTING`
* `SUBMITTED`
* `LOCKED`
* `DISABLED`

A player must know whether their vote was accepted. The server response determines the authoritative state.

### Night Action States

Define:

* `WAITING`
* `YOUR_TURN`
* `TARGET_SELECTED`
* `SUBMITTING`
* `ACTION_CONFIRMED`
* `PHASE_COMPLETE`

Do not let the UI imply an action succeeded before the server confirms it.

---

## 11. Animation and Motion System

Motion should clarify the game state and emphasize meaningful moments.

### Duration Tokens

| Token                 | Duration | Usage                               |
| --------------------- | -------: | ----------------------------------- |
| `--motion-fast`       |    150ms | Hover and small feedback            |
| `--motion-standard`   |    250ms | Selection and interface transitions |
| `--motion-panel`      |    350ms | Panel transitions                   |
| `--motion-atmosphere` |    500ms | Phase transitions                   |
| `--motion-card`       |    750ms | Role and Seer card flips            |

### Easing

* `--ease-standard`: `cubic-bezier(0.2, 0, 0, 1)`
* `--ease-enter`: `cubic-bezier(0.16, 1, 0.3, 1)`
* `--ease-exit`: `cubic-bezier(0.7, 0, 0.84, 0)`

### Required Animations

* Role card flip.
* Seer investigation flip.
* Day-to-night and night-to-day transitions.
* Player selection feedback.
* Voting confirmation.
* Elimination announcement.
* Game-over reveal.

### Animation Rules

* Do not animate every player tile continuously.
* Avoid excessive camera shake.
* Avoid long transitions that delay gameplay.
* Do not use animation as the only feedback for an important action.
* Keep timers and actionable controls responsive.
* Respect `prefers-reduced-motion`.
* Gameplay state must not depend on whether an animation finishes.

---

## 12. Sound Design

Sound is optional and must never be required to understand the game.

Suggested sound categories:

* Soft card flip.
* Subtle phase transition.
* Quiet selection confirmation.
* Muted voting lock.
* Restrained elimination cue.
* Distinct victory and defeat themes.

Rules:

* Provide a global mute control.
* Respect browser autoplay restrictions.
* Never autoplay loud audio when joining a room.
* Do not use sound as the only indication of a private result.
* Avoid repetitive ambient audio that becomes distracting during long discussions.

---

## 13. Responsive Behavior

### Desktop

* Center card reveal with ample negative space.
* Keep player list and phase information organized around the main gameplay area.
* Allow discussion and voting interfaces to use wider layouts when helpful.

### Tablet

* Reduce outer spacing.
* Keep the active role card prominent.
* Reflow player selections into fewer columns.

### Mobile

* Use a single-column primary layout.
* Keep the role card centered.
* Place primary actions within comfortable thumb reach.
* Make voting targets easy to tap.
* Avoid hover-dependent functionality.
* Keep player names and timers readable.
* Ensure the chat does not obscure essential gameplay controls.

Do not simply shrink the desktop interface. Recompose it around the current task.

---

## 14. Accessibility

* Maintain readable contrast.
* Use visible keyboard focus indicators.
* Support keyboard navigation for all important actions.
* Add accessible labels to icon-only buttons.
* Do not use color as the sole indication of a role result or selected target.
* Provide reduced-motion alternatives.
* Ensure card animations do not hide the final result from assistive technologies.
* Do not rely on sound for critical information.

---

## 15. Technical Implementation Rules

### Recommended Stack

* Frontend: React + JavaScript + Vite.
* Styling: CSS Modules or organized plain CSS.
* Animation: CSS transforms and transitions; use a motion library only when necessary.
* Backend: Node.js + JavaScript + Socket.IO.
* Database: PostgreSQL.
* Validation: Zod or equivalent runtime schema validation.

TypeScript is not required.

### Component Structure

Suggested components:

* `RoleCard`
* `RoleRevealScreen`
* `SeerInvestigation`
* `PhaseTransition`
* `PlayerTile`
* `PlayerGrid`
* `DiscussionChat`
* `VotingPanel`
* `NightActionPanel`
* `PhaseTimer`
* `GameResultScreen`

### Separation of Responsibilities

* The backend assigns roles.
* The backend validates and resolves actions.
* The backend controls phase deadlines.
* The frontend displays only authorized information.
* Animations never determine game outcomes.
* The frontend never calculates authoritative winners.
* Private role data must not be included in public room state.

### Performance

* Prefer CSS transforms and opacity for card animation.
* Avoid continuously animating large background effects.
* Keep environmental effects lightweight.
* Clean up event listeners when components unmount.
* Prevent duplicate Socket.IO subscriptions.
* Restore the current game state after reconnecting.

---

## 16. Final Quality Standard

The finished game should feel like a premium digital tabletop experience.

A player should immediately understand:

* Which phase the game is in.
* What action they can perform.
* Whether an action was accepted.
* What information is private.
* When the current phase will end.

The card flip must be memorable, but never slow down gameplay. The atmosphere must be immersive, but never obscure the rules. The visual system must feel distinctive, but remain consistent across every screen.

Prioritize the following implementation order:

1. Build the shared visual tokens and typography.
2. Implement the role card and 3D flip interaction.
3. Implement the Seer investigation reveal.
4. Build the lobby and player selection components.
5. Add day/night atmosphere transitions.
6. Connect the interface to the authoritative multiplayer game engine.
7. Polish animations, audio, responsiveness, and accessibility.

The result should be a coherent game experience rather than a collection of unrelated screens.
