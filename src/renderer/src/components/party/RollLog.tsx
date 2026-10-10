import { Dices, Trash2 } from 'lucide-react'
import type { RollResult } from '../../types'

interface Group {
  rollId: string
  label: string
  dc: number | null
  at: number
  results: RollResult[]
}

function group(rolls: RollResult[]): Group[] {
  const map = new Map<string, Group>()
  for (const r of rolls) {
    const g = map.get(r.rollId)
    if (g) g.results.push(r)
    else map.set(r.rollId, { rollId: r.rollId, label: r.label, dc: r.dc, at: r.at, results: [r] })
  }
  return Array.from(map.values()).sort((a, b) => b.at - a.at)
}

// Everything players have rolled back at the DM — requested rolls (grouped so
// one "Dexterity save, DC 14" shows all five answers together) and anything
// they chose to roll themselves.
export function RollLog({ rolls }: { rolls: RollResult[] }) {
  const groups = group(rolls).slice(0, 8)

  return (
    <div className="bg-surface-raised border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Dices size={16} className="text-amber-400" />
        <h3 className="font-display text-sm font-semibold text-slate-200 uppercase tracking-wider">Roll Log</h3>
        {rolls.length > 0 && (
          <button
            onClick={() => window.api.partySync.clearRolls()}
            className="ml-auto flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-300 transition-colors"
          >
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-slate-600">
          No rolls yet. Use <span className="text-slate-400">Request Roll</span> on a player or the whole table.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.rollId}>
              <div className="flex items-baseline gap-2 mb-1.5">
                <p className="text-xs font-medium text-slate-200">{g.label}</p>
                {g.dc != null && <span className="text-[10px] uppercase tracking-widest text-amber-400">DC {g.dc}</span>}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-1.5">
                {g.results.map((r) => (
                  <div
                    key={r.clientId + r.at}
                    className={`flex items-center justify-between px-2.5 py-1.5 text-xs border ${
                      r.success === true ? 'border-emerald-500/40 bg-emerald-500/10'
                      : r.success === false ? 'border-red-500/40 bg-red-500/10'
                      : 'border-border bg-surface-overlay'
                    }`}
                  >
                    <span className="truncate text-slate-300 mr-2">{r.playerName}</span>
                    <span className="font-display font-semibold text-white" title={`d20 ${r.natural} ${r.modifier >= 0 ? '+' : ''}${r.modifier}`}>
                      {r.total}
                      {r.natural === 20 && <span className="text-emerald-400 text-[9px] ml-1">NAT</span>}
                      {r.natural === 1 && <span className="text-red-400 text-[9px] ml-1">NAT</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
