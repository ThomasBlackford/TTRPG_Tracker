import { contextBridge, ipcRenderer } from 'electron'

const api = {
  cards: {
    list: (filter?: { type?: string }) => ipcRenderer.invoke('cards:list', filter),
    get: (id: string) => ipcRenderer.invoke('cards:get', id),
    save: (card: Record<string, unknown>) => ipcRenderer.invoke('cards:save', card),
    delete: (id: string) => ipcRenderer.invoke('cards:delete', id)
  },
  party: {
    getMembers: () => ipcRenderer.invoke('party:getMembers'),
    saveMember: (member: Record<string, unknown>) => ipcRenderer.invoke('party:saveMember', member),
    deleteMember: (id: string) => ipcRenderer.invoke('party:deleteMember', id),
    updateInitiative: (id: string, initiative: number | null) =>
      ipcRenderer.invoke('party:updateInitiative', id, initiative),
    updateResources: (id: string, resources: unknown[]) =>
      ipcRenderer.invoke('party:updateResources', id, resources),
    getReputation: (memberId: string) => ipcRenderer.invoke('party:getReputation', memberId),
    setReputation: (memberId: string, factionId: string, score: number) =>
      ipcRenderer.invoke('party:setReputation', memberId, factionId, score)
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    get: (id: string) => ipcRenderer.invoke('sessions:get', id),
    save: (note: Record<string, unknown>) => ipcRenderer.invoke('sessions:save', note),
    delete: (id: string) => ipcRenderer.invoke('sessions:delete', id)
  },
  search: {
    query: (q: string) => ipcRenderer.invoke('search:query', q)
  },
  maps: {
    list: () => ipcRenderer.invoke('maps:list'),
    get: (id: string) => ipcRenderer.invoke('maps:get', id),
    save: (map: Record<string, unknown>) => ipcRenderer.invoke('maps:save', map),
    delete: (id: string) => ipcRenderer.invoke('maps:delete', id),
    getPins: (mapId: string) => ipcRenderer.invoke('maps:getPins', mapId),
    savePin: (pin: Record<string, unknown>) => ipcRenderer.invoke('maps:savePin', pin),
    deletePin: (id: string) => ipcRenderer.invoke('maps:deletePin', id)
  },
  dialog: {
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
    openMapImage: () => ipcRenderer.invoke('dialog:openMapImage')
  }
}

contextBridge.exposeInMainWorld('api', api)
