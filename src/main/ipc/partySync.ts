import { ipcMain } from 'electron'
import { readFileSync, statSync } from 'fs'
import { extname } from 'path'
import { randomUUID } from 'crypto'
import { getMainWin } from '../mainWindow'
import {
  startServer, stopServer, isRunning, getPlayers, getThreads, getRollResults, getCommandLog,
  getLanAddress, getLanAddresses, getServerError, onStateChange, onSnapshot, sendDmReply,
  sendCommand, broadcastCommand, configureAuth, clearRollResults, onRollResult, onPresence
} from '../server'
import type { DmCommand, RollResult } from '../server'
import { getSetting, setSetting } from '../settings'
import { linkOrCreatePartyMember } from './party'
import { syncFromSnapshot, applyInitiativeRoll } from './encounter'
import { logEvent } from '../sessionLog'

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

function nameOf(clientId: string): string {
  return getPlayers().find((p) => p.clientId === clientId)?.snapshot.name || 'A player'
}

function names(targets: string[] | undefined): string {
  const list = (targets ?? getPlayers().filter((p) => p.online).map((p) => p.clientId)).map(nameOf)
  if (list.length === 0) return 'nobody'
  return list.length > 3 ? `${list.length} players` : list.join(', ')
}

// What the DM sent, as one line for the session log.
function describeCommand(command: DmCommand, targets: string[] | undefined): string | null {
  const who = names(targets)
  switch (command.cmd) {
    case 'hp_delta':
      return command.amount < 0 ? `DM dealt ${Math.abs(command.amount)} damage to ${who}.` : `DM healed ${who} for ${command.amount}.`
    case 'condition':
      return `DM ${command.on ? 'applied' : 'removed'} ${command.condition} ${command.on ? 'to' : 'from'} ${who}.`
    case 'xp':
      return `${command.amount} XP to ${who}.`
    case 'currency': {
      const parts = (['pp', 'gp', 'ep', 'sp', 'cp'] as const).filter((k) => command[k]).map((k) => `${command[k]} ${k}`)
      return parts.length ? `${parts.join(', ')} to ${who}.` : null
    }
    case 'give_item':
      return `${command.quantity > 1 ? `${command.quantity}× ` : ''}${command.name} given to ${who}.`
    case 'inspiration':
      return `Inspiration ${command.on ? 'granted to' : 'spent by'} ${who}.`
    case 'rest':
      return `${command.kind === 'long' ? 'Long' : 'Short'} rest called.`
    case 'notice':
      return `Notice to ${who}: ${command.text}`
    case 'roll_request':
      return `Asked ${who} for: ${command.label}${command.dc ? ` (DC ${command.dc})` : ''}.`
    default:
      return null
  }
}

function logCommand(command: DmCommand, targets: string[] | undefined): void {
  const text = describeCommand(command, targets)
  if (!text) return
  const kind = command.cmd === 'xp' || command.cmd === 'currency' || command.cmd === 'give_item' ? 'reward'
    : command.cmd === 'hp_delta' ? (command.amount < 0 ? 'damage' : 'heal')
    : command.cmd === 'condition' ? 'condition'
    : command.cmd === 'roll_request' ? 'roll'
    : 'table'
  logEvent(kind, text, command.cmd === 'hp_delta' ? { amount: Math.abs(command.amount) } : undefined)
}

function logRoll(roll: RollResult): void {
  const outcome = roll.success == null ? '' : roll.success ? ' — success' : ' — fail'
  const nat = roll.natural === 20 ? ' (natural 20!)' : roll.natural === 1 ? ' (natural 1)' : ''
  logEvent('roll', `${roll.playerName} rolled ${roll.label}: ${roll.total}${nat}${roll.dc != null ? ` vs DC ${roll.dc}` : ''}${outcome}.`, {
    total: roll.total, natural: roll.natural, dc: roll.dc
  })
}

export function registerPartySyncHandlers(): void {
  onStateChange(pushUpdate)
  onSnapshot((clientId, snapshot) => {
    const partyMemberId = linkOrCreatePartyMember(clientId, snapshot.name, snapshot.initiative)
    syncFromSnapshot(partyMemberId, clientId, snapshot)
  })
  onRollResult((roll) => {
    logRoll(roll)
    // Initiative is rolled on the player's own device and lands on the tracker.
    if (roll.kind === 'initiative' || /^initiative$/i.test(roll.label)) applyInitiativeRoll(roll)
  })
  onPresence((_clientId, online, name) => {
    logEvent('player', `${name || 'A player'} ${online ? 'joined' : 'left'} the table.`)
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
    const res = sendCommand(clientId, cmd)
    if (res.ok) logCommand(cmd, [clientId])
    return res
  })

  ipcMain.handle('partySync:broadcast', (_e, command: DmCommand, clientIds?: string[]) => {
    const cmd =
      command.cmd === 'roll_request' && !command.rollId ? { ...command, rollId: randomUUID() } : command
    const sent = broadcastCommand(cmd, clientIds)
    if (sent > 0) logCommand(cmd, clientIds)
    return { sent }
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
      if (sent > 0) logEvent('table', `Handout "${data.title || 'Handout'}" shown to ${names(clientIds ?? undefined)}.`)
      return { sent }
    }
  )

  ipcMain.handle('partySync:clearRolls', () => {
    clearRollResults()
  })
}
