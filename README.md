# LoreKeeper

> A desktop campaign manager built for Dungeon Masters who have outgrown their Google Docs.

---

## The Problem

If you have ever run a tabletop campaign, you know how fast things get out of hand. What starts as a few notes about some NPCs and a small map turns into dozens of characters in competing factions, reputation scores that shift with every player decision, and a world shaped by months of in-session choices. Most Dungeon Masters end up managing all of this across a graveyard of Google Docs, Notion pages, and handwritten notes that made sense at the time — until they don't.

The patchwork works until it no longer does, and it usually falls apart at the worst moment: a player asks about a chain of events from three sessions ago and the whole table waits while you dig through your files.

**LoreKeeper is one place to run your entire campaign.** Type what you're looking for and it's there. No folders, no tabs, no digging.

---

## Features

### Card Library
Build and search a full library of campaign entities. Every entry is a card:

| Type | What it tracks |
|---|---|
| **NPC** | Race, role, faction affiliation, status, voice/mannerism notes |
| **Item** | Rarity, value, attunement, current holder |
| **Location** | Region, type, climate/feel |
| **Lore** | Category, era, source |
| **Faction** | Alignment, goal, leader, headquarters |

Each card supports a freeform description, custom tags, an optional image, and a **public/DM-only toggle** for the player view.

### Global Search
Press `Ctrl+K` (or `Cmd+K`) anywhere in the app to open a full-text search overlay. Results are returned instantly from a local SQLite FTS5 index and grouped by type — pull up any NPC, location, or lore entry mid-session without navigating anywhere.

### Party Panel
A dedicated panel for tracking your players:

- **Custom resources** — define any resource your system uses (HP, AC, Spell Slots, Bardic Inspiration, Gold) with a current/max bar and a color
- **Initiative tracker** — enter initiative values per character; the app auto-sorts them into a combat order strip that appears when combat begins
- **Faction reputation** — for every Faction card in your library, each party member has a reputation bar from 0 to 100 (Hostile → Unfriendly → Neutral → Friendly → Revered), adjustable with a single click

### Session Log
A chronological record of every session. Each entry captures the session number, date, title, and freeform notes. Everything stays local — no cloud, no account.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | [Electron](https://www.electronjs.org/) |
| Bundler | [electron-vite](https://electron-vite.org/) |
| UI | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (embedded SQLite) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Icons | [Lucide React](https://lucide.dev/) |

All data is stored locally in a SQLite database at your OS user-data path. No internet connection required at runtime.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Install & Run

```bash
git clone https://github.com/your-username/lorekeeper.git
cd lorekeeper
npm install
npm run dev
```

`npm install` will automatically rebuild the native `better-sqlite3` binary for your platform and Electron version via `electron-builder install-app-deps`.

### Build for Production

```bash
npm run build
```

Outputs a platform-native installer to `dist/`.

---

## Architecture Overview

```
src/
├── main/           # Electron main process (Node.js)
│   ├── db/         # SQLite schema + initialization
│   └── ipc/        # IPC handlers: cards, party, sessions, search
├── preload/        # Context bridge — typed window.api surface
└── renderer/       # React frontend
    └── src/
        ├── components/
        │   ├── cards/      # CardItem, CardDetail, CardForm
        │   ├── party/      # Member slots, resources, initiative, rep bars
        │   ├── sessions/   # Session log entry form
        │   └── layout/     # Sidebar, global search overlay
        ├── pages/          # LibraryPage, PartyPage, SessionsPage
        ├── store/          # Zustand stores (ui, search)
        └── types/          # Shared TypeScript types + Electron API declarations
```

The main and renderer processes communicate exclusively through a typed IPC bridge defined in `src/preload/index.ts` and declared in `src/renderer/src/types/electron.d.ts`. The renderer never has direct access to Node.js APIs.

---

## Technical Highlights

A breakdown of the design decisions and skills demonstrated in this project:

**Electron + IPC architecture** — The app follows strict process separation. All file system access, database queries, and OS dialog calls live in the main process. The renderer communicates through a narrow, typed `contextBridge` API, keeping the renderer sandboxed.

**Embedded SQLite with FTS5** — Rather than a remote database or JSON files, the app uses `better-sqlite3` for a zero-config embedded database. Full-text search is powered by a SQLite FTS5 virtual table with trigger-based sync, enabling sub-millisecond search across the entire campaign library.

**Polymorphic card model** — All content types (NPC, Item, Location, Lore, Faction) share a single `cards` table. Type-specific data is stored in a JSON `fields` column, avoiding schema sprawl while keeping queries simple and fast.

**TypeScript throughout** — Both the main process (Node.js) and renderer (React) are fully typed. The shared type system means the IPC contract is enforced at compile time — if a handler's return shape changes, the renderer's usage breaks at typecheck, not at runtime.

**Tailwind CSS dark theme** — The UI uses a custom Tailwind config with semantic color tokens (`surface-base`, `surface-raised`, `surface-overlay`, `accent`) rather than hardcoded hex values, making the design system easy to extend or re-theme.

**Component-driven UI** — The interface is broken into small, single-responsibility components. Data fetching lives in page-level components; presentational components receive only what they render. State that crosses the component tree (current page, search modal, selected card) lives in Zustand stores.

---

## Roadmap

- [ ] Player view — second window showing only public cards
- [ ] Image drag-and-drop
- [ ] Campaign switcher (multiple campaigns in one app)
- [ ] Session note linking to cards
- [ ] Export to PDF / markdown
- [ ] Map view for locations
- [ ] Dice roller

---

## Contributing

Contributions are welcome. Open an issue to discuss a feature or bug before submitting a PR.

```bash
# Run in dev mode
npm run dev

# Typecheck
npm run typecheck

# Build
npm run build
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
