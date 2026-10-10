export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

type Handler = (opts: ConfirmOptions) => Promise<boolean>
let handler: Handler | null = null

// ConfirmHost (mounted once in App) registers itself here.
export function registerConfirmHandler(fn: Handler | null): void {
  handler = fn
}

// Drop-in async replacement for window.confirm(). Electron's native
// confirm/alert dialogs on Windows are known to leave text inputs unable to
// take focus afterwards (until the window is alt-tabbed away and back), which
// looks like the app froze — so destructive prompts use an in-app dialog.
export function confirmAsync(opts: ConfirmOptions): Promise<boolean> {
  return handler ? handler(opts) : Promise.resolve(window.confirm(opts.title))
}
