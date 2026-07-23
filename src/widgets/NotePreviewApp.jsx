import React, { useState } from 'react'
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

const pillCls = (active) =>
  `px-4 py-2 text-xs font-medium transition-colors ${
    active
      ? 'text-gray-800 dark:text-gray-200'
      : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
  }`

export default function NotePreviewApp() {
  const remoteState = useRemoteAppState()
  const [viewMode, setViewMode] = useState('standard')
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
  const bothExist = hasStandard && hasInternal

  // Resolve the requested view against what this note actually has.
  const effective =
    viewMode === 'both' && !bothExist ? (hasInternal && !hasStandard ? 'internal' : 'standard') :
    viewMode === 'internal' && !hasInternal ? 'standard' :
    viewMode === 'standard' && !hasStandard ? 'internal' :
    viewMode
  const isInternal = effective === 'internal'

  const t = makeT(note.language)
  const templates = remoteState.templates || []
  const stdTemplate = templates.find((tpl) => tpl.id === note.templateId) || null
  const intTemplate = templates.find((tpl) => tpl.id === note.internalTemplateId) || null
  const stdNote = { ...note, sections: stripTasks(note.sections || []) }
  const intNote = { ...note, sections: stripTasks(note.internalSections || []) }

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
      <div className={`flex-1 overflow-y-auto p-4 ${bothExist ? 'pb-16' : ''}`}>
        {effective === 'both' ? (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Standard</p>
              <A4Preview note={stdNote} template={stdTemplate} t={t} isInternal={false} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Lock size={10} /> Internal
              </p>
              <A4Preview note={intNote} template={intTemplate} t={t} isInternal={true} />
            </div>
          </div>
        ) : (
          <A4Preview
            note={isInternal ? intNote : stdNote}
            template={isInternal ? intTemplate : stdTemplate}
            t={t}
            isInternal={isInternal}
          />
        )}
      </div>

      {/* Standard / Both / Internal toggle — only when the note has both modes */}
      {bothExist && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center dropdown-panel rounded-full overflow-hidden select-none"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <button onClick={() => setViewMode('standard')} className={pillCls(effective === 'standard')}>Standard</button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0" />
          <button onClick={() => setViewMode('both')} className={pillCls(effective === 'both')}>Both</button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0" />
          <button onClick={() => setViewMode('internal')} className={`${pillCls(effective === 'internal')} flex items-center gap-1`}>
            <Lock size={10} /> Internal
          </button>
        </div>
      )}
    </div>
  )
}
