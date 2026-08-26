import type { BrowserWindow } from 'electron'

// The DM's main window, tracked separately from index.ts so other main-
// process modules (like the party-sync server) can push to it without an
// import cycle back into the app's entry point.
let win: BrowserWindow | null = null

export function setMainWin(w: BrowserWindow): void {
  win = w
}

export function getMainWin(): BrowserWindow | null {
  return win
}
