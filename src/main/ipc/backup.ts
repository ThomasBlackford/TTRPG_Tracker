import { app, dialog, ipcMain, shell } from 'electron'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'fs'
import { join } from 'path'
import { closeDb, getDb } from '../db'
import { writeBackup, extractBackup } from '../backupCore'

// Every column that stores a path to an image the app copied or referenced.
const IMAGE_COLUMNS: { table: string; column: string }[] = [
  { table: 'cards', column: 'image_path' },
  { table: 'maps', column: 'image_path' },
  { table: 'party_members', column: 'avatar_path' },
  { table: 'map_tokens', column: 'image_path' }
]

const KEEP_AUTO_BACKUPS = 10

function backupsDir(): string {
  const dir = join(app.getPath('userData'), 'backups')
  mkdirSync(dir, { recursive: true })
  return dir
}

function collectMediaPaths(): string[] {
  const db = getDb()
  const out: string[] = []
  for (const { table, column } of IMAGE_COLUMNS) {
    const rows = db.prepare(`SELECT DISTINCT ${column} AS p FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != ''`).all() as { p: string }[]
    for (const r of rows) out.push(r.p)
  }
  return out
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}

// One quiet database snapshot per day, keeping the most recent few. Cheap
// insurance against a bad update, a corrupt file, or an accidental delete —
// the manual export is for moving PCs and off-machine safekeeping.
export async function runAutoBackup(): Promise<void> {
  try {
    const dest = join(backupsDir(), `auto-${stamp()}.db`)
    if (!existsSync(dest)) await getDb().backup(dest)
    const files = readdirSync(backupsDir())
      .filter((f) => f.startsWith('auto-') && f.endsWith('.db'))
      .sort()
    for (const old of files.slice(0, Math.max(0, files.length - KEEP_AUTO_BACKUPS))) {
      try { unlinkSync(join(backupsDir(), old)) } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('[backup] auto backup failed:', e)
  }
}

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:export', async () => {
    const pick = await dialog.showSaveDialog({
      title: 'Save LoreKeeper backup',
      defaultPath: join(app.getPath('documents'), `lorekeeper-${stamp()}.lkbackup`),
      filters: [{ name: 'LoreKeeper backup', extensions: ['lkbackup'] }]
    })
    if (pick.canceled || !pick.filePath) return { ok: false, canceled: true }

    const tmp = join(app.getPath('temp'), `lk-snapshot-${Date.now()}.db`)
    try {
      await getDb().backup(tmp)
      const manifest = writeBackup(pick.filePath, tmp, collectMediaPaths(), 'lorekeeper-dm')
      return { ok: true, path: pick.filePath, files: manifest.files.length }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    } finally {
      try { unlinkSync(tmp) } catch { /* already gone */ }
    }
  })

  // Restores from a backup, then restarts the app so it opens the restored
  // data cleanly. The current database is saved aside first, never discarded.
  ipcMain.handle('backup:import', async () => {
    const pick = await dialog.showOpenDialog({
      title: 'Restore a LoreKeeper backup',
      properties: ['openFile'],
      filters: [{ name: 'LoreKeeper backup', extensions: ['lkbackup'] }]
    })
    if (pick.canceled || pick.filePaths.length === 0) return { ok: false, canceled: true }

    const userData = app.getPath('userData')
    const stagedDb = join(app.getPath('temp'), `lk-restore-${Date.now()}.db`)
    try {
      const { manifest, pathMap } = extractBackup(pick.filePaths[0], stagedDb, join(userData, 'images'))
      if (manifest.app !== 'lorekeeper-dm') {
        return { ok: false, error: 'That backup is from the player app, not the DM app.' }
      }

      // Repoint every image column at its new location on this machine.
      const staged = new Database(stagedDb)
      try {
        for (const { table, column } of IMAGE_COLUMNS) {
          const stmt = staged.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`)
          for (const [orig, now] of Object.entries(pathMap)) stmt.run(now, orig)
        }
        staged.pragma('wal_checkpoint(TRUNCATE)')
      } finally {
        staged.close()
      }

      // Keep the database we're replacing, just in case.
      const live = join(userData, 'lorekeeper.db')
      const aside = join(backupsDir(), `before-restore-${Date.now()}.db`)
      await getDb().backup(aside)
      closeDb()
      for (const suffix of ['', '-wal', '-shm']) {
        try { unlinkSync(live + suffix) } catch { /* may not exist */ }
      }
      copyFileSync(stagedDb, live)
      try { unlinkSync(stagedDb) } catch { /* ignore */ }

      app.relaunch()
      app.exit(0)
      return { ok: true }
    } catch (e) {
      try { unlinkSync(stagedDb) } catch { /* ignore */ }
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('backup:info', () => {
    const dir = backupsDir()
    const autos = readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const st = statSync(join(dir, f))
        return { name: f, size: st.size, modified: st.mtimeMs }
      })
      .sort((a, b) => b.modified - a.modified)
    return { dir, autos }
  })

  ipcMain.handle('backup:openFolder', () => {
    shell.openPath(backupsDir())
  })
}
