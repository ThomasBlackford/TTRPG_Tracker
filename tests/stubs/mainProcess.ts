// Stand-ins for the Electron-bound modules the player's sync client imports.
export const sent: [string, unknown][] = []
export const dbWrites: unknown[][] = []

export function getMainWin() {
  return {
    isDestroyed: () => false,
    webContents: { isDestroyed: () => false, send: (ch: string, p: unknown) => sent.push([ch, p]) }
  }
}

export function getDb() {
  return {
    prepare: () => ({
      get: () => ({ client_id: 'test-client-1' }),
      run: (...args: unknown[]) => { dbWrites.push(args) }
    })
  }
}
