import { createContext, useCallback, useContext, useState } from 'react'

// Renderer runs with `sandbox: true` (see electron/main.cjs), so native
// window.alert()/confirm() are proxied to real OS dialogs — a known Electron/
// Chromium failure mode where the BrowserWindow can fail to properly regain
// keyboard focus afterward, leaving inputs unresponsive until the app is
// restarted. This provider replaces both with in-app, promise-based modals
// that never leave the renderer, so focus is never at risk.
const DialogContext = createContext(null)

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null) // { type: 'confirm'|'alert', title, message, confirmLabel, cancelLabel, danger, resolve }

  const confirm = useCallback((opts) => {
    const options = typeof opts === 'string' ? { message: opts } : opts
    return new Promise((resolve) => setDialog({ type: 'confirm', resolve, ...options }))
  }, [])

  const alertUser = useCallback((opts) => {
    const options = typeof opts === 'string' ? { message: opts } : opts
    return new Promise((resolve) => setDialog({ type: 'alert', resolve, ...options }))
  }, [])

  const close = (result) => {
    setDialog((d) => { d?.resolve?.(result); return null })
  }

  return (
    <DialogContext.Provider value={{ confirm, alertUser }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/35 backdrop-blur-md" onClick={() => close(false)} />
          <div className="relative dropdown-panel rounded-2xl p-6 max-w-sm w-full mx-4">
            {dialog.title && (
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{dialog.title}</h3>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 whitespace-pre-line">{dialog.message}</p>
            <div className="flex gap-2 justify-end flex-wrap">
              {dialog.type === 'confirm' && (
                <button className="btn-ghost text-sm" onClick={() => close(false)}>
                  {dialog.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                className={
                  dialog.type === 'confirm' && dialog.danger
                    ? 'text-sm px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors'
                    : 'btn-primary text-sm'
                }
                onClick={() => close(true)}
                autoFocus
              >
                {dialog.type === 'confirm' ? (dialog.confirmLabel || 'Confirm') : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

function useDialogContext() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useConfirm/useAlert must be used within a DialogProvider')
  return ctx
}

// const ok = await confirm({ title, message, confirmLabel, cancelLabel, danger })
export function useConfirm() {
  return useDialogContext().confirm
}

// await alertUser({ title, message }) — resolves once the user dismisses it
export function useAlert() {
  return useDialogContext().alertUser
}
