import { ipcMain } from 'electron'
import { getMainWin } from '../mainWindow'
import {
  startServer, stopServer, isRunning, getPlayers, getThreads,
  getLanAddress, onStateChange, sendDmReply
} from '../server'

function pushUpdate(): void {
  const win = getMainWin()
  if (!win || win.isDestroyed()) return
  win.webContents.send('partySync:update', {
    running: isRunning(),
    address: isRunning() ? getLanAddress() : null,
    players: getPlayers(),
    threads: getThreads()
  })
}

export function registerPartySyncHandlers(): void {
  onStateChange(pushUpdate)

  ipcMain.handle('partySync:start', () => {
    const result = startServer()
    pushUpdate()
    return {
      ...result,
      running: isRunning(),
      address: isRunning() ? getLanAddress() : null
    }
  })

  ipcMain.handle('partySync:stop', () => {
    stopServer()
    return { running: false }
  })

  ipcMain.handle('partySync:status', () => ({
    running: isRunning(),
    address: isRunning() ? getLanAddress() : null,
    players: getPlayers(),
    threads: getThreads()
  }))

  ipcMain.handle('partySync:reply', (_e, clientId: string, text: string) => sendDmReply(clientId, text))
}
