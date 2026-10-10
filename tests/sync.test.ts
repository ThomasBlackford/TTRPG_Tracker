import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import WebSocket from 'ws'
import * as server from '../src/main/server'
import * as client from '../player-client/src/main/sync'
import { sent } from './stubs/mainProcess'

// These run the REAL DM server and the REAL player sync client against each
// other on localhost — no mocks of the protocol itself.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uncaught: string[] = []
process.on('uncaughtException', (e) => uncaught.push(e.message))

async function waitFor(cond: () => boolean, ms = 3000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (cond()) return true
    await sleep(25)
  }
  return cond()
}

const ADDR = `127.0.0.1:${server.PARTY_SYNC_PORT}`

test('closing or replacing a connection mid-handshake never throws', async () => {
  uncaught.length = 0
  client.connect('10.255.255.1:47337') // unroutable: stays CONNECTING
  await sleep(150)
  client.disconnect()
  await sleep(250)
  client.connect('10.255.255.1:47337')
  await sleep(150)
  client.connect('10.255.255.1:47338')
  await sleep(250)
  client.disconnect()
  await sleep(150)
  assert.deepEqual(uncaught, [])
})

test('a refused connection reports a friendly error and stops retrying on disconnect', async () => {
  client.connect('127.0.0.1:47399')
  await waitFor(() => !client.getStatus().connecting)
  const st = client.getStatus()
  assert.match(st.error ?? '', /started Player Sync|refused/i)
  assert.equal(st.connected, false)
  client.disconnect()
  assert.equal(client.getStatus().error, null)
})

test('bad addresses are rejected up front', () => {
  assert.equal(client.connect('not an address!!').ok, false)
  assert.equal(client.connect('').ok, false)
  client.disconnect()
})

test('join code: wrong code is refused, right code connects, and refusal does not retry', async () => {
  server.configureAuth({ requireCode: true, joinCode: 'K7QX' })
  assert.ok(server.startServer().ok)

  client.connect(ADDR, 'WRNG')
  assert.ok(await waitFor(() => /join code/i.test(client.getStatus().error ?? '')), 'wrong code gives a join-code error')
  assert.equal(client.getStatus().connected, false)
  await sleep(2600) // longer than the first reconnect delay
  assert.equal(client.getStatus().connected, false, 'a refused client must not keep retrying with the same code')
  assert.equal(client.getStatus().connecting, false)

  client.connect(ADDR, '  k7qx ') // case and whitespace tolerant
  assert.ok(await waitFor(() => client.getStatus().connected), 'right code connects')
  assert.equal(client.getStatus().error, null)

  client.disconnect()
  server.stopServer()
})

test('with no code required, older clients that never send a hello still work', async () => {
  server.configureAuth({ requireCode: false, joinCode: 'ABCD' })
  server.startServer()
  const ws = new WebSocket(`ws://${ADDR}`)
  await new Promise((r) => ws.on('open', r))
  ws.send(JSON.stringify({
    type: 'snapshot', clientId: 'legacy-1',
    data: { name: 'Old Timer', hp_current: 3, hp_max: 9, hp_temp: 0, inspiration: false, spellSlots: [], resources: [], conditions: [] }
  }))
  assert.ok(await waitFor(() => server.getPlayers().some((p) => p.clientId === 'legacy-1')))
  ws.close()
  server.stopServer()
})

test('with a code required, a client that skips the hello is refused', async () => {
  server.configureAuth({ requireCode: true, joinCode: 'ZZZZ' })
  server.startServer()
  const ws = new WebSocket(`ws://${ADDR}`)
  await new Promise((r) => ws.on('open', r))
  const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)))
  ws.send(JSON.stringify({ type: 'snapshot', clientId: 'sneaky', data: { name: 'Sneak' } }))
  assert.equal(await closed, 4001)
  assert.equal(server.getPlayers().some((p) => p.clientId === 'sneaky'), false, 'unauthenticated data is never stored')
  server.stopServer()
})

