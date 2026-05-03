import { useState, useEffect } from 'react'
import { X, Image } from 'lucide-react'
import type { PartyMember } from '../../types'
import { useUIStore } from '../../store/uiStore'

export function MemberForm({ onSaved }: { onSaved: (m: PartyMember) => void }) {
  const { memberForm, closeMemberForm } = useUIStore()
  const [member, setMember] = useState<PartyMember | null>(null)
  const [name, setName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (memberForm.editingId) {
      window.api.party.getMembers().then((members) => {
        const found = members.find((m) => m.id === memberForm.editingId)
        if (found) {
          setMember(found)
          setName(found.name)
          setPlayerName(found.player_name)
          setAvatarPath(found.avatar_path)
        }
      })
    }
  }, [memberForm.editingId])

  async function pickAvatar() {
    const path = await window.api.dialog.openImage()
    if (path) setAvatarPath(path)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const saved = await window.api.party.saveMember({
        ...(member?.id ? { id: member.id, sort_order: member.sort_order, resources: member.resources } : { resources: [] }),
        name: name.trim(),
        player_name: playerName.trim(),
        avatar_path: avatarPath
      } as Parameters<typeof window.api.party.saveMember>[0])
      onSaved(saved)
      closeMemberForm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={closeMemberForm}>
      <div className="modal max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-base font-semibold text-white">
            {member ? 'Edit Member' : 'Add Party Member'}
          </h2>
          <button onClick={closeMemberForm} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-surface-overlay border border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500/60 transition-colors"
              onClick={pickAvatar}
            >
              {avatarPath ? (
                <img src={`file://${avatarPath}`} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Image size={20} className="text-slate-500" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Character Name *</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aldric Stoneheart" autoFocus />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">Player Name</label>
                <input className="input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Alex" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={closeMemberForm} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : member ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}
