import { useState, useEffect } from 'react'
import { Swords } from 'lucide-react'
import type { PartyMember } from '../types'
import { useUIStore } from '../store/uiStore'
import { PartyMemberSlot } from '../components/party/PartyMemberSlot'
import { MemberForm } from '../components/party/MemberForm'
import { MemberDetailModal } from '../components/party/MemberDetailModal'
import { InitiativeTracker } from '../components/party/InitiativeTracker'
import { PlayerSyncPanel } from '../components/party/PlayerSyncPanel'

export function PartyPage() {
  const { memberForm, openMemberForm } = useUIStore()
  const [members, setMembers] = useState<PartyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [detailMember, setDetailMember] = useState<PartyMember | null>(null)

  useEffect(() => {
    loadMembers()
  }, [])

  // The roster is populated by players connecting, not by the DM adding
  // entries — so it needs to refresh itself whenever sync state changes,
  // not just on mount.
  useEffect(() => {
    return window.api.partySync.onUpdate(() => loadMembers())
  }, [])

  async function loadMembers() {
    setLoading(true)
    const data = await window.api.party.getMembers()
    setMembers(data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this party member?')) return
    await window.api.party.deleteMember(id)
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function handleUpdate(updated: PartyMember) {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    setDetailMember((prev) => (prev?.id === updated.id ? updated : prev))
  }

  async function handleSaved(_m: PartyMember) {
    await loadMembers()
  }

  const inCombat = members.some((m) => m.initiative !== null)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold text-white">The Party</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {members.length} adventurer{members.length !== 1 ? 's' : ''} · click a member to view faction reputation
          </p>
        </div>

        <div className="mb-8">
          <PlayerSyncPanel />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-sm">No party members yet.</p>
            <p className="text-slate-600 text-xs mt-1.5">
              Start Player Sync above — the roster fills in as players connect their Companion app.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
              {members.map((m) => (
                <PartyMemberSlot
                  key={m.id}
                  member={m}
                  onUpdate={handleUpdate}
                  onDelete={() => handleDelete(m.id)}
                  onEdit={() => openMemberForm(m.id)}
                  onOpenDetail={() => setDetailMember(m)}
                />
              ))}
            </div>

            {inCombat && (
              <div className="bg-surface-raised border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Swords size={16} className="text-amber-400" />
                  <h3 className="font-display text-sm font-semibold text-amber-300 uppercase tracking-wider">
                    Initiative Order
                  </h3>
                </div>
                <InitiativeTracker members={members} />
              </div>
            )}
          </>
        )}
      </div>

      {memberForm.open && <MemberForm onSaved={handleSaved} />}
      {detailMember && (
        <MemberDetailModal
          member={detailMember}
          onClose={() => setDetailMember(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
