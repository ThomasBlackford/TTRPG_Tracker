# LoreKeeper

> A desktop toolkit for running a tabletop game live — for the Dungeon Master, and for every player at the table.

LoreKeeper is two apps that talk to each other over your home WiFi:

- **LoreKeeper** (this repo's root) — the DM's app: party, encounters, maps, handouts, and a library of campaign entities.
- **LoreKeeper Companion** (`player-client/`, also published as its own repo) — each player's character sheet, with dice, spellcasting and a live link to the DM.

Both are local-first: no accounts, no cloud, and everything lives in a SQLite file on your own PC.

---

## For the DM

### Table control
Start **Player Sync** on the Party page and players connect with the address and a four-character **join code** (on by default, so nobody else on the WiFi can join). From then on you can:

- watch each player's HP, AC, conditions, spell slots, concentration and death saves live — dropped players stay on the roster, greyed out
- **push to a player's sheet**: damage, healing, conditions, XP, coins, items, inspiration, rests
- **request rolls** ("Dexterity save, DC 14") — every player gets a prompt with their own modifier already worked out, and results come back to a roll log marked pass/fail
- **send handouts** (text and an image) straight to their screens
- rest easy about privacy: the players' own party chat never passes through the DM's app

### Encounters
- **Encounter builder** — plan a fight before the session: add monsters, see the difficulty against your party's real levels with the XP thresholds drawn out, save it, and launch it later in one click (party in, monsters in, initiative rolled, players asked to roll theirs)
- **Boss fights** — legendary actions (pips that refresh at the start of its turn), legendary resistances, recharge abilities that roll their own d6 at the start of the creature's turn, and a lair-actions turn on initiative 20. A few SRD dragons and other bosses are in the bestiary with these already set
- **Undo / redo** (`Ctrl+Z` / `Ctrl+Y`) for damage, turns, removals and edits — it also takes back damage you sent to a player's sheet
- **Concentration** — damage to a concentrating creature raises a Constitution-save card with the DC; roll it for a monster right there, and a player's own roll shows up when they make it. Dropping to 0 ends concentration with no save
- **Player initiative** — connected players are asked to roll their own initiative when a fight starts (or on demand), and it lands on the tracker
- **Companions** — a player's familiar or summon gets its own place in the order (needs the matching Companion update to send them)
- A player's spell slots, Hit Dice and class resources on their row, so you can see who's running dry
- Built-in bestiary of common SRD creatures plus your own saved monsters; add several at once (numbered "Goblin 1…4") and roll initiative per creature or once per pack
- Damage and healing, with ½ / ×2 toggles for resistance, vulnerability and crits — applied directly on a connected player's own sheet
- Timed effects that count down at the end of the affected creature's turn ("Hold Person — 3 rounds"), conditions, and concentration (taking damage prompts the save and its DC)
- Live difficulty rating from the DMG XP budget, and one-click XP awards split between connected players
- Players are pinged when it's their turn and when they're up next

### Maps
- Fog of war, ruler, grid, spotlight and a large library of animated effects for the player-facing display
- **Creature tokens** that follow the initiative order (the current turn glows), drag to move, hide to stage an ambush, one click to place the whole encounter
- **Stylized effects** for the player display — eleven bursts (fireball, frost, poison, heal, lightning, impact, rage, counterspell, radiant, necrotic, critical hit), four rays, eight lingering zones and rain/storm weather. Hand-drawn look: flat-shaded, inked shapes with snappy timing, hit-frames and screen shake. They scale with map zoom and are drawn procedurally on canvas (no image or video assets)

### Loot, homebrew and the log
- **Loot** page: roll individual or hoard treasure by challenge rating (coins, gems, art objects and magic items, in the spirit of the DMG tables), mix in your own homebrew items, then split the coins and hand items straight to players' sheets
- **Homebrew** page: an editor for your own monsters (full stat block, legendary actions, recharges, lair) and magic items, with **import / export** as a JSON file to trade with other DMs
- **Session log**: hits (and who dealt them), defeats, conditions, rolls, turns, boss actions, rewards and who joined or left are recorded automatically, grouped by fight. Copy a fight as text, or send its highlights to the Timeline

### Library & timeline
Cards for NPCs, items, locations, lore and factions (full-text search with `Ctrl+K`), per-member faction reputation, and a campaign timeline. Cards and images can be pushed to the player display as scenes and handouts.

### Backup & restore
**Settings → Back up now** writes the whole campaign — data and every image — to one `.lkbackup` file, and **Restore** brings it back on any PC. A daily snapshot is also taken automatically (the last ten are kept).

---

## For players

- Full character sheet: abilities, skills with proficiency/expertise, saves, spell slots, spell attack/DC, actions, inventory with encumbrance, languages, background, portrait
- **Play** tab: everything you need mid-fight on one screen; click anything for its full description
- **Dice**: tap-to-roll attacks and damage (natural 20 auto-doubles the dice), advantage/disadvantage, a free dice tray with history
- **Cast** button on every spell: spends the right slot (including upcasting), handles concentration, and offers the attack/damage roll
- Concentration checks come up by themselves when you take damage
- Built-in library of SRD spells, weapons, armor and gear to add from instead of typing
- XP tracking with a level-up button; platinum, gold, electrum, silver and copper
- Back up or move your character to another PC from Settings

---

## Tech stack

| Layer | Technology |
|---|---|
| Shell | [Electron](https://www.electronjs.org/) |
| Bundler | [electron-vite](https://electron-vite.org/) |
| UI | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (embedded SQLite) |
| Sync | [ws](https://github.com/websockets/ws) over the LAN |
| Updates | [electron-updater](https://www.electron.build/auto-update) via GitHub releases |

---

## Getting started

Requires [Node.js](https://nodejs.org/) 18+.

```bash
git clone https://github.com/ThomasBlackford/TTRPG_Tracker.git
cd TTRPG_Tracker
npm install
npm run dev          # the DM app
cd player-client && npm install && npm run dev   # the player app
```

`npm install` rebuilds the native `better-sqlite3` binary for Electron automatically.

```bash
npm run typecheck    # both TypeScript projects
npm test             # unit + integration tests (see below)
npm run dist         # build the Windows installer into dist/
npm run fx:preview   # contact-sheet viewer for the visual effects (see tools/fx-preview)
```

### Tests

`npm test` runs, with Node's built-in test runner:

- dice parsing/rolling, XP tables, and the encounter difficulty maths
- the backup container (round-trip, truncation, hostile file names)
- the **real DM server against the real player sync client** — join codes, DM commands, roll results, reconnects, junk frames, a busy port
- every visual effect, scrubbed through its whole lifetime on a validating fake canvas (no NaN coordinates, negative radii, unbalanced save/restore or leaked blend modes)
- the treasure generator and the homebrew file format (valid tables, fair coin splits, round-trips)
- boss-fight tracking, undo/redo, concentration, saved encounters, the session log and player-rolled initiative, against the real IPC handlers
- the real IPC handlers and SQLite migrations, run inside Electron's own Node runtime (the native database module is built for Electron)

---

## Layout

```
src/                      DM app
├── main/                 Electron main process
│   ├── db/               schema + migrations
│   ├── ipc/              handlers: cards, party, encounter, maps, tokens, sync, backup…
│   └── server/           the LAN sync server (join code, commands, roster)
├── preload/              typed contextBridge API
└── renderer/             React UI
player-client/            player app (same structure; mirrored to its own repo)
tests/                    unit + integration tests, and stubs for Electron
```

The renderer never touches Node: everything goes through the typed IPC surface in `src/preload/index.ts`, declared in `src/renderer/src/types/electron.d.ts`.

---

## License

MIT — see [LICENSE](LICENSE) for details.
