import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db'
import { setMainWin, getMainWin } from './mainWindow'
import { registerCardHandlers } from './ipc/cards'
import { registerPartyHandlers } from './ipc/party'
import { registerSessionHandlers } from './ipc/sessions'
import { registerSearchHandlers } from './ipc/search'
import { registerMapHandlers } from './ipc/maps'
import { registerEncounterHandlers } from './ipc/encounter'
import { registerTimelineHandlers } from './ipc/timeline'
import { registerPartySyncHandlers } from './ipc/partySync'
import { registerThreadHandlers } from './ipc/threads'
import { registerUpdaterHandlers } from './ipc/updater'
import { stopServer } from './server'
import { initAutoUpdater } from './updater'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  })

  setMainWin(win)

  // Without this, the module-level reference in mainWindow.ts keeps pointing
  // at this window after it's closed — a stale, destroyed BrowserWindow. If
  // the app hasn't fully exited yet (window-all-closed and app.quit() are
  // async) and the exe is launched again in that window, the single-instance
  // 'second-instance' handler below would call .isMinimized()/.focus() on
  // that destroyed object and throw "Object has been destroyed" instead of
  // opening anything.
  win.on('closed', () => {
    if (getMainWin() === win) setMainWin(null)
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// A second launch (double-clicked by accident, or opened again without
// noticing it was already running) would bind the sync server's port a
// second time and fail confusingly. Redirect it to focus the existing
// window instead of starting a second copy of the app.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWin()
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.focus()
    } else {
      createWindow()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.lorekeeper.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    initDb(app.getPath('userData'))

    registerCardHandlers()
    registerPartyHandlers()
    registerSessionHandlers()
    registerSearchHandlers()
    registerMapHandlers()
    registerEncounterHandlers()
    registerTimelineHandlers()
    registerPartySyncHandlers()
    registerThreadHandlers()
    registerUpdaterHandlers()

    createWindow()

    // Skipped outside a packaged build — there's no update feed to check
    // against in dev, and electron-updater errors loudly if it tries.
    if (app.isPackaged) initAutoUpdater()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    stopServer()
    if (process.platform !== 'darwin') app.quit()
  })
}
