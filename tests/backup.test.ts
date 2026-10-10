import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, truncateSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { writeBackup, extractBackup } from '../src/main/backupCore'

function scratch() {
  return mkdtempSync(join(tmpdir(), 'lk-backup-test-'))
}

test('a backup round-trips the database and every image', () => {
  const dir = scratch()
  try {
    const db = randomBytes(300_000)
    const imgA = randomBytes(5_000_000) // spans several copy chunks
    const imgB = randomBytes(1234)
    writeFileSync(join(dir, 'snap.db'), db)
    writeFileSync(join(dir, 'map one.png'), imgA)
    writeFileSync(join(dir, 'avatar.jpg'), imgB)

    const dest = join(dir, 'out.lkbackup')
    const manifest = writeBackup(
      dest,
      join(dir, 'snap.db'),
      [join(dir, 'map one.png'), join(dir, 'avatar.jpg'), join(dir, 'map one.png'), join(dir, 'missing.png'), ''],
      'lorekeeper-dm'
    )
    assert.equal(manifest.files.length, 2, 'duplicates and missing files are skipped')

    const restored = extractBackup(dest, join(dir, 'restored.db'), join(dir, 'media'))
    assert.equal(restored.manifest.app, 'lorekeeper-dm')
    assert.ok(readFileSync(join(dir, 'restored.db')).equals(db), 'database bytes survive')
    const a = restored.pathMap[join(dir, 'map one.png')]
    const b = restored.pathMap[join(dir, 'avatar.jpg')]
    assert.ok(readFileSync(a).equals(imgA), 'large image survives')
    assert.ok(readFileSync(b).equals(imgB), 'small image survives')
    assert.ok(a.startsWith(join(dir, 'media')) && b.startsWith(join(dir, 'media')), 'images land in the media dir')
    assert.notEqual(a, b)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('files that are not backups are rejected with a clear message', () => {
  const dir = scratch()
  try {
    writeFileSync(join(dir, 'junk.lkbackup'), 'this is not a backup at all, just text')
    assert.throws(() => extractBackup(join(dir, 'junk.lkbackup'), join(dir, 'x.db'), join(dir, 'm')), /isn't a LoreKeeper backup/)
    writeFileSync(join(dir, 'empty.lkbackup'), '')
    assert.throws(() => extractBackup(join(dir, 'empty.lkbackup'), join(dir, 'x.db'), join(dir, 'm')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a truncated backup is detected instead of silently restoring half a campaign', () => {
  const dir = scratch()
  try {
    writeFileSync(join(dir, 'snap.db'), randomBytes(100_000))
    const dest = join(dir, 'out.lkbackup')
    writeBackup(dest, join(dir, 'snap.db'), [], 'lorekeeper-companion')
    truncateSync(dest, statSync(dest).size - 5000)
    assert.throws(() => extractBackup(dest, join(dir, 'r.db'), join(dir, 'm')), /incomplete/)
    assert.equal(existsSync(join(dir, 'r.db')), false, 'nothing is written for a bad backup')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hostile file names in a manifest cannot escape the media directory', () => {
  const dir = scratch()
  try {
    writeFileSync(join(dir, 'snap.db'), randomBytes(1000))
    writeFileSync(join(dir, '..evil.png'), randomBytes(100))
    const dest = join(dir, 'out.lkbackup')
    writeBackup(dest, join(dir, 'snap.db'), [join(dir, '..evil.png')], 'lorekeeper-dm')
    const { pathMap } = extractBackup(dest, join(dir, 'r.db'), join(dir, 'media'))
    for (const target of Object.values(pathMap)) {
      assert.ok(target.startsWith(join(dir, 'media')), `${target} escaped the media dir`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
