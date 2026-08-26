import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db'
import { setMainWin } from './mainWindow'
import { registerCardHandlers } from './ipc/cards'
import { registerPartyHandlers } from './ipc/party'
import { registerSessionHandlers } from './ipc/sessions'
import { registerSearchHandlers } from './ipc/search'
import { registerMapHandlers } from './ipc/maps'
import { registerEncounterHandlers } from './ipc/encounter'
import { registerTimelineHandlers } from './ipc/timeline'
import { registerPartySyncHandlers } from './ipc/partySync'
import { stopServer } from './server'

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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopServer()
  if (process.platform !== 'darwin') app.quit()
})
