// Bundles each tests/*.test.ts with esbuild (so they can import the app's real
// TypeScript) and runs them with Node's built-in test runner:   npm test
//
// Two kinds of test:
//   *.test.ts           plain Node. Electron-only modules the sync client touches
//                       are swapped for stubs (tests/stubs/mainProcess.ts).
//   *.electron.test.ts  run inside Electron's own Node runtime (ELECTRON_RUN_AS_NODE),
//                       because better-sqlite3 is compiled against Electron's ABI.
//                       `electron` itself is stubbed (tests/stubs/electron.ts), so the
//                       real IPC handlers run against a real SQLite database.
import { build } from 'esbuild'
import { readdirSync, mkdirSync, rmSync, existsSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { createRequire } from 'module'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = join(here, '.out')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const syncStub = {
  name: 'sync-main-process-stubs',
  setup(b) {
    // Only the player's sync client reaches for these; give it fakes.
    b.onResolve({ filter: /^\.\.\/(mainWindow|db)$/ }, (args) =>
      args.importer.replace(/\\/g, '/').includes('/player-client/src/main/sync/')
        ? { path: join(here, 'stubs', 'mainProcess.ts') }
        : undefined
    )
  }
}

const electronStub = {
  name: 'electron-stubs',
  setup(b) {
    b.onResolve({ filter: /^electron$|^@electron-toolkit\/utils$/ }, () => ({ path: join(here, 'stubs', 'electron.ts') }))
  }
}

const all = readdirSync(here).filter((f) => f.endsWith('.test.ts'))
const plain = all.filter((f) => !f.endsWith('.electron.test.ts'))
const electronTests = all.filter((f) => f.endsWith('.electron.test.ts'))

async function bundle(f, plugins) {
  const outfile = join(outDir, f.replace(/\.ts$/, '.cjs'))
  await build({
    entryPoints: [join(here, f)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['ws', 'better-sqlite3'],
    plugins,
    nodePaths: [join(root, 'node_modules')],
    logLevel: 'error'
  })
  return outfile
}

let failed = false

if (plain.length) {
  const files = []
  for (const f of plain) files.push(await bundle(f, [syncStub]))
  const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', cwd: root })
  if (r.status !== 0) failed = true
}

if (electronTests.length) {
  const require = createRequire(import.meta.url)
  let electronBin
  try {
    electronBin = require('electron')
  } catch {
    electronBin = null
  }
  if (!electronBin || !existsSync(electronBin)) {
    console.error('Electron is not installed — skipping database tests.')
    failed = true
  } else {
    const files = []
    for (const f of electronTests) files.push(await bundle(f, [electronStub]))
    const r = spawnSync(electronBin, ['--test', ...files], {
      stdio: 'inherit',
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    })
    if (r.status !== 0) failed = true
  }
}

process.exit(failed ? 1 : 0)
