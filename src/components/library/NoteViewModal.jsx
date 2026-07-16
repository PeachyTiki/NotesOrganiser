import React, { useState, useEffect } from 'react'
import { X, FileEdit, FileDown, Lock, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import A4Preview from '../meetings/A4Preview'
import { makeT } from '../../utils/i18n'
import { exportSingleNote, formatDateForFilename } from '../../utils/export'

const FORMATS = ['pdf', 'docx', 'png']
const ZOOM_STEP = 0.15
const ZOOM_MIN = 0.2
const ZOOM_MAX = 3.0

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function slug(str) {
  return (str || '').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)
}

export default function NoteViewModal({ note, onEdit, onClose }) {
  const { templates, settings, meetingNotes } = useApp()
  const internalNotesEnabled = !!settings?.internalNotesEnabled
  const tasksEnabled = !!settings?.tasksEnabled
  const stripTasks = (secs) => tasksEnabled ? secs : (secs || []).filter((s) => s.type !== 'tasks')

  // Build sorted series for navigation (newest first)
  const seriesNotes = note.recurringMeetingId
    ? meetingNotes
        .filter((n) => n.recurringMeetingId === note.recurringMeetingId && !n.isDraft)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : [note]

  const [currentIdx, setCurrentIdx] = useState(() => {
    const idx = seriesNotes.findIndex((n) => n.id === note.id)
    return idx >= 0 ? idx : 0
  })

  const currentNote = seriesNotes[currentIdx] || note
  const hasStandard = currentNote.modes?.standard !== false
  const hasInternal = internalNotesEnabled && !!currentNote.modes?.internal
  const bothExist = hasStandard && hasInternal

  const [viewMode, setViewMode] = useState(() => hasInternal && !hasStandard ? 'internal' : 'standard')
  const [viewZoom, setViewZoom] = useState(1)
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exporting, setExporting] = useState(false)

  // If navigating to a note where the current viewMode is invalid, auto-correct
  useEffect(() => {
    const hs = currentNote.modes?.standard !== false
    const hi = internalNotesEnabled && !!currentNote.modes?.internal
    if (viewMode === 'internal' && !hi) setViewMode('standard')
    if (viewMode === 'both' && (!hs || !hi)) setViewMode(hi ? 'internal' : 'standard')
  }, [currentIdx])

  const effectiveViewMode =
    viewMode === 'both' && !bothExist ? (hasInternal ? 'internal' : 'standard') :
    viewMode === 'internal' && !hasInternal ? 'standard' :
    viewMode

  const stdTemplate = templates.find((t) => t.id === currentNote.templateId) || null
  const intTemplate = templates.find((t) => t.id === currentNote.internalTemplateId) || null
  const exportT = makeT(currentNote.language)

  const stdNote = { ...currentNote, sections: stripTasks(currentNote.sections || []) }
  const intNote = { ...currentNote, sections: stripTasks(currentNote.internalSections || []) }
  const isInternal = effectiveViewMode === 'internal'
  const noteForExport = isInternal ? intNote : stdNote
  const templateForExport = isInternal ? intTemplate : stdTemplate

  // Navigation
  const hasPrev = currentIdx < seriesNotes.length - 1  // older meeting
  const hasNext = currentIdx > 0                        // newer meeting

  // Zoom helpers
  const zoomIn  = () => setViewZoom((z) => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2))))
  const zoomOut = () => setViewZoom((z) => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2))))
  const zoomReset = () => setViewZoom(1)

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase()
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target?.isContentEditable
      if (e.key === 'Escape') { onClose(); return }
      if (!inInput) {
        if (e.key === 'ArrowLeft')  { if (hasPrev) setCurrentIdx((i) => i + 1); return }
        if (e.key === 'ArrowRight') { if (hasNext) setCurrentIdx((i) => i - 1); return }
        if (e.key === '=' || e.key === '+') { setViewZoom((z) => Math.min(ZOOM_MAX, parseFloat((z + ZOOM_STEP).toFixed(2)))); return }
        if (e.key === '-' || e.key === '_') { setViewZoom((z) => Math.max(ZOOM_MIN, parseFloat((z - ZOOM_STEP).toFixed(2)))); return }
        if (e.key === '0') { setViewZoom(1); return }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, hasPrev, hasNext])

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const modeTag = isInternal ? '_internal' : ''
      const base = `${formatDateForFilename(currentNote.date)}_${slug(currentNote.title || 'note')}${modeTag}`
      const ext = exportFormat === 'pdf' ? '.pdf' : exportFormat === 'docx' ? '.docx' : '.jpg'
      await exportSingleNote(noteForExport, templateForExport, exportFormat, base + ext)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative z-10 m-4 md:m-6 flex-1 flex flex-col dropdown-panel rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 glass-pill border-b border-white/60 dark:border-white/10 shrink-0">

          {/* Prev / title / next */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {seriesNotes.length > 1 && (
              <button
                onClick={() => setCurrentIdx((i) => i + 1)}
                disabled={!hasPrev}
                className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors shrink-0"
                title="Older meeting (←)"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                  {currentNote.title || 'Untitled'}
                </h2>
                {isInternal && (
                  <span className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <Lock size={10} /> INTERNAL
                  </span>
                )}
              </div>
              {currentNote.date && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {formatDate(currentNote.date)}
                  {seriesNotes.length > 1 && (
                    <span className="ml-2 text-gray-300 dark:text-gray-600">
                      {currentIdx + 1} / {seriesNotes.length}
                    </span>
                  )}
                </p>
              )}
            </div>

            {seriesNotes.length > 1 && (
              <button
                onClick={() => setCurrentIdx((i) => i - 1)}
                disabled={!hasNext}
                className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors shrink-0"
                title="Newer meeting (→)"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* Export + Edit + Close */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setExportFormat(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    exportFormat === f
                      ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <FileDown size={14} />
              {exporting ? 'Exporting…' : 'Export'}
            </button>
            <button
              onClick={() => { onEdit(currentNote); onClose() }}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <FileEdit size={14} /> Edit
            </button>
            <button onClick={onClose} className="btn-ghost p-1.5 ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-y-auto py-6 px-6 pb-20">
          {effectiveViewMode === 'both' ? (
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Standard</p>
                <A4Preview
                  note={stdNote}
                  template={stdTemplate}
                  t={exportT}
                  isInternal={false}
                  externalZoom={viewZoom}
                  onZoomChange={setViewZoom}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Internal</p>
                <A4Preview
                  note={intNote}
                  template={intTemplate}
                  t={exportT}
                  isInternal={true}
                  externalZoom={viewZoom}
                  onZoomChange={setViewZoom}
                />
              </div>
            </div>
          ) : (
            <A4Preview
              note={effectiveViewMode === 'internal' ? intNote : stdNote}
              template={effectiveViewMode === 'internal' ? intTemplate : stdTemplate}
              t={exportT}
              isInternal={effectiveViewMode === 'internal'}
              externalZoom={viewZoom}
              onZoomChange={setViewZoom}
            />
          )}
        </div>

        {/* Bottom-centre floating bar: view mode toggle + zoom */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center dropdown-panel rounded-full overflow-hidden select-none">
          {bothExist && (
            <>
              <button
                onClick={() => setViewMode('standard')}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  effectiveViewMode === 'standard'
                    ? 'text-gray-800 dark:text-gray-200'
                    : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
                }`}
              >
                Standard
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0" />
              <button
                onClick={() => setViewMode('both')}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  effectiveViewMode === 'both'
                    ? 'text-gray-800 dark:text-gray-200'
                    : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
                }`}
              >
                Both
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0" />
              <button
                onClick={() => setViewMode('internal')}
                className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1 ${
                  effectiveViewMode === 'internal'
                    ? 'text-gray-800 dark:text-gray-200'
                    : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
                }`}
              >
                <Lock size={10} /> Internal
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0" />
            </>
          )}
          <button
            onClick={zoomOut}
            disabled={viewZoom <= ZOOM_MIN}
            className="px-3 py-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors"
            title="Zoom out (−)"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={zoomReset}
            className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 w-12 text-center transition-colors"
            title="Reset zoom (0)"
          >
            {Math.round(viewZoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={viewZoom >= ZOOM_MAX}
            className="px-3 py-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 transition-colors"
            title="Zoom in (+)"
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
