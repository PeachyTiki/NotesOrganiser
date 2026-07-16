import React from 'react'
import { X, Lock } from 'lucide-react'
import A4Preview from '../components/meetings/A4Preview'
import { makeT } from '../utils/i18n'
import { useRemoteAppState } from './useRemoteAppState'

const BACKDROP = 'bg-gradient-to-br from-gray-50 via-accent-light/80 to-accent-muted/25 dark:from-black dark:via-gray-950 dark:to-black'

function Header({ title, subtitle, isInternal, onClose }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 glass-pill border-b border-white/60 dark:border-white/10 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</p>
        {isInternal && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Lock size={9} /> INTERNAL
          </span>
        )}
      </div>
      {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0">{subtitle}</p>}
      <button
        onClick={onClose}
        className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors shrink-0"
        style={{ WebkitAppRegion: 'no-drag' }}
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function NotePreviewApp() {
  const remoteState = useRemoteAppState()
  const noteId = new URLSearchParams(window.location.search).get('noteId')
  const close = () => window.electronAPI?.closeCurrentWindow?.()

  if (!remoteState) {
    return (
      <div className={`h-screen flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 ${BACKDROP}`}>
        Loading…
      </div>
    )
  }

  const note = (remoteState.meetingNotes || []).find((n) => n.id === noteId)
  if (!note) {
    return (
      <div className={`h-screen flex flex-col ${BACKDROP}`}>
        <Header title="Meeting note" onClose={close} />
        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          This note could not be found — it may have been deleted.
        </div>
      </div>
    )
  }

  const tasksEnabled = !!remoteState.settings?.tasksEnabled
  const stripTasks = (secs) => (tasksEnabled ? secs : (secs || []).filter((s) => s.type !== 'tasks'))

  const hasStandard = note.modes?.standard !== false
  const hasInternal = !!remoteState.settings?.internalNotesEnabled && !!note.modes?.internal
  const isInternal = hasInternal && !hasStandard

  const sections = isInternal ? note.internalSections : note.sections
  const templateId = isInternal ? note.internalTemplateId : note.templateId
  const template = (remoteState.templates || []).find((tpl) => tpl.id === templateId) || null
  const noteForPreview = { ...note, sections: stripTasks(sections || []) }
  const t = makeT(note.language)

  return (
    <div className={`h-screen flex flex-col relative isolate ${BACKDROP}`}>
      <div className="pointer-events-none fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-accent/40 dark:bg-accent/12 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 w-96 h-96 rounded-full bg-accent-muted/35 dark:bg-accent-muted/10 blur-3xl" />
      </div>
      <Header
        title={note.title || note.customer || 'Untitled'}
        subtitle={formatDate(note.date)}
        isInternal={isInternal}
        onClose={close}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <A4Preview note={noteForPreview} template={template} t={t} isInternal={isInternal} />
      </div>
    </div>
  )
}
