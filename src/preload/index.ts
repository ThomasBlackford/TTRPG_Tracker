import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

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
    deletePin: (id: string) => ipcRenderer.invoke('maps:deletePin', id),
    // Fog of war
    getFog: (mapId: string) => ipcRenderer.invoke('maps:getFog', mapId),
    saveFog: (data: { mapId: string; fogState: unknown }) => ipcRenderer.invoke('maps:saveFog', data),
    deleteFog: (mapId: string) => ipcRenderer.invoke('maps:deleteFog', mapId),
    // Session-only push (no DB)
    pushRuler: (data: unknown) => ipcRenderer.invoke('maps:pushRuler', data),
    pushSpotlight: (data: unknown) => ipcRenderer.invoke('maps:pushSpotlight', data),
    pushGrid: (data: unknown) => ipcRenderer.invoke('maps:pushGrid', data),
    // Presentation window
    openPresentation: (mapId: string) => ipcRenderer.invoke('maps:openPresentation', mapId),
    closePresentation: () => ipcRenderer.invoke('maps:closePresentation'),
    // Event subscriptions (return cleanup fn)
    onPresentUpdate: (cb: (mapId: string) => void) => {
      const handler = (_e: IpcRendererEvent, mapId: string) => cb(mapId)
      ipcRenderer.on('maps:presentUpdate', handler)
      return () => ipcRenderer.removeListener('maps:presentUpdate', handler)
    },
    onFogUpdate: (cb: (data: { mapId: string; fogState: unknown }) => void) => {
      const handler = (_e: IpcRendererEvent, data: { mapId: string; fogState: unknown }) => cb(data)
      ipcRenderer.on('maps:fogUpdate', handler)
      return () => ipcRenderer.removeListener('maps:fogUpdate', handler)
    },
    onRulerUpdate: (cb: (data: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('maps:rulerUpdate', handler)
      return () => ipcRenderer.removeListener('maps:rulerUpdate', handler)
    },
    onSpotlightUpdate: (cb: (data: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('maps:spotlightUpdate', handler)
      return () => ipcRenderer.removeListener('maps:spotlightUpdate', handler)
    },
    onGridUpdate: (cb: (data: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('maps:gridUpdate', handler)
      return () => ipcRenderer.removeListener('maps:gridUpdate', handler)
    },
  },
  dialog: {
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
    openMapImage: () => ipcRenderer.invoke('dialog:openMapImage')
  }
}

contextBridge.exposeInMainWorld('api', api)
