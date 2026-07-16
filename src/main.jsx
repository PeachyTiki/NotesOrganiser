import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import TaskWidgetApp from './widgets/TaskWidgetApp'
import NotePreviewApp from './widgets/NotePreviewApp'
import { applyAccentVars } from './utils/colorUtils'
import './index.css'

// The main window loads this bundle with no query string. Floating popup
// windows load the same bundle with `?widget=tasks` / `?widget=notePreview`
// so we mount a lightweight widget root instead of the full app.
const params = new URLSearchParams(window.location.search)
const widget = params.get('widget')
const Root = widget === 'tasks' ? TaskWidgetApp : widget === 'notePreview' ? NotePreviewApp : App

// Popup windows get their opener's current dark/accent state via the query
// string (see electron/main.cjs). Apply it synchronously, before the first
// paint, so the window never flashes the wrong theme while it waits on the
// async state hand-off that useRemoteAppState performs after mount.
if (widget) {
  const initialDark = params.get('dark') === '1'
  const initialAccent = initialDark
    ? (params.get('accentDark') || '#FF6B6B')
    : (params.get('accentLight') || '#ff0000')
  document.documentElement.classList.toggle('dark', initialDark)
  applyAccentVars(initialAccent)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