test('snapshots, DM commands, acknowledgements and roll results all flow', async () => {
  server.configureAuth({ requireCode: true, joinCode: 'K7QX' })
  server.startServer()
  let snapshotFor = ''
  server.onSnapshot((id) => { snapshotFor = id })

  const received: Record<string, unknown>[] = []
  client.onDmCommand((cmd) => {
    received.push(cmd)
    client.sendCommandAck(String(cmd.id), true, `applied ${cmd.cmd}`)
  })

  client.connect(ADDR, 'K7QX')
  assert.ok(await waitFor(() => client.getStatus().connected))
  client.sendSnapshot({ name: 'Aria', hp_current: 10, hp_max: 20, hp_temp: 0, inspiration: false, spellSlots: [], resources: [], conditions: [] })
  assert.ok(await waitFor(() => snapshotFor === 'test-client-1'))
  const aria = server.getPlayers().find((p) => p.clientId === 'test-client-1')!
  assert.equal(aria.snapshot.name, 'Aria')
  assert.equal(aria.online, true)

  // DM → player
  const r = server.sendCommand('test-client-1', { cmd: 'hp_delta', amount: -7 })
  assert.ok(r.ok && r.id)
  assert.ok(await waitFor(() => received.length === 1))
  assert.equal(received[0].cmd, 'hp_delta')
  assert.equal(received[0].amount, -7)
  assert.ok(await waitFor(() => server.getCommandLog().some((a) => a.id === r.id && a.ok)), 'ack reaches the DM')

  // roll request round-trip, with pass/fail computed against the DC
  server.broadcastCommand({ cmd: 'roll_request', rollId: 'roll-1', label: 'Dexterity save', kind: 'save', ability: 'dex', dc: 14 })
  assert.ok(await waitFor(() => received.length === 2))
  client.sendRollResult({ rollId: 'roll-1', label: 'Dexterity save', total: 17, natural: 14, modifier: 3, dc: 14 })
  assert.ok(await waitFor(() => server.getRollResults().length === 1))
  let res = server.getRollResults()[0]
  assert.equal(res.success, true)
  assert.equal(res.playerName, 'Aria')
  client.sendRollResult({ rollId: 'roll-1', label: 'Dexterity save', total: 9, natural: 6, modifier: 3, dc: 14 })
  assert.ok(await waitFor(() => server.getRollResults().length === 2))
  res = server.getRollResults()[1]
  assert.equal(res.success, false)

  // commands to an unknown or offline player fail cleanly instead of throwing
  assert.equal(server.sendCommand('nobody', { cmd: 'notice', text: 'hi' }).ok, false)

  // chat still works alongside the new messages
  client.sendDmMessage('hello DM')
  assert.ok(await waitFor(() => server.getThreads().some((t) => t.messages.some((m) => m.text === 'hello DM'))))
  server.sendDmReply('test-client-1', 'hello player')
  assert.ok(await waitFor(() => client.getDmReplies().some((m) => m.text === 'hello player')))

  client.disconnect()
  server.stopServer()
})

test('a player who drops stays on the roster, marked offline', async () => {
  server.configureAuth({ requireCode: false, joinCode: 'ABCD' })
  server.startServer()
  client.connect(ADDR, '')
  assert.ok(await waitFor(() => client.getStatus().connected))
  client.sendSnapshot({ name: 'Brom', hp_current: 5, hp_max: 5, hp_temp: 0, inspiration: false, spellSlots: [], resources: [], conditions: [] })
  assert.ok(await waitFor(() => server.getPlayers().some((p) => p.snapshot.name === 'Brom' && p.online)))

  client.disconnect()
  assert.ok(await waitFor(() => server.getPlayers().some((p) => p.snapshot.name === 'Brom' && !p.online)))
  assert.equal(server.isPlayerOnline('test-client-1'), false)
  assert.equal(server.getPlayers().length >= 1, true, 'roster keeps the offline player')
  server.stopServer()
})

test('the client reconnects by itself when the DM restarts', async () => {
  server.configureAuth({ requireCode: false, joinCode: 'ABCD' })
  server.startServer()
  client.connect(ADDR, '')
  assert.ok(await waitFor(() => client.getStatus().connected))
  server.stopServer()
  assert.ok(await waitFor(() => !client.getStatus().connected))
  server.startServer()
  assert.ok(await waitFor(() => client.getStatus().connected, 6000), 'auto-reconnect after the server returns')
  assert.ok(sent.some(([ch, p]) => ch === 'sync:status' && (p as { connected: boolean }).connected), 'UI is told about it')
  client.disconnect()
  server.stopServer()
})

test('junk frames never crash the server', async () => {
  uncaught.length = 0
  server.configureAuth({ requireCode: false, joinCode: 'ABCD' })
  server.startServer()
  const ws = new WebSocket(`ws://${ADDR}`)
  await new Promise((r) => ws.on('open', r))
  for (const junk of ['null', '123', '"str"', '[]', '{bad', '{"clientId":"x","type":"snapshot","data":5}', '{"clientId":"x","type":"roll_result"}', '{"type":"hello"}'])
    ws.send(junk)
  await sleep(300)
  assert.deepEqual(uncaught, [])
  ws.close()
  server.stopServer()
})

test('starting the server on a busy port reports the problem instead of throwing', async () => {
  uncaught.length = 0
  server.stopServer()
  const blocker = net.createServer().listen(server.PARTY_SYNC_PORT, '0.0.0.0')
  await new Promise((r) => blocker.on('listening', r))
  server.startServer()
  await sleep(300)
  assert.deepEqual(uncaught, [])
  assert.match(server.getServerError() ?? '', /already in use/)
  assert.equal(server.isRunning(), false)
  blocker.close()
  await sleep(150)
  assert.ok(server.startServer().ok, 'can start again once the port is free')
  server.stopServer()
})
