// A stand-in for the `electron` module so main-process IPC code can be loaded
// and driven from tests: handlers register into a map, and tests call them the
// way the renderer would.
export type Handler = (event: unknown, ...args: any[]) => any // eslint-disable-line @typescript-eslint/no-explicit-any

export const handlers = new Map<string, Handler>()

export const ipcMain = {
  handle(channel: string, fn: Handler) {
    handlers.set(channel, fn)
  }
}

export async function invoke<T = any>(channel: string, ...args: unknown[]): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const h = handlers.get(channel)
  if (!h) throw new Error(`No handler registered for ${channel}`)
  return h({}, ...args)
}

export const app = {
  getPath: (name: string) => (globalThis as { __userData?: string }).__userData ?? name,
  getVersion: () => '0.0.0-test',
  isPackaged: false,
  relaunch() {},
  exit() {}
}

export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] as string[] }),
  showSaveDialog: async () => ({ canceled: true, filePath: undefined as string | undefined })
}

export const shell = { openPath() {}, openExternal() {}, showItemInFolder() {} }
export const screen = { getAllDisplays: () => [], getPrimaryDisplay: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }) }

export class BrowserWindow {
  static getAllWindows() { return [] }
  isDestroyed() { return false }
}

export const is = { dev: false }
