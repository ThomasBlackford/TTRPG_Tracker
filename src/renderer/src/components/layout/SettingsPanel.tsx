import { useEffect, useState } from 'react'
import { X, Download, Upload, FolderOpen } from 'lucide-react'
import type { ColorTheme, SidebarSide, StyleTheme } from '../../contexts/SettingsContext'
import { useSettings } from '../../contexts/SettingsContext'
import { confirmAsync } from '../../lib/confirm'

interface Props {
  onClose: () => void
}

const STYLE_OPTIONS: { value: StyleTheme; label: string }[] = [
  { value: 'fantasy', label: 'Fantasy — serif headings' },
  { value: 'modern', label: 'Modern — sans-serif headings' }
]

const COLOR_OPTIONS: { value: ColorTheme; label: string }[] = [
  { value: 'crimson', label: 'Blood Red' },
  { value: 'amber', label: 'Gold' },
  { value: 'arcane', label: 'Violet' }
]

const SIDEBAR_OPTIONS: { value: SidebarSide; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' }
]

function fmtSize(bytes: number): string {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function SettingsPanel({ onClose }: Props) {
  const { style, color, sidebar, setStyle, setColor, setSidebar } = useSettings()
  const [backups, setBackups] = useState<{ name: string; size: number; modified: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  useEffect(() => {
    window.api.backup.info().then((i) => setBackups(i.autos)).catch(() => {})
  }, [])

  async function handleExport() {
    setBusy(true)
    setMessage(null)
    const r = await window.api.backup.export()
    setBusy(false)
    if (r.canceled) return
    setMessage(r.ok ? { text: `Saved — ${r.files ?? 0} image${r.files === 1 ? '' : 's'} included.` } : { text: r.error ?? 'Backup failed.', error: true })
  }

  async function handleRestore() {
    const ok = await confirmAsync({
      title: 'Restore from a backup?',
      message:
        'This replaces everything in the app with the contents of the backup file, then restarts LoreKeeper. Your current data is saved aside first.',
      confirmLabel: 'Choose backup file…',
      danger: true
    })
    if (!ok) return
    setBusy(true)
    const r = await window.api.backup.import()
    setBusy(false)
    if (!r.ok && !r.canceled) setMessage({ text: r.error ?? 'Restore failed.', error: true })
  }

  return (
    <div className="modal-backdrop p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal max-w-md p-6 max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-white uppercase tracking-widest">Settings</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-medium">Theme</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Heading font</label>
              <select className="input text-sm" value={style} onChange={(e) => setStyle(e.target.value as StyleTheme)}>
                {STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Color</label>
              <select className="input text-sm" value={color} onChange={(e) => setColor(e.target.value as ColorTheme)}>
                {COLOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Sidebar</label>
            <select className="input text-sm" value={sidebar} onChange={(e) => setSidebar(e.target.value as SidebarSide)}>
              {SIDEBAR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <p className="text-[11px] text-slate-600">
            Your personal theme — this never affects what's shown on the presentation screen.
          </p>
        </div>

        <div className="space-y-3 mt-7 pt-5 border-t border-border">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-medium">Backup &amp; restore</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your whole campaign — cards, party, maps and their images — in one file. Keep a copy somewhere other than this
            PC, and use it to move LoreKeeper to a new computer.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleExport} disabled={busy} className="btn-primary flex items-center justify-center gap-2 text-xs disabled:opacity-50">
              <Download size={13} /> Back up now
            </button>
            <button onClick={handleRestore} disabled={busy} className="btn-ghost border-border flex items-center justify-center gap-2 text-xs disabled:opacity-50">
              <Upload size={13} /> Restore…
            </button>
          </div>
          {message && <p className={`text-xs ${message.error ? 'text-red-400' : 'text-emerald-400'}`}>{message.text}</p>}

          <div className="pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-slate-400">Automatic daily snapshots</p>
              <button
                onClick={() => window.api.backup.openFolder()}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-white transition-colors"
              >
                <FolderOpen size={11} /> Open folder
              </button>
            </div>
            {backups.length === 0 ? (
              <p className="text-[11px] text-slate-600">None yet — the first is taken when the app starts.</p>
            ) : (
              <ul className="space-y-0.5">
                {backups.slice(0, 4).map((b) => (
                  <li key={b.name} className="flex justify-between text-[11px] text-slate-600">
                    <span>{new Date(b.modified).toLocaleString()}</span>
                    <span>{fmtSize(b.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
