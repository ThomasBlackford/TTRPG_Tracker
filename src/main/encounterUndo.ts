import type Database from 'better-sqlite3'
import type { DmCommand } from './server'

// Undo / redo for the initiative tracker. Every change to a fight snapshots the
// whole (small) combat state first, so stepping back is exact rather than a
// pile of hand-written inverses. The one thing a snapshot can't cover is a
// player's own sheet — damage or a condition pushed to their app — so those
// carry the opposite command to send back.

type Row = Record<string, unknown>

export interface PlayerCmd {
  clientId: string
  command: DmCommand
}

export interface Snapshot {
  state: Row | null
  combatants: Row[]
  tokens: Row[] // tokens tied to a combatant, so removing one and undoing brings its token back
}

export interface UndoEntry {
  label: string
  before: Snapshot
  after: Snapshot | null
  undoCmds: PlayerCmd[]
  redoCmds: PlayerCmd[]
}

const LIMIT = 60
let undoStack: UndoEntry[] = []
let redoStack: UndoEntry[] = []

type Db = Database.Database

export function takeSnapshot(db: Db): Snapshot {
  return {
    state: (db.prepare('SELECT * FROM encounter_state WHERE id = 1').get() as Row | undefined) ?? null,
    combatants: db.prepare('SELECT * FROM encounter_combatants').all() as Row[],
    tokens: db.prepare('SELECT * FROM map_tokens WHERE combatant_id IS NOT NULL').all() as Row[]
  }
}

function insertRows(db: Db, table: string, rows: Row[]): void {
  for (const row of rows) {
    const cols = Object.keys(row)
    db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map((c) => row[c] as never))
  }
}

// Returns the map ids whose tokens changed, so the TV can be refreshed.
export function restoreSnapshot(db: Db, snap: Snapshot): string[] {
  const touched = new Set<string>()
  const tx = db.transaction(() => {
    for (const t of db.prepare('SELECT DISTINCT map_id FROM map_tokens WHERE combatant_id IS NOT NULL').all() as { map_id: string }[]) touched.add(t.map_id)
    for (const t of snap.tokens) touched.add(String(t.map_id))
    db.prepare('DELETE FROM map_tokens WHERE combatant_id IS NOT NULL').run()
    db.prepare('DELETE FROM encounter_combatants').run()
    insertRows(db, 'encounter_combatants', snap.combatants)
    insertRows(db, 'map_tokens', snap.tokens)
    if (snap.state) {
      db.prepare('UPDATE encounter_state SET is_active=?, round=?, current_index=?, log_id=? WHERE id=1').run(
        snap.state.is_active as number,
        snap.state.round as number,
        snap.state.current_index as number,
        (snap.state.log_id as string) ?? ''
      )
    }
  })
  tx()
  return [...touched]
}

export function pushUndo(entry: { label: string; before: Snapshot; undoCmds?: PlayerCmd[]; redoCmds?: PlayerCmd[] }): void {
  undoStack.push({ label: entry.label, before: entry.before, after: null, undoCmds: entry.undoCmds ?? [], redoCmds: entry.redoCmds ?? [] })
  if (undoStack.length > LIMIT) undoStack.shift()
  redoStack = []
}

export function resetUndo(): void {
  undoStack = []
  redoStack = []
}

export function undoInfo(): { canUndo: boolean; canRedo: boolean; undoLabel: string; redoLabel: string } {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack[undoStack.length - 1]?.label ?? '',
    redoLabel: redoStack[redoStack.length - 1]?.label ?? ''
  }
}

export interface Stepped {
  label: string
  cmds: PlayerCmd[]
  maps: string[]
}

export function stepBack(db: Db): Stepped | null {
  const entry = undoStack.pop()
  if (!entry) return null
  entry.after = takeSnapshot(db)
  const maps = restoreSnapshot(db, entry.before)
  redoStack.push(entry)
  return { label: entry.label, cmds: entry.undoCmds, maps }
}

export function stepForward(db: Db): Stepped | null {
  const entry = redoStack.pop()
  if (!entry || !entry.after) return null
  const maps = restoreSnapshot(db, entry.after)
  undoStack.push(entry)
  return { label: entry.label, cmds: entry.redoCmds, maps }
}
