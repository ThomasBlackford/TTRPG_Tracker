import { app, dialog, ipcMain } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { buildHomebrewFile, cleanItem, parseHomebrew } from '../homebrewCore'
import type { HomebrewItem, HomebrewMonster } from '../homebrewCore'
import { clearLog, listLog, logEvent, renderLog, summarizeFight } from '../sessionLog'

// Homebrew items, saved encounters, the homebrew share file, and the session
// log's own handlers. (Monster templates live with the encounter handlers.)

interface ItemRow {
  id: string
  name: string
  category: string
  rarity: string
  attunement: number
  description: string
  damage: string
  damage_type: string
  value_gp: number
  created_at: string
}

function toItem(r: ItemRow) {
  return { ...r, attunement: r.attunement === 1 }
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return (JSON.parse(raw || '') ?? fallback) as T
  } catch {
    return fallback
  }
}

function monsterRows(): HomebrewMonster[] {
  const rows = getDb().prepare('SELECT * FROM monster_templates ORDER BY name COLLATE NOCASE').all() as Record<string, unknown>[]
  return rows.map((r) => ({
    name: String(r.name),
    ac: (r.ac as number | null) ?? null,
    hp: (r.hp as number | null) ?? null,
    init_mod: Number(r.init_mod) || 0,
    cr: String(r.cr ?? ''),
    xp: Number(r.xp) || 0,
    notes: String(r.notes ?? ''),
    legendary_actions: Number(r.legendary_actions) || 0,
    legendary_resistances: Number(r.legendary_resistances) || 0,
    recharges: parseJson<{ name: string; min: number }[]>(String(r.recharges ?? ''), []),
    lair: r.lair === 1,
    statblock: r.statblock ? parseJson<Record<string, unknown> | null>(String(r.statblock), null) : null
  }))
}

function itemRows(): HomebrewItem[] {
  return (getDb().prepare('SELECT * FROM custom_items ORDER BY name COLLATE NOCASE').all() as ItemRow[]).map((r) => ({
    name: r.name,
    category: r.category,
    rarity: r.rarity,
    attunement: r.attunement === 1,
    description: r.description,
    damage: r.damage,
    damage_type: r.damage_type,
    value_gp: r.value_gp
  }))
}

