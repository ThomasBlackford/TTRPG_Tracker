import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const api = {
  cards: {
    list: (filter?: { type?: string }) => ipcRenderer.invoke('cards:list', filter),
    get: (id: string) => ipcRenderer.invoke('cards:get', id),
    getMany: (ids: string[]) => ipcRenderer.invoke('cards:getMany', ids),
    getBacklinks: (cardId: string) => ipcRenderer.invoke('cards:getBacklinks', cardId),
    getChildren: (parentId: string) => ipcRenderer.invoke('cards:getChildren', parentId),
    save: (card: Record<string, unknown>) => ipcRenderer.invoke('cards:save', card),
    delete: (id: string) => ipcRenderer.invoke('cards:delete', id)
  },
  timeline: {
    list: () => ipcRenderer.invoke('timeline:list'),
    save: (event: Record<string, unknown>) => ipcRenderer.invoke('timeline:save', event),
    delete: (id: string) => ipcRenderer.invoke('timeline:delete', id),
  },
  party: {
    getMembers: () => ipcRenderer.invoke('party:getMembers'),
    saveMember: (member: Record<string, unknown>) => ipcRenderer.invoke('party:saveMember', member),
    deleteMember: (id: string) => ipcRenderer.invoke('party:deleteMember', id),
    updateResources: (id: string, resources: unknown[]) =>
      ipcRenderer.invoke('party:updateResources', id, resources),
    getReputation: (memberId: string) => ipcRenderer.invoke('party:getReputation', memberId),
    setReputation: (memberId: string, factionId: string, score: number) =>
      ipcRenderer.invoke('party:setReputation', memberId, factionId, score)
  },
  monsters: {
    list: () => ipcRenderer.invoke('monsters:list'),
    save: (m: unknown) => ipcRenderer.invoke('monsters:save', m),
    delete: (id: string) => ipcRenderer.invoke('monsters:delete', id)
  },
  tokens: {
    list: (mapId: string) => ipcRenderer.invoke('tokens:list', mapId),
    save: (token: unknown) => ipcRenderer.invoke('tokens:save', token),
    delete: (id: string) => ipcRenderer.invoke('tokens:delete', id),
    placeCombatants: (mapId: string) => ipcRenderer.invoke('tokens:placeCombatants', mapId),
    push: (mapId: string) => ipcRenderer.invoke('tokens:push', mapId),
    onUpdate: (cb: (data: { mapId: string; tokens: unknown[] }) => void) => {
      const handler = (_e: IpcRendererEvent, data: { mapId: string; tokens: unknown[] }) => cb(data)
      ipcRenderer.on('maps:tokensUpdate', handler)
      return () => ipcRenderer.removeListener('maps:tokensUpdate', handler)
    }
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
    pushFogLive: (data: { mapId: string; fogState: unknown }) => ipcRenderer.invoke('maps:pushFogLive', data),
    // Session-only push (no DB)
    pushRuler: (data: unknown) => ipcRenderer.invoke('maps:pushRuler', data),
    pushSpotlight: (data: unknown) => ipcRenderer.invoke('maps:pushSpotlight', data),
    pushGrid: (data: unknown) => ipcRenderer.invoke('maps:pushGrid', data),
    pushEffect: (data: { id: string; type: string; x?: number; y?: number }) =>
      ipcRenderer.invoke('maps:pushEffect', data),
    pushRay: (data: unknown) => ipcRenderer.invoke('maps:pushRay', data),
    pushZones: (data: unknown) => ipcRenderer.invoke('maps:pushZones', data),
    pushAmbientVfx: (data: { rain: boolean; stormLightning: boolean }) =>
      ipcRenderer.invoke('maps:pushAmbientVfx', data),
    // Presentation window
    openPresentation: (mapId: string) => ipcRenderer.invoke('maps:openPresentation', mapId),
    closePresentation: () => ipcRenderer.invoke('maps:closePresentation'),
    toggleFullscreen: () => ipcRenderer.invoke('maps:toggleFullscreen'),
    setFullscreen: (value: boolean) => ipcRenderer.invoke('maps:setFullscreen', value),
    // Handout
    pushHandout: (imagePath: string) => ipcRenderer.invoke('maps:pushHandout', imagePath),
    clearHandout: () => ipcRenderer.invoke('maps:clearHandout'),
    // Scene
    setScene: (data: unknown) => ipcRenderer.invoke('maps:setScene', data),
    clearScene: () => ipcRenderer.invoke('maps:clearScene'),
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
    onEffectUpdate: (cb: (data: { id: string; type: string; x?: number; y?: number }) => void) => {
      const handler = (_e: IpcRendererEvent, data: { id: string; type: string; x?: number; y?: number }) => cb(data)
      ipcRenderer.on('maps:effectUpdate', handler)
      return () => ipcRenderer.removeListener('maps:effectUpdate', handler)
    },
    onRayUpdate: (cb: (data: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('maps:rayUpdate', handler)
      return () => ipcRenderer.removeListener('maps:rayUpdate', handler)
    },
    onZonesUpdate: (cb: (data: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('maps:zonesUpdate', handler)
      return () => ipcRenderer.removeListener('maps:zonesUpdate', handler)
    },
    onAmbientVfxUpdate: (cb: (data: { rain: boolean; stormLightning: boolean }) => void) => {
      const handler = (_e: IpcRendererEvent, data: { rain: boolean; stormLightning: boolean }) => cb(data)
      ipcRenderer.on('maps:ambientVfxUpdate', handler)
      return () => ipcRenderer.removeListener('maps:ambientVfxUpdate', handler)
    },
    onHandoutUpdate: (cb: (data: { imagePath: string } | null) => void) => {
      const handler = (_e: IpcRendererEvent, data: { imagePath: string } | null) => cb(data)
      ipcRenderer.on('maps:handoutUpdate', handler)
      return () => ipcRenderer.removeListener('maps:handoutUpdate', handler)
    },
    onSceneUpdate: (cb: (data: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, data: unknown) => cb(data)
      ipcRenderer.on('maps:sceneUpdate', handler)
      return () => ipcRenderer.removeListener('maps:sceneUpdate', handler)
    },
  },
  encounter: {
    getState: () => ipcRenderer.invoke('encounter:getState'),
    start: () => ipcRenderer.invoke('encounter:start'),
    end: () => ipcRenderer.invoke('encounter:end'),
    addMonster: (data: unknown) => ipcRenderer.invoke('encounter:addMonster', data),
    addPartyMember: (memberId: string) => ipcRenderer.invoke('encounter:addPartyMember', memberId),
    updateCombatant: (id: string, changes: unknown) => ipcRenderer.invoke('encounter:updateCombatant', id, changes),
    removeCombatant: (id: string) => ipcRenderer.invoke('encounter:removeCombatant', id),
    nextTurn: () => ipcRenderer.invoke('encounter:nextTurn'),
    applyHp: (id: string, amount: number, mode?: string) => ipcRenderer.invoke('encounter:applyHp', id, amount, mode),
    rollMonsterInitiative: (opts: unknown) => ipcRenderer.invoke('encounter:rollMonsterInitiative', opts),
    prevTurn: () => ipcRenderer.invoke('encounter:prevTurn'),
    onUpdate: (cb: (state: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, state: unknown) => cb(state)
      ipcRenderer.on('encounter:update', handler)
      return () => ipcRenderer.removeListener('encounter:update', handler)
    },
  },
  partySync: {
    command: (clientId: string, command: unknown) => ipcRenderer.invoke('partySync:command', clientId, command),
    broadcast: (command: unknown, clientIds?: string[]) => ipcRenderer.invoke('partySync:broadcast', command, clientIds),
    handout: (clientIds: string[] | null, data: unknown) => ipcRenderer.invoke('partySync:handout', clientIds, data),
    setRequireCode: (on: boolean) => ipcRenderer.invoke('partySync:setRequireCode', on),
    regenerateCode: () => ipcRenderer.invoke('partySync:regenerateCode'),
    clearRolls: () => ipcRenderer.invoke('partySync:clearRolls'),
    start: () => ipcRenderer.invoke('partySync:start'),
    stop: () => ipcRenderer.invoke('partySync:stop'),
    status: () => ipcRenderer.invoke('partySync:status'),
    reply: (clientId: string, text: string) => ipcRenderer.invoke('partySync:reply', clientId, text),
    onUpdate: (cb: (state: unknown) => void) => {
      const handler = (_e: IpcRendererEvent, state: unknown) => cb(state)
      ipcRenderer.on('partySync:update', handler)
      return () => ipcRenderer.removeListener('partySync:update', handler)
    },
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
    info: () => ipcRenderer.invoke('backup:info'),
    openFolder: () => ipcRenderer.invoke('backup:openFolder')
  },
  app: {
    version: () => ipcRenderer.invoke('app:version') as Promise<string>
  },
  updater: {
    status: () => ipcRenderer.invoke('updater:status'),
    install: () => ipcRenderer.invoke('updater:install'),
    onReady: (cb: () => void) => {
      const handler = () => cb()
      ipcRenderer.on('updater:ready', handler)
      return () => ipcRenderer.removeListener('updater:ready', handler)
    },
  },
  dialog: {
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
    openMapImage: () => ipcRenderer.invoke('dialog:openMapImage')
  }
}

contextBridge.exposeInMainWorld('api', api)
