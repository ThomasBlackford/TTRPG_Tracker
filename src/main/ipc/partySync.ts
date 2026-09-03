import { ipcMain } from 'electron'
import { getMainWin } from '../mainWindow'
import {
  startServer, stopServer, isRunning, getPlayers, getThreads,
  getLanAddress, getLanAddresses, onStateChange, onSnapshot, sendDmReply
} from '../server'
import { linkOrCreatePartyMember } from './party'
import { syncPartyCombatantHp } from './encounter'

function pushUpdate(): void {
  const win = getMainWin()
  if (!win || win.isDestroyed()) return
  win.webContents.send('partySync:update', {
    running: isRunning(),
    address: isRunning() ? getLanAddress() : null,
    addresses: isRunning() ? getLanAddresses() : [],
    players: getPlayers(),
    threads: getThreads()
  })
}

export function registerPartySyncHandlers(): void {
  onStateChange(pushUpdate)
  onSnapshot((clientId, snapshot) => {
    const partyMemberId = linkOrCreatePartyMember(clientId, snapshot.name, snapshot.initiative)
    syncPartyCombatantHp(partyMemberId, snapshot.hp_current, snapshot.hp_max)
  })

  ipcMain.handle('partySync:start', () => {
    const result = startServer()
    pushUpdate()
    return {
      ...result,
      running: isRunning(),
      address: isRunning() ? getLanAddress() : null,
      addresses: isRunning() ? getLanAddresses() : []
    }
  })

  ipcMain.handle('partySync:stop', () => {
    stopServer()
    return { running: false }
  })

  ipcMain.handle('partySync:status', () => ({
    running: isRunning(),
    address: isRunning() ? getLanAddress() : null,
    addresses: isRunning() ? getLanAddresses() : [],
    players: getPlayers(),
    threads: getThreads()
  }))

  ipcMain.handle('partySync:reply', (_e, clientId: string, text: string) => sendDmReply(clientId, text))
}