export function registerLibraryHandlers(): void {
  // ── Homebrew items ────────────────────────────────────────────────────────
  ipcMain.handle('items:list', () => (getDb().prepare('SELECT * FROM custom_items ORDER BY name COLLATE NOCASE').all() as ItemRow[]).map(toItem))

  ipcMain.handle('items:save', (_e, raw: Record<string, unknown>) => {
    const db = getDb()
    const item = cleanItem(raw)
    if (!item) throw new Error('An item needs a name.')
    const id = typeof raw.id === 'string' && raw.id ? raw.id : uuidv4()
    const exists = db.prepare('SELECT 1 FROM custom_items WHERE id=?').get(id)
    if (exists) {
      db.prepare('UPDATE custom_items SET name=?, category=?, rarity=?, attunement=?, description=?, damage=?, damage_type=?, value_gp=? WHERE id=?').run(
        item.name, item.category, item.rarity, item.attunement ? 1 : 0, item.description, item.damage, item.damage_type, item.value_gp, id
      )
    } else {
      db.prepare(
        'INSERT INTO custom_items (id, name, category, rarity, attunement, description, damage, damage_type, value_gp, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
      ).run(id, item.name, item.category, item.rarity, item.attunement ? 1 : 0, item.description, item.damage, item.damage_type, item.value_gp, new Date().toISOString())
    }
    return toItem(db.prepare('SELECT * FROM custom_items WHERE id=?').get(id) as ItemRow)
  })

  ipcMain.handle('items:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM custom_items WHERE id=?').run(id)
  })

  // ── Saved encounters ──────────────────────────────────────────────────────
  ipcMain.handle('savedEncounters:list', () =>
    (getDb().prepare('SELECT * FROM saved_encounters ORDER BY name COLLATE NOCASE').all() as { id: string; name: string; notes: string; entries: string; created_at: string; updated_at: string }[]).map(
      (r) => ({ ...r, entries: parseJson<unknown[]>(r.entries, []) })
    )
  )

  ipcMain.handle('savedEncounters:save', (_e, enc: { id?: string; name: string; notes?: string; entries: unknown[] }) => {
    const db = getDb()
    const id = enc.id ?? uuidv4()
    const now = new Date().toISOString()
    const entries = JSON.stringify(Array.isArray(enc.entries) ? enc.entries : [])
    const name = (enc.name || 'Encounter').trim().slice(0, 120)
    if (db.prepare('SELECT 1 FROM saved_encounters WHERE id=?').get(id)) {
      db.prepare('UPDATE saved_encounters SET name=?, notes=?, entries=?, updated_at=? WHERE id=?').run(name, enc.notes ?? '', entries, now, id)
    } else {
      db.prepare('INSERT INTO saved_encounters (id, name, notes, entries, created_at, updated_at) VALUES (?,?,?,?,?,?)').run(id, name, enc.notes ?? '', entries, now, now)
    }
    const r = db.prepare('SELECT * FROM saved_encounters WHERE id=?').get(id) as { id: string; name: string; notes: string; entries: string }
    return { ...r, entries: parseJson<unknown[]>(r.entries, []) }
  })

  ipcMain.handle('savedEncounters:delete', (_e, id: string) => {
    getDb().prepare('DELETE FROM saved_encounters WHERE id=?').run(id)
  })

  // ── Homebrew file ─────────────────────────────────────────────────────────
  ipcMain.handle('homebrew:export', async () => {
    const monsters = monsterRows()
    const items = itemRows()
    if (monsters.length === 0 && items.length === 0) return { ok: false, error: 'You have no homebrew monsters or items to export yet.' }
    const pick = await dialog.showSaveDialog({
      title: 'Export homebrew',
      defaultPath: join(app.getPath('documents'), `lorekeeper-homebrew-${new Date().toISOString().slice(0, 10)}.json`),
      filters: [{ name: 'LoreKeeper homebrew', extensions: ['json'] }]
    })
    if (pick.canceled || !pick.filePath) return { ok: false, canceled: true }
    try {
      writeFileSync(pick.filePath, JSON.stringify(buildHomebrewFile(monsters, items), null, 2), 'utf8')
      return { ok: true, path: pick.filePath, monsters: monsters.length, items: items.length }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Could not write the file.' }
    }
  })

  // Imports by name: an entry whose name already exists is replaced, so
  // re-importing an updated file updates rather than duplicates.
  ipcMain.handle('homebrew:import', async () => {
    const pick = await dialog.showOpenDialog({
      title: 'Import homebrew',
      properties: ['openFile'],
      filters: [{ name: 'LoreKeeper homebrew', extensions: ['json'] }]
    })
    if (pick.canceled || pick.filePaths.length === 0) return { ok: false, canceled: true }
    let json: unknown
    try {
      json = JSON.parse(readFileSync(pick.filePaths[0], 'utf8'))
    } catch {
      return { ok: false, error: "That file isn't valid JSON." }
    }
    const parsed = parseHomebrew(json)
    if (parsed.error) return { ok: false, error: parsed.error }

    const db = getDb()
    const now = new Date().toISOString()
    let added = 0
    let updated = 0
    db.transaction(() => {
      for (const m of parsed.monsters) {
        const existing = db.prepare('SELECT id FROM monster_templates WHERE name=? COLLATE NOCASE').get(m.name) as { id: string } | undefined
        const args = [m.name, m.ac, m.hp, m.init_mod, m.cr, m.xp, m.notes, m.legendary_actions, m.legendary_resistances, JSON.stringify(m.recharges), m.lair ? 1 : 0, m.statblock ? JSON.stringify(m.statblock) : '']
        if (existing) {
          db.prepare('UPDATE monster_templates SET name=?, ac=?, hp=?, init_mod=?, cr=?, xp=?, notes=?, legendary_actions=?, legendary_resistances=?, recharges=?, lair=?, statblock=? WHERE id=?').run(...args, existing.id)
          updated++
        } else {
          db.prepare(
            'INSERT INTO monster_templates (id, name, ac, hp, init_mod, cr, xp, notes, legendary_actions, legendary_resistances, recharges, lair, statblock, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
          ).run(uuidv4(), ...args, now)
          added++
        }
      }
      for (const i of parsed.items) {
        const existing = db.prepare('SELECT id FROM custom_items WHERE name=? COLLATE NOCASE').get(i.name) as { id: string } | undefined
        const args = [i.name, i.category, i.rarity, i.attunement ? 1 : 0, i.description, i.damage, i.damage_type, i.value_gp]
        if (existing) {
          db.prepare('UPDATE custom_items SET name=?, category=?, rarity=?, attunement=?, description=?, damage=?, damage_type=?, value_gp=? WHERE id=?').run(...args, existing.id)
          updated++
        } else {
          db.prepare(
            'INSERT INTO custom_items (id, name, category, rarity, attunement, description, damage, damage_type, value_gp, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
          ).run(uuidv4(), ...args, now)
          added++
        }
      }
    })()
    return { ok: true, added, updated, skipped: parsed.skipped, monsters: parsed.monsters.length, items: parsed.items.length }
  })

  // ── Session log ───────────────────────────────────────────────────────────
  ipcMain.handle('log:list', (_e, opts?: { limit?: number; groupId?: string }) => listLog(opts ?? {}))
  ipcMain.handle('log:clear', () => { clearLog() })
  ipcMain.handle('log:text', (_e, groupId?: string) => renderLog(listLog(groupId != null ? { groupId, limit: 5000 } : { limit: 5000 })))

  // Turns a fight (or, with no id, the current one) into a Timeline entry.
  ipcMain.handle('log:toTimeline', (_e, groupId: string) => {
    const entries = listLog({ groupId, limit: 5000 })
    if (entries.length === 0) return { ok: false, error: 'Nothing was logged for that fight.' }
    const { title, body } = summarizeFight(entries)
    const db = getDb()
    const now = new Date().toISOString()
    const day = (db.prepare('SELECT MAX(day_number) AS d FROM timeline_events').get() as { d: number | null }).d
    const id = uuidv4()
    db.prepare(
      'INSERT INTO timeline_events (id, title, description, day_number, date_display, linked_cards, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, title, body, day ?? null, new Date(entries[0].at).toLocaleDateString(), '[]', now, now)
    logEvent('table', `Saved "${title}" to the Timeline.`)
    return { ok: true, id, title }
  })
}
