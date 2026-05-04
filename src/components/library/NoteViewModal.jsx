import React, { useState, useEffect } from 'react'
import { X, FileEdit, FileDown, Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import A4Preview from '../meetings/A4Preview'
import { makeT } from '../../utils/i18n'
import { exportSingleNote, formatDateForFilename } from '../../utils/export'

const FORMATS = ['pdf', 'docx', 'png']

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function slug(str) {
  return (str || '').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)
}

export default function NoteViewModal({ note, onEdit, onClose }) {
  const { templates, settings } = useApp()
  const internalNotesEnabled = !!settings?.internalNotesEnabled
  const hasStandard = note.modes?.standard !== false
  const hasInternal = !!note.modes?.internal
  const bothExist = internalNotesEnabled && hasStandard && hasInternal

  const [exportFormat, setExportFormat] = useState('pdf')
  const [exporting, setExporting] = useState(false)
  const [viewMode, setViewMode] = useState(() => hasInternal && !hasStandard ? 'internal' : 'standard')

  const isInternal = internalNotesEnabled && viewMode === 'internal' && hasInternal
  const resolvedTemplate = templates.find((t) => t.id === (isInternal ? (note.internalTemplateId || '') : note.templateId)) || null
  const exportT = makeT(note.language)
  const noteForView = { ...note, sections: isInternal ? (note.internalSections || []) : (note.sections || []) }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const modeTag = isInternal ? '_internal' : ''
      const base = `${formatDateForFilename(note.date)}_${slug(note.title || 'note')}${modeTag}`
      const ext = exportFormat === 'pdf' ? '.pdf' : exportFormat === 'docx' ? '.docx' : '.jpg'
      await exportSingleNote(noteForView, resolvedTemplate, exportFormat, base + ext)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-4 md:m-6 flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white truncate">{note.title || 'Untitled'}</h2>
              {isInternal && (
                <span className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <Lock size={10} /> INTERNAL
                </span>
              )}
            </div>
            {note.date && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(note.date)}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Mode switcher (when both exist) */}
            {bothExist && (
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('standard')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'standard' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >Standard</button>
                <button
                  onClick={() => setViewMode('internal')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${viewMode === 'internal' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  <Lock size={10} /> Internal
                </button>
              </div>
            )}

            {/* Export format picker */}
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
              onClick={() => { onEdit(); onClose() }}
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
        <div className="flex-1 overflow-y-auto py-6">
          <A4Preview note={noteForView} template={resolvedTemplate} t={exportT} isInternal={isInternal} />
        </div>
      </div>
    </div>
  )
}
