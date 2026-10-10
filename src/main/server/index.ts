import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'

export const PARTY_SYNC_PORT = 47337
export const PROTOCOL_VERSION = 2

export interface PlayerSnapshot {
  name: string
  race: string
  class: string
  level: number
  ac: number | null
  initiative: number | null
  hp_current: number | null
  hp_max: number | null
  hp_temp: number
  inspiration: boolean
  death_save_successes?: number
  death_save_failures?: number
  concentration?: string
  exhaustion?: number
  xp?: number
  spellSlots: { level: number; max: number; current: number }[]
  resources: { id: string; name: string; current: number; max: number; color: string }[]
  conditions: string[]
}

export interface ConnectedPlayer {
  clientId: string
  snapshot: PlayerSnapshot
  lastSeen: number
  // Players stay on the roster after a disconnect (greyed out, with a
  // last-seen time) instead of vanishing — a WiFi blip shouldn't look like
  // someone left the table.
  online: boolean
}

export interface DmThreadMessage {
  from: 'player' | 'dm'
  text: string
  at: number
}

export interface DmThread {
  clientId: string
  playerName: string
  messages: DmThreadMessage[]
}

export type RollKind = 'save' | 'check' | 'skill' | 'initiative' | 'custom'

// Everything the DM can push onto a player's sheet or screen. The player's
// app applies these itself (so they persist) and acknowledges.
export type DmCommand =
  | { cmd: 'hp_delta'; amount: number; note?: string } // negative = damage, positive = healing
  | { cmd: 'condition'; condition: string; on: boolean }
  | { cmd: 'currency'; cp?: number; sp?: number; ep?: number; gp?: number; pp?: number }
  | { cmd: 'xp'; amount: number }
  | { cmd: 'inspiration'; on: boolean }
  | { cmd: 'rest'; kind: 'short' | 'long' }
  | { cmd: 'give_item'; name: string; quantity: number; notes?: string; damage?: string; damage_type?: string }
  | {
      cmd: 'roll_request'
      rollId: string
      label: string
      kind: RollKind
      ability?: string // str|dex|con|int|wis|cha
      skill?: string
      dc?: number | null
    }
  | { cmd: 'turn'; state: 'your_turn' | 'up_next'; round: number }
  | { cmd: 'handout'; title: string; text: string; imageDataUrl?: string }
  | { cmd: 'notice'; text: string }

export interface RollResult {
  rollId: string
  clientId: string
  playerName: string
  label: string
  total: number
  natural: number
  modifier: number
  dc: number | null
  success: boolean | null
  at: number
}

export interface CommandAck {
  id: string
  clientId: string
  ok: boolean
  summary: string
  at: number
}

let wss: WebSocketServer | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let lastServerError: string | null = null
const HEARTBEAT_MS = 20000
// Sockets that haven't answered the last ping — terminated on the next tick.
const alive = new WeakMap<WebSocket, boolean>()
const authed = new WeakSet<WebSocket>()

let requireCode = false
let joinCode = ''

// Keyed by the player's persistent client_id (sent with every message), not
// by the raw WebSocket — that's what lets a reconnect (WiFi hiccup, app
// restart) resume the same thread instead of starting a new one.
const liveConnections = new Map<string, WebSocket>() // clientId -> live socket, while connected
const players = new Map<string, ConnectedPlayer>() // clientId -> latest snapshot (kept after disconnect)
const dmThreads = new Map<string, DmThread>() // clientId -> conversation, persists across disconnects
const rollResults: RollResult[] = []
const commandLog: CommandAck[] = []

let listener: (() => void) | null = null
let snapshotListener: ((clientId: string, snapshot: PlayerSnapshot) => void) | null = null

function notify(): void {
  listener?.()
}

export function onStateChange(cb: () => void): void {
  listener = cb
}

// Fired whenever a snapshot is processed — this is what drives the party
// roster auto-populating from connecting players instead of the DM adding
// members by hand. See ipc/partySync.ts.
export function onSnapshot(cb: (clientId: string, snapshot: PlayerSnapshot) => void): void {
  snapshotListener = cb
}

