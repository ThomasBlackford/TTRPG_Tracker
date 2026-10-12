import type { Statblock } from '../../types'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

export function abilityMod(score: number | undefined): number {
  return Math.floor(((score ?? 10) - 10) / 2)
}

function mod(score: number | undefined): string {
  const m = abilityMod(score)
  return m >= 0 ? `+${m}` : String(m)
}

function Block({ label, text }: { label: string; text?: string }) {
  if (!text || !text.trim()) return null
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-0.5">{label}</p>
      <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  )
}

function Line({ label, text }: { label: string; text?: string }) {
  if (!text || !text.trim()) return null
  return (
    <p className="text-xs text-slate-400">
      <span className="text-slate-500">{label} </span>
      {text}
    </p>
  )
}

// The reference text for a creature — traits, actions, the lot — in the order
// a stat block reads.
export function StatblockView({ statblock }: { statblock: Statblock }) {
  const hasScores = ABILITY_KEYS.some((k) => statblock[k] != null)
  const heading = [statblock.size, statblock.type].filter(Boolean).join(' ')
  return (
    <div className="space-y-2.5">
      {heading && <p className="text-xs italic text-slate-500">{heading}</p>}
      <Line label="Speed" text={statblock.speed} />
      {hasScores && (
        <div className="grid grid-cols-6 gap-1 text-center">
          {ABILITY_KEYS.map((k) => (
            <div key={k} className="border border-border py-1 bg-surface-base/50">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">{k}</p>
              <p className="text-xs text-slate-200">{statblock[k] ?? 10} <span className="text-slate-500">({mod(statblock[k])})</span></p>
            </div>
          ))}
        </div>
      )}
      <Line label="Saves" text={statblock.saves} />
      <Line label="Skills" text={statblock.skills} />
      <Line label="Resist / immune" text={statblock.resistances} />
      <Line label="Senses" text={statblock.senses} />
      <Line label="Languages" text={statblock.languages} />
      <Block label="Traits" text={statblock.traits} />
      <Block label="Actions" text={statblock.actions} />
      <Block label="Reactions" text={statblock.reactions} />
      <Block label="Legendary actions" text={statblock.legendary} />
      <Block label="Lair actions" text={statblock.lair} />
      <Block label="Notes" text={statblock.notes} />
    </div>
  )
}

export function hasStatblockContent(s: Statblock | null | undefined): boolean {
  if (!s) return false
  return Object.values(s).some((v) => (typeof v === 'string' ? v.trim().length > 0 : v != null))
}
