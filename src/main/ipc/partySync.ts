import { ipcMain } from 'electron'
import { readFileSync, statSync } from 'fs'
import { extname } from 'path'
import { randomUUID } from 'crypto'
import { getMainWin } from '../mainWindow'
import {
  startServer, stopServer, isRunning, getPlayers, getThreads, getRollResults, getCommandLog,
  getLanAddress, getLanAddresses, getServerError, onStateChange, onSnapshot, sendDmReply,
  sendCommand, broadcastCommand, configureAuth, clearRollResults
} from '../server'
import type { DmCommand } from '../server'
import { getSetting, setSetting } from '../settings'
import { linkOrCreatePartyMember } from './party'
import { syncPartyCombatantHp } from './encounter'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L lookalikes

function makeCode(): string {
  let out = ''
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return out
}

function loadAuth(): { requireCode: boolean; joinCode: string } {
  let code = getSetting('sync.joinCode')
  if (!code) {
    code = makeCode()
    setSetting('sync.joinCode', code)
  }
  // Default ON: anyone on the same WiFi can otherwise connect as a "player".
  const requireCode = getSetting('sync.requireCode') !== '0'
  return { requireCode, joinCode: code }
}

function buildState() {
  const auth = loadAuth()
  return {
    running: isRunning(),
    error: getServerError(),
    address: isRunning() ? getLanAddress() : null,
    addresses: isRunning() ? getLanAddresses() : [],
    players: getPlayers(),
    threads: getThreads(),
    rolls: getRollResults(),
    commandLog: getCommandLog(),
    requireCode: auth.requireCode,
    joinCode: auth.joinCode
  }
}

function pushUpdate(): void {
  const win = getMainWin()
  if (!win || win.isDestroyed()) return
  win.webContents.send('partySync:update', buildState())
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp'
}
const MAX_HANDOUT_BYTES = 3 * 1024 * 1024

// Reads a local image into a data URL so a handout can travel over the
// socket — the player's PC has no access to the DM's file paths.
function imageToDataUrl(path: string): { url?: string; error?: string } {
  try {
    const mime = MIME[extname(path).toLowerCase()]
    if (!mime) return { error: 'Handout images must be png, jpg, gif or webp.' }
    if (statSync(path).size > MAX_HANDOUT_BYTES) return { error: 'That image is over 3 MB — use a smaller one.' }
    return { url: `data:${mime};base64,${readFileSync(path).toString('base64')}` }
  } catch {
    return { error: "Couldn't read that image file." }
  }
}

export function registerPartySyncHandlers(): void {
  onStateChange(pushUpdate)
  onSnapshot((clientId, snapshot) => {
    const partyMemberId = linkOrCreatePartyMember(clientId, snapshot.name, snapshot.initiative)
    syncPartyCombatantHp(partyMemberId, snapshot.hp_current, snapshot.hp_max)
  })

  ipcMain.handle('partySync:start', () => {
    configureAuth(loadAuth())
    const result = startServer()
    pushUpdate()
    return { ...buildState(), ...result }
  })

  ipcMain.handle('partySync:stop', () => {
    stopServer()
    return { running: false }
  })

  ipcMain.handle('partySync:status', () => buildState())

  ipcMain.handle('partySync:reply', (_e, clientId: string, text: string) => sendDmReply(clientId, text))

  // ── Join code ──────────────────────────────────────────────────────────
  ipcMain.handle('partySync:setRequireCode', (_e, on: boolean) => {
    setSetting('sync.requireCode', on ? '1' : '0')
    configureAuth(loadAuth())
    pushUpdate()
    return buildState()
  })

  ipcMain.handle('partySync:regenerateCode', () => {
    setSetting('sync.joinCode', makeCode())
    configureAuth(loadAuth())
    pushUpdate()
    return buildState()
  })

  // ── DM → player commands ───────────────────────────────────────────────
  ipcMain.handle('partySync:command', (_e, clientId: string, command: DmCommand) => {
    const cmd =
      command.cmd === 'roll_request' && !command.rollId ? { ...command, rollId: randomUUID() } : command
    return sendCommand(clientId, cmd)
  })

  ipcMain.handle('partySync:broadcast', (_e, command: DmCommand, clientIds?: string[]) => {
    const cmd =
      command.cmd === 'roll_request' && !command.rollId ? { ...command, rollId: randomUUID() } : command
    return { sent: broadcastCommand(cmd, clientIds) }
  })

  ipcMain.handle(
    'partySync:handout',
    (_e, clientIds: string[] | null, data: { title: string; text: string; imagePath?: string | null }) => {
      let imageDataUrl: string | undefined
      if (data.imagePath) {
        const r = imageToDataUrl(data.imagePath)
        if (r.error) return { sent: 0, error: r.error }
        imageDataUrl = r.url
      }
      const sent = broadcastCommand(
        { cmd: 'handout', title: data.title, text: data.text, imageDataUrl },
        clientIds ?? undefined
      )
      return { sent }
    }
  )

  ipcMain.handle('partySync:clearRolls', () => {
    clearRollResults()
  })
}