export function configureAuth(cfg: { requireCode: boolean; joinCode: string }): void {
  const tightened = cfg.requireCode && (!requireCode || cfg.joinCode !== joinCode)
  requireCode = cfg.requireCode
  joinCode = cfg.joinCode
  // Tightening auth (turning the code on, or changing it) drops everyone who
  // joined under the old rules; their apps reconnect and are checked again.
  if (tightened && wss) {
    for (const client of wss.clients) client.terminate()
  }
}

export function getAuthConfig(): { requireCode: boolean; joinCode: string } {
  return { requireCode, joinCode }
}

function getOrCreateThread(clientId: string, playerName: string): DmThread {
  let thread = dmThreads.get(clientId)
  if (!thread) {
    thread = { clientId, playerName, messages: [] }
    dmThreads.set(clientId, thread)
  } else {
    thread.playerName = playerName
  }
  return thread
}

function dropSocket(ws: WebSocket): void {
  for (const [clientId, socket] of liveConnections) {
    if (socket === ws) {
      liveConnections.delete(clientId)
      const p = players.get(clientId)
      if (p) p.online = false
      break
    }
  }
  notify()
}

export function getServerError(): string | null {
  return lastServerError
}

function reject(ws: WebSocket, reason: string): void {
  try {
    ws.send(JSON.stringify({ type: 'auth_failed', reason }))
    ws.close(4001, reason)
  } catch {
    ws.terminate()
  }
}

