import type { LogKind } from '../types'

export const LOG_KINDS: { kind: LogKind; label: string; color: string }[] = [
  { kind: 'combat', label: 'Combat', color: 'text-amber-300' },
  { kind: 'turn', label: 'Turns', color: 'text-slate-400' },
  { kind: 'damage', label: 'Damage', color: 'text-red-300' },
  { kind: 'heal', label: 'Healing', color: 'text-emerald-300' },
  { kind: 'death', label: 'Down / dead', color: 'text-rose-400' },
  { kind: 'condition', label: 'Conditions', color: 'text-yellow-300' },
  { kind: 'roll', label: 'Rolls', color: 'text-sky-300' },
  { kind: 'boss', label: 'Boss', color: 'text-purple-300' },
  { kind: 'reward', label: 'Rewards', color: 'text-lime-300' },
  { kind: 'table', label: 'Table', color: 'text-slate-300' },
  { kind: 'player', label: 'Players', color: 'text-teal-300' }
]

export function kindColor(kind: LogKind): string {
  return LOG_KINDS.find((k) => k.kind === kind)?.color ?? 'text-slate-300'
}

export function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
