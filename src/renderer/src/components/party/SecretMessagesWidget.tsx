import { useState, useEffect } from 'react'
import { MessageSquare, X, Power, Copy, Send } from 'lucide-react'
import type { PartySyncState } from '../../types'

// Global, floating in the bottom-right corner of the whole app — visible
// regardless of which page the DM is on. Also where the sync server itself
// is started/stopped now, so the whole "talk to players" feature lives in
// one place instead of being split across a page and a corner widget.
export function SecretMessagesWidget() {
  const [state, setState] = useState<PartySyncState | null>(null)
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({})
  const [showAltAddresses, setShowAltAddresses] = useState(false)

  useEffect(() => {
    window.api.partySync.status().then(setState)
    return window.api.partySync.onUpdate(setState)
  }, [])

  const threads = state?.threads ?? []

  // Default to the most recently active thread whenever nothing is
  // selected, or the previous selection's thread no longer exists.
  useEffect(() => {
    if (threads.length === 0) {
      setSelectedClientId(null)
      return
    }
    if (!selectedClientId || !threads.some((t) => t.clientId === selectedClientId)) {
      const mostRecent = [...threads].sort(
        (a, b) => (b.messages[b.messages.length - 1]?.at ?? 0) - (a.messages[a.messages.length - 1]?.at ?? 0)
      )[0]
      setSelectedClientId(mostRecent.clientId)
    }
  }, [threads, selectedClientId])

  function toggleOpen() {
    setOpen((v) => {
      const next = !v
      if (next) {
        const counts: Record<string, number> = {}
        for (const t of threads) counts[t.clientId] = t.messages.length
        setSeenCounts(counts)
      }
      return next
    })
  }

  async function handleToggleServer() {
    if (state?.running) {
      const result = await window.api.partySync.stop()
      setState((s) => (s ? { ...s, running: result.running, address: null, addresses: [] } : s))
      return
    }
    setStarting(true)
    const result = await window.api.partySync.start()
    setStarting(false)
    setState((s) => ({
      players: s?.players ?? [],
      threads: s?.threads ?? [],
      running: result.running,
      address: result.address,
      addresses: result.addresses
    }))
    if (!result.ok) alert(`Couldn't start player sync: ${result.error}`)
  }

  async function handleReply() {
    if (!selectedClientId || !replyText.trim()) return
    const result = await window.api.partySync.reply(selectedClientId, replyText.trim())
    setReplyText('')
    if (!result.ok) {
      alert(`Message saved, but couldn't deliver it live: ${result.error ?? 'player is offline'}`)
    }
  }

  const unread = !open && threads.some((t) => t.messages.length > (seenCounts[t.clientId] ?? 0))
  const selectedThread = threads.find((t) => t.clientId === selectedClientId) ?? null

  return (
    <>
      <button
        onClick={toggleOpen}
        title="Messages"
        className="fixed bottom-4 right-4 z-40 w-11 h-11 flex items-center justify-center rounded-full
                   bg-surface-raised border border-border text-slate-400 shadow-lg
                   hover:text-amber-300 hover:border-amber-500/40 transition-colors"
      >
        <MessageSquare size={17} />
        {unread && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-400" />}
      </button>

      {open && (
        <div className="fixed bottom-[4.75rem] right-4 z-40 w-80 max-h-[34rem] bg-surface-raised border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <h3 className="font-display text-sm font-semibold text-white">Messages</h3>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={15} />
            </button>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0 text-[11px]">
            <span className={state?.running ? 'text-emerald-400' : 'text-slate-600'}>
              {state?.running ? `Running · ${state.address}` : 'Sync not running'}
            </span>
            <div className="flex items-center gap-2">
              {state?.running && state.address && (
                <button
                  onClick={() => navigator.clipboard.writeText(state.address ?? '')}
                  title="Copy address"
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <Copy size={12} />
                </button>
              )}
              <button
                onClick={handleToggleServer}
                disabled={starting}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] border transition-colors disabled:opacity-50 ${
                  state?.running
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'border-border text-slate-400 hover:text-slate-200 hover:border-slate-500'
                }`}
              >
                <Power size={11} /> {state?.running ? 'Stop' : starting ? '…' : 'Start'}
              </button>
            </div>
          </div>

          {/* This machine can have more than one network adapter (WiFi + a
             VPN, Ethernet + WiFi, etc.) — the address above is just the best
             guess. If a player can't connect, try one of these instead. */}
          {state?.running && state.addresses.length > 1 && (
            <div className="px-3 py-2 border-b border-border flex-shrink-0 text-[11px]">
              <button
                onClick={() => setShowAltAddresses((v) => !v)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showAltAddresses ? 'Hide' : 'Not working?'} — {state.addresses.length - 1} other address
                {state.addresses.length - 1 === 1 ? '' : 'es'} to try
              </button>
              {showAltAddresses && (
                <div className="mt-1.5 space-y-1">
                  {state.addresses.slice(1).map((addr) => (
                    <div key={addr} className="flex items-center justify-between gap-2 text-slate-400">
                      <span className="font-mono">{addr}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(addr)}
                        title="Copy address"
                        className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                      >
                        <Copy size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {threads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 min-h-[12rem]">
              <p className="text-xs text-slate-600 text-center">No secret messages yet.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1 px-2 py-2 border-b border-border flex-shrink-0 overflow-x-auto">
                {threads.map((t) => {
                  const hasUnread = t.messages.length > (seenCounts[t.clientId] ?? 0)
                  return (
                    <button
                      key={t.clientId}
                      onClick={() => setSelectedClientId(t.clientId)}
                      className={`relative flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                        selectedClientId === t.clientId
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'text-slate-500 border-transparent hover:text-slate-300'
                      }`}
                    >
                      {t.playerName}
                      {hasUnread && selectedClientId !== t.clientId && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[12rem]">
                {selectedThread?.messages.map((m, i) => (
                  <p
                    key={i}
                    className={`text-xs leading-relaxed ${m.from === 'dm' ? 'text-amber-300 text-right' : 'text-slate-300'}`}
                  >
                    <span className="font-medium">{m.from === 'dm' ? 'You' : selectedThread.playerName}:</span> {m.text}
                  </p>
                ))}
              </div>

              <div className="flex items-center gap-1.5 p-2.5 border-t border-border flex-shrink-0">
                <input
                  className="input text-xs py-1.5"
                  placeholder={selectedThread ? `Reply to ${selectedThread.playerName}…` : 'Select a player'}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  disabled={!selectedThread}
                />
                <button
                  onClick={handleReply}
                  disabled={!selectedThread}
                  className="text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0 disabled:opacity-30"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