export function startServer(): { ok: boolean; error?: string } {
  if (wss) return { ok: true }
  lastServerError = null

  let server: WebSocketServer
  try {
    server = new WebSocketServer({ host: '0.0.0.0', port: PARTY_SYNC_PORT })
  } catch (e) {
    wss = null
    lastServerError = e instanceof Error ? e.message : String(e)
    return { ok: false, error: lastServerError }
  }
  wss = server

  // Listen errors (a second LoreKeeper already holding the port → EADDRINUSE,
  // or a permission problem) are emitted asynchronously, so the try/catch
  // above never sees them. With no 'error' listener Node throws them as an
  // uncaught exception — the "JavaScript error in the main process" dialog.
  server.on('error', (e: NodeJS.ErrnoException) => {
    lastServerError =
      e.code === 'EADDRINUSE'
        ? `Port ${PARTY_SYNC_PORT} is already in use — is another copy of LoreKeeper running?`
        : e.message
    console.error('[partySync] server error:', e)
    try { server.close() } catch { /* already closed */ }
    if (wss === server) wss = null
    liveConnections.clear()
    for (const p of players.values()) p.online = false
    notify()
  })

  // A player whose laptop sleeps or drops off WiFi leaves a half-open TCP
  // connection that can linger for minutes — ping, and drop whoever doesn't
  // answer, so the roster reflects who's actually there.
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = setInterval(() => {
    for (const client of server.clients) {
      if (alive.get(client) === false) { client.terminate(); continue }
      alive.set(client, false)
      try { client.ping() } catch { /* closing */ }
    }
  }, HEARTBEAT_MS)

  server.on('connection', (ws) => {
    alive.set(ws, true)
    // With no join code required, every socket is trusted from the start
    // (older Companion builds never send a hello).
    if (!requireCode) authed.add(ws)
    ws.on('pong', () => alive.set(ws, true))

    ws.on('message', (raw) => {
      alive.set(ws, true)
      let msg: Record<string, unknown>
      try {
        const parsed = JSON.parse(raw.toString())
        // `null`, numbers and strings are valid JSON but not messages — and
        // reading `.clientId` off them would throw.
        if (!parsed || typeof parsed !== 'object') return
        msg = parsed
      } catch {
        return // ignore malformed frames rather than crash the server
      }

      if (msg.type === 'hello') {
        if (requireCode) {
          const given = typeof msg.code === 'string' ? msg.code.trim().toUpperCase() : ''
          if (!given) return reject(ws, 'This game needs a join code — ask the DM for it.')
          if (given !== joinCode.toUpperCase()) return reject(ws, 'Wrong join code.')
        }
        authed.add(ws)
        // The hello already says who this is, so register the socket now —
        // otherwise the DM couldn't send this player anything until their
        // first data message arrived.
        if (typeof msg.clientId === 'string' && msg.clientId) {
          const previous = liveConnections.get(msg.clientId)
          if (previous && previous !== ws) {
            try { previous.terminate() } catch { /* gone */ }
          }
          liveConnections.set(msg.clientId, ws)
          const known = players.get(msg.clientId)
          if (known) { known.online = true; known.lastSeen = Date.now(); notify() }
        }
        try { ws.send(JSON.stringify({ type: 'hello_ok', protocol: PROTOCOL_VERSION })) } catch { /* closing */ }
        return
      }

      if (!authed.has(ws)) {
        return reject(ws, 'This game needs a join code — update LoreKeeper Companion and enter the code the DM gives you.')
      }

      const clientId = typeof msg.clientId === 'string' && msg.clientId ? msg.clientId : null
      if (!clientId) return // can't attribute this message to anyone, drop it

      // A reconnect from a new socket replaces the old one outright.
      const previous = liveConnections.get(clientId)
      if (previous && previous !== ws) {
        try { previous.terminate() } catch { /* gone */ }
      }
      liveConnections.set(clientId, ws)
      const known = players.get(clientId)
      if (known) { known.online = true; known.lastSeen = Date.now() }

      if (msg.type === 'snapshot' && msg.data && typeof msg.data === 'object') {
        const snapshot = msg.data as PlayerSnapshot
        players.set(clientId, { clientId, snapshot, lastSeen: Date.now(), online: true })
        // The listener touches the DB (party roster, combat HP); a bad row
        // shouldn't take the whole server down with an uncaught exception.
        try {
          snapshotListener?.(clientId, snapshot)
        } catch (e) {
          console.error('[partySync] snapshot handler failed:', e)
        }
        notify()
      } else if (msg.type === 'dm_message' && typeof msg.text === 'string') {
        const playerName = players.get(clientId)?.snapshot.name ?? 'Unknown player'
        const thread = getOrCreateThread(clientId, playerName)
        thread.messages.push({ from: 'player', text: msg.text, at: Date.now() })
        notify()
      } else if (msg.type === 'party_message' && typeof msg.text === 'string') {
        // Relayed to every OTHER connected player only — this never touches
        // `dmThreads` or the DM's own renderer, by construction, so there's
        // no path for the DM app to see party-chat contents.
        const fromName = players.get(clientId)?.snapshot.name ?? 'A player'
        const payload = JSON.stringify({ type: 'party_message', from: fromName, text: msg.text, at: Date.now() })
        for (const [otherId, client] of liveConnections) {
          if (otherId !== clientId && client.readyState === WebSocket.OPEN) client.send(payload)
        }
      } else if (msg.type === 'roll_result' && typeof msg.total === 'number') {
        const dc = typeof msg.dc === 'number' ? msg.dc : null
        const total = msg.total
        rollResults.push({
          rollId: typeof msg.rollId === 'string' ? msg.rollId : randomUUID(),
          clientId,
          playerName: players.get(clientId)?.snapshot.name ?? 'Unknown player',
          label: typeof msg.label === 'string' ? msg.label.slice(0, 80) : 'Roll',
          total,
          natural: typeof msg.natural === 'number' ? msg.natural : total,
          modifier: typeof msg.modifier === 'number' ? msg.modifier : 0,
          dc,
          success: dc == null ? null : total >= dc,
          at: Date.now()
        })
        if (rollResults.length > 150) rollResults.splice(0, rollResults.length - 150)
        notify()
      } else if (msg.type === 'command_ack' && typeof msg.id === 'string') {
        commandLog.push({
          id: msg.id,
          clientId,
          ok: msg.ok !== false,
          summary: typeof msg.summary === 'string' ? msg.summary.slice(0, 160) : '',
          at: Date.now()
        })
        if (commandLog.length > 80) commandLog.splice(0, commandLog.length - 80)
        notify()
      }
    })

    ws.on('close', () => dropSocket(ws))
    ws.on('error', () => dropSocket(ws))
  })

  return { ok: true }
}

export function stopServer(): void {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  lastServerError = null
  // wss.close() only stops accepting NEW connections — existing players stay
  // attached unless terminated, which would leave a "stopped" server still
  // relaying chat.
  wss?.clients.forEach((c) => c.terminate())
  wss?.close()
  wss = null
  liveConnections.clear()
  for (const p of players.values()) p.online = false
  // dmThreads intentionally survives a stop/start — it's the DM's message
  // archive, not connection state.
  notify()
}

