import React, { useState, useEffect } from 'react'
import { X, FileEdit, FileDown } from 'lucide-react'
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
  const { templates } = useApp()
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exporting, setExporting] = useState(false)

  const resolvedTemplate = templates.find((t) => t.id === note.templateId) || null
  const exportT = makeT(note.language)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const base = `${formatDateForFilename(note.date)}_${slug(note.title || 'note')}`
      const ext = exportFormat === 'pdf' ? '.pdf' : exportFormat === 'docx' ? '.docx' : '.jpg'
      await exportSingleNote(note, resolvedTemplate, exportFormat, base + ext)
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
            <h2 className="font-semibold text-gray-900 dark:text-white truncate">{note.title || 'Untitled'}</h2>
            {note.date && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(note.date)}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
          <A4Preview note={note} template={resolvedTemplate} t={exportT} />
        </div>
      </div>
    </div>
  )
}
