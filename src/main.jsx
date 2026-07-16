import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import TaskWidgetApp from './widgets/TaskWidgetApp'
import NotePreviewApp from './widgets/NotePreviewApp'
import './index.css'

// The main window loads this bundle with no query string. Floating popup
// windows load the same bundle with `?widget=tasks` / `?widget=notePreview`
// so we mount a lightweight widget root instead of the full app.
const widget = new URLSearchParams(window.location.search).get('widget')
const Root = widget === 'tasks' ? TaskWidgetApp : widget === 'notePreview' ? NotePreviewApp : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
