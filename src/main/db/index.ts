import Database from 'better-sqlite3'
import { join } from 'path'

let db: Database.Database | null = null

export function initDb(userDataPath: string): void {
  const dbPath = join(userDataPath, 'lorekeeper.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  createSchema()
  runMigrations()
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

function createSchema(): void {
  const d = getDb()

  d.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id          TEXT PRIMARY KEY,
      type        TEXT NOT NULL CHECK(type IN ('npc','item','location','lore','faction')),
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_path  TEXT,
      tags        TEXT NOT NULL DEFAULT '[]',
      fields      TEXT NOT NULL DEFAULT '{}',
      is_public   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type);
    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name COLLATE NOCASE);

    CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
      name, description, tags,
      content='cards',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
      INSERT INTO cards_fts(rowid, name, description, tags)
        VALUES (new.rowid, new.name, new.description, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
      INSERT INTO cards_fts(cards_fts, rowid, name, description, tags)
        VALUES ('delete', old.rowid, old.name, old.description, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
      INSERT INTO cards_fts(cards_fts, rowid, name, description, tags)
        VALUES ('delete', old.rowid, old.name, old.description, old.tags);
      INSERT INTO cards_fts(rowid, name, description, tags)
        VALUES (new.rowid, new.name, new.description, new.tags);
    END;

    CREATE TABLE IF NOT EXISTS party_members (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      player_name TEXT NOT NULL DEFAULT '',
      avatar_path TEXT,
      initiative  INTEGER,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      resources   TEXT NOT NULL DEFAULT '[]',
      client_id   TEXT UNIQUE,
      dm_notes    TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS reputation (
      party_member_id TEXT NOT NULL REFERENCES party_members(id) ON DELETE CASCADE,
      faction_id      TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      score           INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (party_member_id, faction_id)
    );

    CREATE TABLE IF NOT EXISTS maps (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      image_path  TEXT,
      description TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS map_pins (
      id            TEXT PRIMARY KEY,
      map_id        TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
      x             REAL NOT NULL DEFAULT 0.5,
      y             REAL NOT NULL DEFAULT 0.5,
      label         TEXT NOT NULL DEFAULT '',
      card_id       TEXT REFERENCES cards(id) ON DELETE SET NULL,
      child_map_id  TEXT REFERENCES maps(id) ON DELETE SET NULL,
      color         TEXT NOT NULL DEFAULT '#c9a84c',
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_map_pins_map ON map_pins(map_id);

    -- "content" is kept only so pre-migration rows aren't silently dropped;
    -- new/edited notes live in recap + prep_notes instead (see migration 5's
    -- comment for why the split exists).
    CREATE TABLE IF NOT EXISTS session_notes (
      id                    TEXT PRIMARY KEY,
      session_number        INTEGER,
      title                 TEXT NOT NULL,
      content               TEXT NOT NULL DEFAULT '',
      recap                 TEXT NOT NULL DEFAULT '',
      prep_notes            TEXT NOT NULL DEFAULT '',
      linked_cards          TEXT NOT NULL DEFAULT '[]',
      linked_party_members  TEXT NOT NULL DEFAULT '[]',
      session_date          TEXT NOT NULL,
      created_at            TEXT NOT NULL
    );

    -- Plot hooks, promises, and "don't forget X" reminders that need to
    -- persist across sessions instead of getting buried inside one session's
    -- notes. Not tied to a session — a thread can live open for months.
    CREATE TABLE IF NOT EXISTS threads (
      id              TEXT PRIMARY KEY,
      text            TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
      linked_card_id  TEXT REFERENCES cards(id) ON DELETE SET NULL,
      linked_member_id TEXT REFERENCES party_members(id) ON DELETE SET NULL,
      created_at      TEXT NOT NULL,
      resolved_at     TEXT,
      sort_order      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL DEFAULT 0
    );
  `)
}

function runMigrations(): void {
  const d = getDb()

  let row = d.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
  if (!row) {
    d.prepare('INSERT INTO schema_version (version) VALUES (0)').run()
    row = { version: 0 }
  }

  const v = row.version

  if (v < 1) {
    // Add scale + grid offset columns to maps, create map_fog table
    const cols = d.prepare("PRAGMA table_info(maps)").all() as { name: string }[]
    const colNames = new Set(cols.map(c => c.name))
    if (!colNames.has('scale_pixels_per_unit')) d.exec('ALTER TABLE maps ADD COLUMN scale_pixels_per_unit REAL NOT NULL DEFAULT 50.0')
    if (!colNames.has('scale_feet_per_unit'))   d.exec('ALTER TABLE maps ADD COLUMN scale_feet_per_unit   REAL NOT NULL DEFAULT 5.0')
    if (!colNames.has('grid_offset_x'))         d.exec('ALTER TABLE maps ADD COLUMN grid_offset_x         REAL NOT NULL DEFAULT 0.0')
    if (!colNames.has('grid_offset_y'))         d.exec('ALTER TABLE maps ADD COLUMN grid_offset_y         REAL NOT NULL DEFAULT 0.0')

    d.exec(`
      CREATE TABLE IF NOT EXISTS map_fog (
        map_id     TEXT PRIMARY KEY REFERENCES maps(id) ON DELETE CASCADE,
        grid_cols  INTEGER NOT NULL DEFAULT 64,
        grid_rows  INTEGER NOT NULL DEFAULT 64,
        cells      TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      )
    `)
    d.prepare('UPDATE schema_version SET version = 1').run()
  }

  if (v < 2) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS encounter_state (
        id            INTEGER PRIMARY KEY DEFAULT 1,
        is_active     INTEGER NOT NULL DEFAULT 0,
        round         INTEGER NOT NULL DEFAULT 1,
        current_index INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS encounter_combatants (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        type            TEXT NOT NULL CHECK(type IN ('party','monster')),
        party_member_id TEXT REFERENCES party_members(id) ON DELETE CASCADE,
        hp_current      INTEGER,
        hp_max          INTEGER,
        ac              INTEGER,
        initiative      INTEGER,
        conditions      TEXT NOT NULL DEFAULT '[]',
        sort_order      INTEGER NOT NULL DEFAULT 0
      );
    `)
    d.prepare('UPDATE schema_version SET version = 2').run()
  }

  if (v < 3) {
    // Cards: lore-keeping columns
    const cardCols = d.prepare('PRAGMA table_info(cards)').all() as { name: string }[]
    const cardColNames = new Set(cardCols.map(c => c.name))
    if (!cardColNames.has('linked_cards')) d.exec("ALTER TABLE cards ADD COLUMN linked_cards TEXT NOT NULL DEFAULT '[]'")
    if (!cardColNames.has('parent_id'))    d.exec('ALTER TABLE cards ADD COLUMN parent_id TEXT REFERENCES cards(id) ON DELETE SET NULL')
    if (!cardColNames.has('dm_notes'))     d.exec("ALTER TABLE cards ADD COLUMN dm_notes TEXT NOT NULL DEFAULT ''")

    d.exec(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        day_number   INTEGER,
        date_display TEXT NOT NULL DEFAULT '',
        linked_cards TEXT NOT NULL DEFAULT '[]',
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_timeline_day ON timeline_events(day_number);
    `)
    d.prepare('UPDATE schema_version SET version = 3').run()
  }

  if (v < 4) {
    // Links a party member to a LoreKeeper Companion (player) app's stable
    // sync identity — that's what lets a connecting player auto-populate
    // the roster instead of the DM adding them by hand. NULL for any
    // member never claimed by a synced player.
    // SQLite's ALTER TABLE ADD COLUMN doesn't permit a UNIQUE constraint —
    // uniqueness here is enforced in linkOrCreatePartyMember() instead.
    const cols = d.prepare('PRAGMA table_info(party_members)').all() as { name: string }[]
    if (!cols.some((c) => c.name === 'client_id')) {
      d.exec('ALTER TABLE party_members ADD COLUMN client_id TEXT')
    }
    d.prepare('UPDATE schema_version SET version = 4').run()
  }

  if (v < 5) {
    // DM note-taking overhaul: private notes on party members (the one
    // entity type that never had them), a persistent Threads/plot-hooks
    // board, and splitting session notes' single blob into "what happened"
    // vs. "what to follow up on" so prep items don't get lost inside a
    // recap paragraph. New installs already have all of this via
    // createSchema() above.
    const memberCols = d.prepare('PRAGMA table_info(party_members)').all() as { name: string }[]
    if (!memberCols.some((c) => c.name === 'dm_notes')) {
      d.exec("ALTER TABLE party_members ADD COLUMN dm_notes TEXT NOT NULL DEFAULT ''")
    }

    const sessionCols = d.prepare('PRAGMA table_info(session_notes)').all() as { name: string }[]
    const sessionColNames = new Set(sessionCols.map((c) => c.name))
    if (!sessionColNames.has('recap')) {
      d.exec("ALTER TABLE session_notes ADD COLUMN recap TEXT NOT NULL DEFAULT ''")
      // Carry existing notes forward as the recap rather than losing them.
      d.exec('UPDATE session_notes SET recap = content')
    }
    if (!sessionColNames.has('prep_notes')) {
      d.exec("ALTER TABLE session_notes ADD COLUMN prep_notes TEXT NOT NULL DEFAULT ''")
    }
    if (!sessionColNames.has('linked_party_members')) {
      d.exec("ALTER TABLE session_notes ADD COLUMN linked_party_members TEXT NOT NULL DEFAULT '[]'")
    }

    d.exec(`
      CREATE TABLE IF NOT EXISTS threads (
        id              TEXT PRIMARY KEY,
        text            TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
        linked_card_id  TEXT REFERENCES cards(id) ON DELETE SET NULL,
        linked_member_id TEXT REFERENCES party_members(id) ON DELETE SET NULL,
        created_at      TEXT NOT NULL,
        resolved_at     TEXT,
        sort_order      INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
    `)

    d.prepare('UPDATE schema_version SET version = 5').run()
  }
}