export function isRunning(): boolean {
  return wss !== null
}

export function getPlayers(): ConnectedPlayer[] {
  return Array.from(players.values())
}

export function getThreads(): DmThread[] {
  return Array.from(dmThreads.values())
}

export function getRollResults(): RollResult[] {
  return rollResults
}

export function getCommandLog(): CommandAck[] {
  return commandLog
}

export function clearRollResults(): void {
  rollResults.length = 0
  notify()
}

// Sends a DM reply into a specific player's thread. Still recorded even if
// the player isn't currently connected — it'll be there when they
// reconnect — but only actually delivered live if they are.
export function sendDmReply(clientId: string, text: string): { ok: boolean; error?: string } {
  const playerName = players.get(clientId)?.snapshot.name ?? dmThreads.get(clientId)?.playerName ?? 'Unknown player'
  const thread = getOrCreateThread(clientId, playerName)
  thread.messages.push({ from: 'dm', text, at: Date.now() })

  const ws = liveConnections.get(clientId)
  const delivered = !!ws && ws.readyState === WebSocket.OPEN
  if (delivered) {
    ws!.send(JSON.stringify({ type: 'dm_reply', text, at: Date.now() }))
  }
  notify()
  return delivered ? { ok: true } : { ok: false, error: 'Player is not currently connected' }
}

// Pushes a command to one player. Returns the generated command id so the
// caller can match the acknowledgement that comes back.
export function sendCommand(clientId: string, command: DmCommand): { ok: boolean; id?: string; error?: string } {
  const ws = liveConnections.get(clientId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return { ok: false, error: 'Player is not connected' }
  const id = randomUUID()
  try {
    ws.send(JSON.stringify({ type: 'dm_command', id, ...command }))
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed' }
  }
  return { ok: true, id }
}

// Fans a command out to every connected player (or an explicit subset).
export function broadcastCommand(command: DmCommand, only?: string[]): number {
  let sent = 0
  for (const clientId of Array.from(liveConnections.keys())) {
    if (only && !only.includes(clientId)) continue
    if (sendCommand(clientId, command).ok) sent++
  }
  return sent
}

export function isPlayerOnline(clientId: string): boolean {
  const ws = liveConnections.get(clientId)
  return !!ws && ws.readyState === WebSocket.OPEN
}

// Adapters that exist on the machine but virtually never carry LAN traffic
// to another physical PC in the room — VPN clients, hypervisor virtual
// switches, container networking. `os.networkInterfaces()` has no notion of
// "the real one," and its object-key order is whatever the OS reports, which
// is very often one of these rather than the actual WiFi/Ethernet adapter.
const LIKELY_VIRTUAL_ADAPTER = /virtual|vethernet|hyper-v|vmware|virtualbox|docker|wsl|loopback|tailscale|zerotier|tap-|tun\d|ppp|bluetooth/i

function score(adapterName: string, address: string): number {
  let s = 0
  if (LIKELY_VIRTUAL_ADAPTER.test(adapterName)) s -= 10
  if (/^192\.168\./.test(address)) s += 3       // by far the most common home-LAN range
  else if (/^10\./.test(address)) s += 2
  else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) s += 1
  return s
}

// Every plausible LAN address, best guess first — exposed as a list (not
// just the top pick) because the heuristic above is still a guess: a DM
// running a VPN, multiple NICs, or an unusual router setup can make the
// "obvious" adapter score wrong. If the top address doesn't work for a
// player, the DM can hand out one of the others instead of being stuck.
export function getLanAddresses(): string[] {
  const nets = networkInterfaces()
  const candidates: { address: string; score: number }[] = []
  for (const [name, entries] of Object.entries(nets)) {
    for (const net of entries ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue
      candidates.push({ address: `${net.address}:${PARTY_SYNC_PORT}`, score: score(name, net.address) })
    }
  }
  return candidates.sort((a, b) => b.score - a.score).map((c) => c.address)
}

// Best-effort single LAN IPv4 address for the DM to read off and hand to
// players — there's no discovery mechanism, so this is what gets typed into
// the companion app's "DM Server Address" field.
export function getLanAddress(): string | null {
  return getLanAddresses()[0] ?? null
}
