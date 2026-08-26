import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'

export const PARTY_SYNC_PORT = 47337

export interface PlayerSnapshot {
  name: string
  race: string
  class: string
  level: number
  ac: number | null
  initiative: number | null
  hp_current: number | null
  hp_max: number | null
  spellSlots: { level: number; max: number; current: number }[]
  resources: { id: string; name: string; current: number; max: number; color: string }[]
  conditions: string[]
}

export interface ConnectedPlayer {
  clientId: string
  snapshot: PlayerSnapshot
  lastSeen: number
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

let wss: WebSocketServer | null = null

// Keyed by the player's persistent client_id (sent with every message), not
// by the raw WebSocket — that's what lets a reconnect (WiFi hiccup, app
// restart) resume the same thread instead of starting a new one.
const liveConnections = new Map<string, WebSocket>() // clientId -> live socket, while connected
const players = new Map<string, ConnectedPlayer>() // clientId -> latest snapshot, while connected
const dmThreads = new Map<string, DmThread>() // clientId -> conversation, persists across disconnects

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

export function startServer(): { ok: boolean; error?: string } {
  if (wss) return { ok: true }

  try {
    wss = new WebSocketServer({ host: '0.0.0.0', port: PARTY_SYNC_PORT })
  } catch (e) {
    wss = null
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return // ignore malformed frames rather than crash the server
      }

      const clientId = typeof msg.clientId === 'string' && msg.clientId ? msg.clientId : null
      if (!clientId) return // can't attribute this message to anyone, drop it

      liveConnections.set(clientId, ws)

      if (msg.type === 'snapshot' && msg.data) {
        const snapshot = msg.data as PlayerSnapshot
        players.set(clientId, { clientId, snapshot, lastSeen: Date.now() })
        snapshotListener?.(clientId, snapshot)
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
      }
    })

    ws.on('close', () => {
      for (const [clientId, socket] of liveConnections) {
        if (socket === ws) {
          liveConnections.delete(clientId)
          players.delete(clientId)
          break
        }
      }
      notify()
    })

    ws.on('error', () => {
      for (const [clientId, socket] of liveConnections) {
        if (socket === ws) {
          liveConnections.delete(clientId)
          players.delete(clientId)
          break
        }
      }
      notify()
    })
  })

  return { ok: true }
}

export function stopServer(): void {
  wss?.close()
  wss = null
  liveConnections.clear()
  players.clear()
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

// Best-effort LAN IPv4 address for the DM to read off and hand to players —
// there's no discovery mechanism, so this is what gets typed into the
// companion app's "DM Server Address" field.
export function getLanAddress(): string | null {
  const nets = networkInterfaces()
  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family === 'IPv4' && !net.internal) return `${net.address}:${PARTY_SYNC_PORT}`
    }
  }
  return null
}
