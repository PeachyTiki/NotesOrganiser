import { useEffect, useState } from 'react'
import { applyAccentVars } from '../utils/colorUtils'

const DEFAULT_ACCENT_LIGHT = '#ff0000'
const DEFAULT_ACCENT_DARK = '#FF6B6B'

// Popup windows (task widget, note preview) have no localStorage copy of
// their own — they mirror whatever the main window last broadcast over IPC.
export function useRemoteAppState() {
  const [remoteState, setRemoteState] = useState(null)

  useEffect(() => {
    window.electronAPI?.getWidgetState?.().then((s) => { if (s) setRemoteState(s) })
    return window.electronAPI?.onWidgetStateUpdate?.((s) => setRemoteState(s))
  }, [])

  useEffect(() => {
    if (!remoteState) return
    document.documentElement.classList.toggle('dark', !!remoteState.darkMode)
    const hex = remoteState.darkMode
      ? (remoteState.settings?.accentDark || DEFAULT_ACCENT_DARK)
      : (remoteState.settings?.accentLight || DEFAULT_ACCENT_LIGHT)
    applyAccentVars(hex, !!remoteState.darkMode)
  }, [remoteState])

  return remoteState
}
