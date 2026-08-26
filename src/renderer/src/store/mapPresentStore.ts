import { create } from 'zustand'

// Presentation state must survive MapPage unmounting when the DM switches
// to another tab (e.g. Encounter) and back — otherwise it resets while the
// actual TV window (tracked independently in the main process) is still
// open, and the two go out of sync: fog/effects pushes get silently
// swallowed and the DM's view can snap back to a different map than the
// one actually on screen. See MapPage's `presenting`/`mapStack` usage.
interface MapPresentState {
  presenting: boolean
  setPresenting: (v: boolean) => void

  mapStack: string[]
  setMapStack: (stack: string[] | ((prev: string[]) => string[])) => void
}

export const useMapPresentStore = create<MapPresentState>((set) => ({
  presenting: false,
  setPresenting: (v) => set({ presenting: v }),

  mapStack: [],
  setMapStack: (stack) =>
    set((s) => ({ mapStack: typeof stack === 'function' ? stack(s.mapStack) : stack }))
}))
