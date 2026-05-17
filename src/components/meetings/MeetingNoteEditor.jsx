import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, Save, Download, RefreshCw, Globe, Plus, Trash2, Clock, ChevronRight, ChevronDown, CheckSquare, MessageSquare, LayoutTemplate, X, Lock, Brain } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import html2canvas from 'html2canvas'
import { useApp } from '../../context/AppContext'
import {
  exportNoteAsPDF,
  exportNoteAsWord,
  captureChartImages,
  captureThumbPNG,
  downloadPDF,
  downloadDataURL,
  downloadBlob,
  formatDateForFilename,
  renderNoteToPdfBuffer,
  arrayBufferToBase64,
} from '../../utils/export'
import {
  noteMatchesSync, noteFilename, notePathParts, syncFileKey,
} from '../../utils/syncManager'
import { makeT, getSystemLanguage, LANGUAGES } from '../../utils/i18n'
import NoteExportCanvas from './NoteExportCanvas'
import A4Preview from './A4Preview'
import SectionList from './SectionList'
import Toggle from '../Toggle'
import NotesOverlay from './NotesOverlay'

const EXPORT_FORMATS = [
  { value: 'pdf',  label: 'PDF (.pdf)' },
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'png',  label: 'Image (.png)' },
]

function selfParticipant(settings) {
  if (!settings?.yourName) return null
  return { id: 'self', name: settings.yourName, firm: settings.yourFirm || '', role: settings.yourRole || '', enabled: true, isSelf: true }
}

function buildParticipants(recurringMeeting, settings) {
  const self = selfParticipant(settings)
  const fromMeeting = (recurringMeeting?.participants || [])
    .filter((p) => p.enabled !== false)
    .map((p) => ({ ...p, id: p.id || uuid(), enabled: true }))
    .filter((p) => p.name !== settings?.yourName)
  return self ? [self, ...fromMeeting] : fromMeeting
}

function computeAutoTitle(note, settings) {
  const customer = note.customer?.trim()
  const firm = settings?.yourFirm?.trim()
  const date = note.date
    ? new Date(note.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''
  return [customer, firm ? `x ${firm}` : null, date].filter(Boolean).join(' · ')
}

function copyStructureFromLastNote(sections) {
  return (sections || []).map((s) => {
    if (s.type === 'notes') return { ...s, id: uuid(), content: '' }  // AI notes: fresh each session
    if (s.type === 'text') return { ...s, id: uuid() }                // text: carry content forward
    if (s.type === 'topics') return {
      ...s, id: uuid(),
      items: (s.items || [])
        .filter((item) => item.status !== 'complete')
        .map((item) => ({ ...item, status: item.status === 'new' ? 'open' : item.status })),
    }
    if (s.type === 'tasks') return {
      ...s, id: uuid(),
      items: (s.items || []).filter((item) => item.status !== 'complete'),
    }
    if (s.type === 'risks') return {
      ...s, id: uuid(),
      items: (s.items || []).filter((item) => item.status !== 'mitigated' && item.status !== 'closed'),
    }
    if (s.type === 'resources') return { ...s, id: uuid() }  // resources: carry forward
    return { ...s, id: uuid() }
  })
}

function processTopicStatuses(sections) {
  return sections.map((s) => {
    if (s.type !== 'topics') return s
    return {
      ...s,
      items: (s.items || [])
        .filter((item) => item.status !== 'complete')
        .map((item) => ({ ...item, status: item.status === 'new' ? 'open' : item.status })),
    }
  })
}

function emptyNote(recurringMeeting, settings) {
  const defaultModes = recurringMeeting?.defaultModes || { standard: true, internal: false }
  return {
    id: uuid(),
    recurringMeetingId: recurringMeeting?.id || '',
    title: recurringMeeting?.name || '',
    customer: recurringMeeting?.customer || '',
    eventType: recurringMeeting?.eventType || '',
    team: recurringMeeting?.team || '',
    date: new Date().toISOString().slice(0, 10),
    language: recurringMeeting?.language || getSystemLanguage(),
    participants: buildParticipants(recurringMeeting, settings),
    templateId: recurringMeeting?.templateId || '',
    sections: [{ id: uuid(), type: 'notes', label: '', content: '' }, { id: uuid(), type: 'tasks', label: '', items: [] }],
    modes: defaultModes,
    internalSections: [{ id: uuid(), type: 'notes', label: '', content: '' }, { id: uuid(), type: 'tasks', label: '', items: [] }],
    internalTemplateId: '',
    displayOptions: { showParticipants: true, showRoles: true, showFirms: true, showEventType: true },
    createdAt: new Date().toISOString(),
  }
}


export default function MeetingNoteEditor({ recurringMeetingId, existingNote, prefilledCustomer, onClose }) {
  const { recurringMeetings, templates, saveMeetingNote, meetingNotes, settings, update, t, sectionPresets, saveSectionPreset, deleteSectionPreset, syncConfigs, syncFileMap, updateSyncFileMap, triggerNoteSync } = useApp()
  const effectiveRecurringMeetingId = existingNote?.recurringMeetingId || recurringMeetingId
  const recurringMeeting = recurringMeetings.find((m) => m.id === effectiveRecurringMeetingId)

  const [note, setNote] = useState(() => {
    if (existingNote) return { ...existingNote }
    const base = emptyNote(recurringMeeting, settings)
    if (prefilledCustomer) base.customer = prefilledCustomer
    if (effectiveRecurringMeetingId) {
      const lastNote = meetingNotes
        .filter((n) => n.recurringMeetingId === effectiveRecurringMeetingId && !n.isDraft)
        .sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || ''))[0]
      if (lastNote?.sections?.length) {
        base.sections = copyStructureFromLastNote(lastNote.sections)
        if (!base.sections.some((s) => s.type === 'notes')) {
          base.sections = [{ id: uuid(), type: 'notes', label: '', content: '' }, ...base.sections]
        }
        if (!base.sections.some((s) => s.type === 'tasks')) {
          base.sections = [...base.sections, { id: uuid(), type: 'tasks', label: '', items: [] }]
        }
      }
    }
    return base
  })
  const [exporting, setExporting] = useState(false)
  const [showCanvas, setShowCanvas] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const [lastAutoSave, setLastAutoSave] = useState(null)
  const [contextOpen, setContextOpen] = useState(true)
  const [exportFormat, setExportFormat] = useState(settings?.exportFormat || 'pdf')
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [activeMode, setActiveMode] = useState(() => {
    const m = (existingNote || {}).modes || {}
    return m.internal && !m.standard ? 'internal' : 'standard'
  })
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [presetNameError, setPresetNameError] = useState(false)
  const [savingPreset, setSavingPreset] = useState(false)
  const presetInputRef = useRef(null)
  const latestRef = useRef(null)
  const handleSaveRef = useRef(null)
  const undoRef = useRef(null)
  const redoRef = useRef(null)
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const isRestoringRef = useRef(false)
  const textHistoryTimerRef = useRef(null)

  const [dirty, setDirty] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [lastDraftSave, setLastDraftSave] = useState(null)
  const [notesOverlayOpen, setNotesOverlayOpen] = useState(false)
  const [openNotesToken, setOpenNotesToken] = useState(null)

  const STRUCTURAL_KEYS = new Set(['sections', 'internalSections', 'modes', 'templateId', 'internalTemplateId'])

  const pushHistorySnapshot = (snapshot) => {
    const history = historyRef.current.slice(0, historyIndexRef.current + 1)
    history.push(JSON.parse(JSON.stringify(snapshot)))
    historyRef.current = history
    historyIndexRef.current = history.length - 1
  }

  const set = (key, value) => {
    if (isRestoringRef.current) {
      setNote((n) => ({ ...n, [key]: value }))
      return
    }
    setDirty(true)
    setNote((n) => ({ ...n, [key]: value }))
    if (STRUCTURAL_KEYS.has(key)) {
      pushHistorySnapshot({ ...note, [key]: value })
    } else {
      clearTimeout(textHistoryTimerRef.current)
      textHistoryTimerRef.current = setTimeout(() => {
        if (isRestoringRef.current) return
        pushHistorySnapshot(latestRef.current?.note || note)
      }, 1500)
    }
  }

  const undo = () => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current--
    const snapshot = historyRef.current[historyIndexRef.current]
    if (!snapshot) return
    const active = document.activeElement
    if (active && active !== document.body) active.blur()
    isRestoringRef.current = true
    setNote(JSON.parse(JSON.stringify(snapshot)))
    setTimeout(() => { isRestoringRef.current = false }, 50)
  }

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    const snapshot = historyRef.current[historyIndexRef.current]
    if (!snapshot) return
    const active = document.activeElement
    if (active && active !== document.body) active.blur()
    isRestoringRef.current = true
    setNote(JSON.parse(JSON.stringify(snapshot)))
    setTimeout(() => { isRestoringRef.current = false }, 50)
  }
  const setDisplayOption = (key, val) => {
    setDirty(true)
    setNote((n) => ({ ...n, displayOptions: { showParticipants: true, showRoles: true, showFirms: true, showEventType: true, ...(n.displayOptions || {}), [key]: val } }))
  }

  const exportT = makeT(note.language)
  const resolvedTemplate = templates.find((tpl) => tpl.id === note.templateId) || null
  const isEditingExisting = !!existingNote
  const isOneOff = !note.recurringMeetingId
  const autoTitle = computeAutoTitle(note, settings)
  const effectiveTitle = note.title.trim() || autoTitle || 'Untitled Meeting'

  const internalNotesEnabled = !!settings?.internalNotesEnabled
  const standardActive = note.modes?.standard !== false
  const internalActive = internalNotesEnabled && !!note.modes?.internal
  const bothActive = standardActive && internalActive
  const resolvedInternalTemplate = templates.find((tpl) => tpl.id === note.internalTemplateId) || null

  const toggleMode = (mode, val) => {
    const next = { standard: note.modes?.standard !== false, internal: !!note.modes?.internal, [mode]: val }
    if (!next.standard && !next.internal) return
    set('modes', next)
    if (!val && activeMode === mode) setActiveMode(mode === 'standard' ? 'internal' : 'standard')
    if (val && !bothActive) setActiveMode(mode)
  }

  const updateParticipant = (id, key, value) =>
    set('participants', note.participants.map((p) => (p.id === id ? { ...p, [key]: value } : p)))
  const addParticipant = () =>
    set('participants', [...note.participants, { id: uuid(), name: '', firm: '', role: '', enabled: true }])
  const removeParticipant = (id) =>
    set('participants', note.participants.filter((p) => p.id !== id))

  const finalNote = useCallback(
    () => ({ ...note, title: effectiveTitle }),
    [note, effectiveTitle]
  )

  // Keep latest note + title in ref for interval
  useEffect(() => { latestRef.current = { note, effectiveTitle } })
  // Keep save/undo/redo in refs for keyboard shortcuts
  useEffect(() => { handleSaveRef.current = handleSave; undoRef.current = undo; redoRef.current = redo })

  // Initialize undo history on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { pushHistorySnapshot(note) }, [])

  // Close presets dropdown on outside click
  useEffect(() => {
    if (!presetsOpen) return
    const handler = (e) => {
      if (!e.target.closest('[data-presets-container]')) {
        setPresetsOpen(false)
        setSavingPreset(false)
        setPresetNameInput('')
        setPresetNameError(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [presetsOpen])

  // Ctrl+S / Cmd+S to save; Ctrl+Z/Y for undo/redo (note-level snapshots)
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRef.current?.()
        return
      }
      const tag = (e.target?.tagName || '').toUpperCase()
      const isNativeInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target?.isContentEditable
      if (!isNativeInput && (e.ctrlKey || e.metaKey)) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          undoRef.current?.()
          return
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault()
          redoRef.current?.()
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-save draft every 30s to localStorage
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const { note: n, effectiveTitle: title } = latestRef.current
        localStorage.setItem('notes_organiser_autosave', JSON.stringify({ ...n, title, _autoSavedAt: new Date().toISOString() }))
        setLastAutoSave(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      } catch {}
    }, 30000)
    return () => clearInterval(id)
  }, [])

  // Last session context: most recent saved (non-draft) note for this recurring meeting
  const lastSessionNote = !isOneOff && effectiveRecurringMeetingId
    ? meetingNotes
        .filter((n) => n.recurringMeetingId === effectiveRecurringMeetingId && n.id !== note.id && !n.isDraft)
        .sort((a, b) => (b.updatedAt || b.date || '').localeCompare(a.updatedAt || a.date || ''))[0] || null
    : null

  const lastSessionOpenTopics = lastSessionNote
    ? (lastSessionNote.sections || [])
        .filter((s) => s.type === 'topics')
        .flatMap((s) => (s.items || []).filter((i) => i.status !== 'complete' && i.topic))
    : []

  const lastSessionPendingActions = lastSessionNote
    ? (lastSessionNote.sections || [])
        .filter((s) => s.type === 'tasks')
        .flatMap((s) => (s.items || []).filter((i) => i.status !== 'complete' && i.text))
    : []

  const hasLastSessionContext = lastSessionOpenTopics.length > 0 || lastSessionPendingActions.length > 0

  const handleSave = () => {
    const processed = processTopicStatuses(note.sections)
    const processedInternal = processTopicStatuses(note.internalSections || [])
    const saved = { ...finalNote(), sections: processed, internalSections: processedInternal, isDraft: false, updatedAt: new Date().toISOString() }
    setNote((n) => ({ ...n, sections: processed, internalSections: processedInternal, isDraft: false }))
    saveMeetingNote(saved)
    setDirty(false)

    // Fire-and-forget auto-sync
    if (window.electronAPI) {
      const matchingConfigs = (syncConfigs || []).filter((cfg) => noteMatchesSync(saved, cfg))
      if (matchingConfigs.length > 0) {
        ;(async () => {
          try {
            const fileMapUpdates = {}
            const syncNote = async (noteForSync, template, isInternal) => {
              const buf = await renderNoteToPdfBuffer(noteForSync, template, exportT)
              const base64 = arrayBufferToBase64(buf)
              const filename = noteFilename(saved, isInternal)
              for (const cfg of matchingConfigs) {
                const key = syncFileKey(saved.id, cfg.id, isInternal)
                const oldPath = (syncFileMap || {})[key]
                if (oldPath) await window.electronAPI.deleteFile(oldPath).catch(() => {})
                const pathParts = notePathParts(saved, cfg, recurringMeetings)
                const result = await window.electronAPI.writeFile(pathParts, filename, base64)
                if (result?.ok && result?.filePath) fileMapUpdates[key] = result.filePath
              }
            }
            await syncNote({ ...saved, sections: processed }, resolvedTemplate, false)
            if (internalActive && (saved.internalSections || []).length > 0) {
              await syncNote({ ...saved, sections: processedInternal }, resolvedInternalTemplate, true)
            }
            if (Object.keys(fileMapUpdates).length > 0) updateSyncFileMap(fileMapUpdates)
          } catch (err) {
            console.error('[auto-sync] error', err)
          }
        })()
      }
    }

    onClose()
  }

  const handleSaveDraft = () => {
    const processed = processTopicStatuses(note.sections)
    const processedInternal = processTopicStatuses(note.internalSections || [])
    const saved = { ...finalNote(), sections: processed, internalSections: processedInternal, isDraft: true, updatedAt: new Date().toISOString() }
    setNote((n) => ({ ...n, sections: processed, internalSections: processedInternal, isDraft: true }))
    saveMeetingNote(saved)
    setDirty(false)
    setLastDraftSave(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  }

  const handleClose = () => {
    if (dirty) { setShowDiscardModal(true) } else { onClose() }
  }

  const doExport = async () => {
    setShowCanvas(true)
    setExporting(true)
    try {
      // Wait for the off-screen canvas to fully render (charts need a moment)
      await new Promise((r) => setTimeout(r, 350))

      const isExportingInternal = activeMode === 'internal' && internalActive
      const sectionsToExport = isExportingInternal
        ? processTopicStatuses(note.internalSections || [])
        : processTopicStatuses(note.sections)
      const templateToExport = isExportingInternal ? resolvedInternalTemplate : resolvedTemplate
      const exportedNote = { ...finalNote(), sections: sectionsToExport }
      const modeTag = isExportingInternal ? '_internal' : ''
      const base = `${formatDateForFilename(note.date)}_${effectiveTitle.replace(/\s+/g, '_')}${modeTag}`

      if (exportFormat === 'pdf') {
        const chartImgs = await captureChartImages(sectionsToExport)
        const pdf = await exportNoteAsPDF(exportedNote, templateToExport, chartImgs, exportT)
        downloadPDF(pdf, base + '.pdf')
      } else if (exportFormat === 'docx') {
        const chartImgs = await captureChartImages(sectionsToExport)
        const blob = await exportNoteAsWord(exportedNote, templateToExport, chartImgs, exportT)
        downloadBlob(blob, base + '.docx')
      } else if (exportFormat === 'png') {
        const el = document.getElementById('note-export-canvas')
        if (!el) throw new Error('Canvas element not found')
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
        downloadDataURL(canvas.toDataURL('image/png'), base + '.png')
      }

      // Update note with thumbnail + processed sections
      const thumb = await captureThumbPNG('note-export-canvas')
      const processedStandard = processTopicStatuses(note.sections)
      const processedInternal = processTopicStatuses(note.internalSections || [])
      setNote((n) => ({ ...n, sections: processedStandard, internalSections: processedInternal }))
      saveMeetingNote({ ...finalNote(), sections: processedStandard, internalSections: processedInternal, isDraft: false, exportData: thumb, updatedAt: new Date().toISOString() })
      setDirty(false)

      // Persist last-used format
      if (exportFormat !== settings?.exportFormat) {
        update({ settings: { ...settings, exportFormat } })
      }
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const previewNote = { ...finalNote() }
  const previewSections = activeMode === 'internal' && internalActive
    ? (note.internalSections || [])
    : (note.sections || [])
  const previewTemplate = activeMode === 'internal' && internalActive ? resolvedInternalTemplate : resolvedTemplate
  const previewNoteForMode = { ...previewNote, sections: previewSections }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleClose} className="btn-ghost flex items-center gap-1.5 text-sm shrink-0">
            <ArrowLeft size={15} /> Back
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {isEditingExisting ? 'Edit Meeting Note' : 'Write Meeting Note'}
              </h1>
              {note.isDraft && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
                  DRAFT
                </span>
              )}
            </div>
            <div className="mt-0.5">
              {isOneOff ? (
                <span className="text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                  One-off Meeting
                </span>
              ) : (
                <span className="text-xs font-medium bg-accent-light dark:bg-accent-light text-accent px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <RefreshCw size={10} /> Recurring: {recurringMeeting?.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {lastDraftSave && (
              <span className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1 whitespace-nowrap">
                <Save size={11} /> Draft saved {lastDraftSave}
              </span>
            )}
            {lastAutoSave && (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 whitespace-nowrap">
                <Clock size={11} /> Autosaved {lastAutoSave}
              </span>
            )}
            <button
              className="text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
              onClick={handleSaveDraft}
            >
              <Save size={14} /> Save Draft
            </button>
            <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={handleSave}>
              <Save size={14} /> Save
            </button>

            {/* Format selector */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setExportFormat(f.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    exportFormat === f.value
                      ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Single export/download button */}
            <button
              className="btn-primary flex items-center gap-2 text-sm"
              onClick={doExport}
              disabled={exporting}
            >
              <Download size={14} />
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Mode toggles + Notes button */}
      <div className="flex items-center gap-4 mb-4 px-1 flex-wrap">
        {internalNotesEnabled && (
          <>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 shrink-0">
              <Lock size={11} /> Note modes:
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Toggle
                checked={standardActive}
                onChange={(val) => toggleMode('standard', val)}
                disabled={standardActive && !internalActive}
              />
              <span className={`text-xs font-medium ${standardActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                Standard
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Toggle
                checked={internalActive}
                onChange={(val) => toggleMode('internal', val)}
                disabled={internalActive && !standardActive}
              />
              <span className={`text-xs font-medium ${internalActive ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                Internal
              </span>
            </label>
            {bothActive && (
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5">
                <button
                  onClick={() => setActiveMode('standard')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeMode === 'standard' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                >Standard</button>
                <button
                  onClick={() => setActiveMode('internal')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeMode === 'internal' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                >Internal</button>
              </div>
            )}
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 shrink-0" />
          </>
        )}
        <button
          onClick={() => setNotesOverlayOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 border border-purple-200 dark:border-purple-800 transition-colors"
          title="Open notes editor"
        >
          <Brain size={13} /> Notes
        </button>
      </div>

      {/* Floating bottom-centre panel toggles */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-full shadow-lg overflow-hidden select-none">
        <button
          onClick={() => setFormCollapsed((v) => !v)}
          className={`px-5 py-2 text-xs font-medium transition-colors ${
            formCollapsed
              ? 'text-gray-300 dark:text-gray-600'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={formCollapsed ? 'Show form' : 'Hide form'}
        >
          <span className={formCollapsed ? 'line-through' : ''}>Form</span>
        </button>
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 shrink-0" />
        <button
          onClick={() => setPreviewOpen((v) => !v)}
          className={`px-5 py-2 text-xs font-medium transition-colors ${
            !previewOpen
              ? 'text-gray-300 dark:text-gray-600'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
          title={previewOpen ? 'Hide preview' : 'Show preview'}
        >
          <span className={!previewOpen ? 'line-through' : ''}>Preview</span>
        </button>
      </div>

      {/* Two-column layout: left = meta+sections, right = preview */}
      <div className="flex gap-6 overflow-hidden" style={{ height: 'calc(100vh - 10rem)' }}>
        {/* Left column — independently scrollable */}
        <div className={`${formCollapsed ? 'hidden' : previewOpen ? 'w-80 shrink-0' : 'flex-1 max-w-2xl'} overflow-y-auto space-y-4 pb-6 pr-1`}>
          {/* Template + language + display options */}
          <div className="card p-4 space-y-3">
            <div>
              <label className="label">
                {internalNotesEnabled && bothActive ? (activeMode === 'internal' ? 'Internal Template' : 'Standard Template') : 'Theme / Template'}
              </label>
              {internalNotesEnabled && activeMode === 'internal' ? (
                <select className="input" value={note.internalTemplateId || ''} onChange={(e) => set('internalTemplateId', e.target.value)}>
                  <option value="">Default (plain)</option>
                  {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                </select>
              ) : (
                <select className="input" value={note.templateId} onChange={(e) => set('templateId', e.target.value)}>
                  <option value="">Default (plain)</option>
                  {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Globe size={13} className="text-gray-400" /> Language
              </label>
              <select className="input" value={note.language} onChange={(e) => set('language', e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
              <label className="label mb-2">Export — Show / Hide</label>
              <div className="grid grid-cols-2 gap-y-2">
                {[
                  { key: 'showParticipants', label: 'Participants' },
                  { key: 'showEventType',    label: 'Meeting Type' },
                  { key: 'showRoles',        label: 'Roles' },
                  { key: 'showFirms',        label: 'Companies' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={(note.displayOptions || {})[key] !== false}
                      onChange={(e) => setDisplayOption(key, e.target.checked)}
                      className="rounded accent-accent"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Meeting info */}
          <div className="card p-4 space-y-3">
            <h2 className="section-title text-base">Meeting Info</h2>
            <div>
              <label className="label">Title <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <input className="input" value={note.title} onChange={(e) => set('title', e.target.value)} placeholder={autoTitle || 'Auto-generated'} />
              {!note.title.trim() && autoTitle && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Will save as: <span className="italic">{autoTitle}</span></p>
              )}
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={note.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div>
              <label className="label">Customer</label>
              <input className="input" value={note.customer} onChange={(e) => set('customer', e.target.value)} placeholder="Customer name" />
            </div>
            <div>
              <label className="label">Event Type</label>
              <input className="input" value={note.eventType} onChange={(e) => set('eventType', e.target.value)} placeholder="e.g. Jour Fixe" />
            </div>
            <div>
              <label className="label">Team</label>
              <input className="input" value={note.team} onChange={(e) => set('team', e.target.value)} placeholder="Team / group" />
            </div>
          </div>

          {/* Participants */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title text-base">{t('participants')}</h2>
              <button className="btn-secondary text-xs py-1 px-2" onClick={addParticipant}>
                <Plus size={12} className="inline mr-1" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {note.participants.map((p) => (
                <div key={p.id} className="flex items-start gap-1.5">
                  <input type="checkbox" checked={p.enabled !== false} onChange={(e) => updateParticipant(p.id, 'enabled', e.target.checked)} className="mt-2 rounded" />
                  <div className="flex-1 grid grid-cols-3 gap-1">
                    <input className={`input text-xs ${p.isSelf ? 'ring-1 ring-inset ring-accent/40 dark:ring-accent/30' : ''}`} value={p.name} onChange={(e) => updateParticipant(p.id, 'name', e.target.value)} placeholder="Name" />
                    <input className="input text-xs" value={p.firm} onChange={(e) => updateParticipant(p.id, 'firm', e.target.value)} placeholder="Firm" />
                    <input className="input text-xs" value={p.role} onChange={(e) => updateParticipant(p.id, 'role', e.target.value)} placeholder="Role" />
                  </div>
                  <button onClick={() => removeParticipant(p.id)} className="text-gray-400 hover:text-red-500 mt-1.5 p-0.5">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {note.participants.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">No participants — configure yourself in Settings</p>
              )}
            </div>
            {settings?.yourName && note.participants.every((p) => !p.isSelf) && (
              <button className="mt-2 text-xs text-accent hover:underline" onClick={() => set('participants', [selfParticipant(settings), ...note.participants])}>
                + Add yourself back
              </button>
            )}
          </div>

          {/* Topics lifecycle hint */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Topic status on save / export:</p>
            <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5">
              <li>• <strong>{t('new')}</strong> → changes to <strong>{t('open')}</strong></li>
              <li>• <strong>{t('complete')}</strong> → removed from the list</li>
            </ul>
          </div>

          {/* Last session context */}
          {hasLastSessionContext && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setContextOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Clock size={12} className="text-gray-400" />
                  Previous Session
                  <span className="text-gray-400 font-normal">
                    · {lastSessionNote?.date}
                  </span>
                </span>
                {contextOpen ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
              </button>
              {contextOpen && (
                <div className="px-3 py-2.5 space-y-3 bg-white dark:bg-gray-900/30">
                  {lastSessionOpenTopics.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <MessageSquare size={10} /> Open Topics
                      </p>
                      <div className="space-y-1">
                        {lastSessionOpenTopics.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="text-accent mt-0.5 shrink-0">•</span>
                            <span className="font-medium">{item.topic}</span>
                            {item.description && <span className="text-gray-400 truncate">— {item.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastSessionPendingActions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <CheckSquare size={10} /> Pending Actions
                      </p>
                      <div className="space-y-1">
                        {lastSessionPendingActions.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="text-amber-500 mt-0.5 shrink-0">☐</span>
                            <span>{item.text}</span>
                            {item.assignee && <span className="text-gray-400 shrink-0">({item.assignee})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title text-base">
                {internalNotesEnabled && activeMode === 'internal' ? 'Internal Content Sections' : 'Content Sections'}
              </h2>
              <div className="relative" data-presets-container>
                <button
                  onClick={() => setPresetsOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-accent transition-colors px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Section layout presets"
                >
                  <LayoutTemplate size={12} /> Presets
                </button>
                {presetsOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 py-1">
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                      {savingPreset ? (
                        <div>
                          <input
                            ref={presetInputRef}
                            className="input text-xs w-full mb-1"
                            placeholder="Preset name"
                            value={presetNameInput}
                            onChange={(e) => { setPresetNameInput(e.target.value); setPresetNameError(false) }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (!presetNameInput.trim()) { setPresetNameError(true); return }
                                saveSectionPreset({
                                  id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
                                  name: presetNameInput.trim(),
                                  sections: (note.sections || []).map((s) => ({ type: s.type, label: s.label || '' })),
                                })
                                setPresetNameInput(''); setSavingPreset(false); setPresetNameError(false); setPresetsOpen(false)
                              }
                              if (e.key === 'Escape') { setSavingPreset(false); setPresetNameInput(''); setPresetNameError(false) }
                            }}
                            autoFocus
                          />
                          {presetNameError && <p className="text-xs text-red-500 mb-1">Please enter a name</p>}
                          <div className="flex gap-1">
                            <button
                              className="btn-primary text-xs py-0.5 px-2"
                              onClick={() => {
                                if (!presetNameInput.trim()) { setPresetNameError(true); return }
                                saveSectionPreset({
                                  id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
                                  name: presetNameInput.trim(),
                                  sections: (note.sections || []).map((s) => ({ type: s.type, label: s.label || '' })),
                                })
                                setPresetNameInput(''); setSavingPreset(false); setPresetNameError(false); setPresetsOpen(false)
                              }}
                            >Save</button>
                            <button
                              className="btn-ghost text-xs py-0.5 px-2"
                              onClick={() => { setSavingPreset(false); setPresetNameInput(''); setPresetNameError(false) }}
                            >Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSavingPreset(true); setTimeout(() => presetInputRef.current?.focus(), 30) }}
                          className="w-full text-left text-xs text-accent hover:underline font-medium"
                        >
                          + Save current layout as preset
                        </button>
                      )}
                    </div>
                    {(sectionPresets || []).length === 0 && (
                      <p className="text-xs text-gray-400 px-3 py-2">No presets saved yet</p>
                    )}
                    {(sectionPresets || []).map((preset) => (
                      <div key={preset.id} className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 group">
                        <button
                          onClick={() => {
                            set('sections', preset.sections.map((s) => {
                              const base = { id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), type: s.type, label: s.label }
                              if (s.type === 'text' || s.type === 'notes') return { ...base, content: '' }
                              if (['topics', 'actionItems', 'decisions', 'risks', 'resources'].includes(s.type)) return { ...base, items: [] }
                              if (s.type === 'graph') return { ...base, data: [], colorMode: 'individual', colorRules: [] }
                              if (s.type === 'gantt') return { ...base, data: [], colorMode: 'theme' }
                              if (s.type === 'pie') return { ...base, data: [] }
                              if (s.type === 'line') return { ...base, xLabels: '', series: [] }
                              return base
                            }))
                            setPresetsOpen(false)
                          }}
                          className="flex-1 text-left text-xs text-gray-700 dark:text-gray-300"
                        >
                          {preset.name}
                          <span className="text-gray-400 ml-1">({preset.sections.length})</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSectionPreset(preset.id) }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {internalNotesEnabled && activeMode === 'internal' ? (
              <SectionList
                sections={note.internalSections || []}
                onChange={(sections) => set('internalSections', sections)}
                t={t}
                note={{ ...note, title: effectiveTitle }}
                meetingNotes={meetingNotes}
                defaultTone={recurringMeeting?.defaultNotesTone || settings?.aiTone}
                contextDepth={settings?.notesContextDepth ?? 4}
                openNotesToken={openNotesToken}
                tasksEnabled={!!settings?.tasksEnabled}
              />
            ) : (
              <SectionList
                sections={note.sections || []}
                onChange={(sections) => set('sections', sections)}
                t={t}
                note={{ ...note, title: effectiveTitle }}
                meetingNotes={meetingNotes}
                defaultTone={recurringMeeting?.defaultNotesTone || settings?.aiTone}
                contextDepth={settings?.notesContextDepth ?? 4}
                openNotesToken={openNotesToken}
                tasksEnabled={!!settings?.tasksEnabled}
              />
            )}
          </div>
        </div>

        {/* Right column: live preview — independently scrollable */}
        {previewOpen && (
          <div className="flex-1 min-w-0 overflow-y-auto pb-6">
            <A4Preview
              note={previewNoteForMode}
              template={previewTemplate}
              t={exportT}
              isInternal={activeMode === 'internal' && internalActive}
            />
          </div>
        )}
      </div>

      {/* Discard-changes confirmation modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDiscardModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Unsaved Changes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
              Your changes have not been saved. Are you sure you would like to discard your changes?
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn-ghost text-sm" onClick={() => setShowDiscardModal(false)}>
                No, keep editing
              </button>
              <button
                className="text-sm px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                onClick={() => { setShowDiscardModal(false); onClose() }}
              >
                Yes, discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Overlay */}
      {notesOverlayOpen && (
        <NotesOverlay
          standardSection={note.sections?.find((s) => s.type === 'notes') ?? null}
          internalSection={note.internalSections?.find((s) => s.type === 'notes') ?? null}
          standardTasksSection={note.sections?.find((s) => s.type === 'tasks') ?? null}
          internalTasksSection={note.internalSections?.find((s) => s.type === 'tasks') ?? null}
          note={{ ...note, title: effectiveTitle }}
          meetingNotes={meetingNotes}
          defaultTone={recurringMeeting?.defaultNotesTone || settings?.aiTone}
          contextDepth={settings?.notesContextDepth ?? 4}
          internalEnabled={internalActive}
          tasksEnabled={!!settings?.tasksEnabled}
          onChangeStandard={(patch) => {
            setDirty(true)
            setNote((prev) => {
              const secs = prev.sections || []
              const idx = secs.findIndex((s) => s.type === 'notes')
              if (idx >= 0) {
                const updated = [...secs]; updated[idx] = { ...updated[idx], ...patch }
                return { ...prev, sections: updated }
              }
              return { ...prev, sections: [{ id: uuid(), type: 'notes', label: '', content: '', ...patch }, ...secs] }
            })
          }}
          onChangeInternal={(patch) => {
            setDirty(true)
            setNote((prev) => {
              const secs = prev.internalSections || []
              const idx = secs.findIndex((s) => s.type === 'notes')
              if (idx >= 0) {
                const updated = [...secs]; updated[idx] = { ...updated[idx], ...patch }
                return { ...prev, internalSections: updated }
              }
              return { ...prev, internalSections: [{ id: uuid(), type: 'notes', label: '', content: '', ...patch }, ...secs] }
            })
          }}
          onChangeStandardTasks={(patch) => {
            setDirty(true)
            setNote((prev) => {
              const secs = prev.sections || []
              const idx = secs.findIndex((s) => s.type === 'tasks')
              if (idx >= 0) {
                const updated = [...secs]; updated[idx] = { ...updated[idx], ...patch }
                return { ...prev, sections: updated }
              }
              return { ...prev, sections: [...secs, { id: uuid(), type: 'tasks', label: '', items: [], ...patch }] }
            })
          }}
          onChangeInternalTasks={(patch) => {
            setDirty(true)
            setNote((prev) => {
              const secs = prev.internalSections || []
              const idx = secs.findIndex((s) => s.type === 'tasks')
              if (idx >= 0) {
                const updated = [...secs]; updated[idx] = { ...updated[idx], ...patch }
                return { ...prev, internalSections: updated }
              }
              return { ...prev, internalSections: [...secs, { id: uuid(), type: 'tasks', label: '', items: [], ...patch }] }
            })
          }}
          onStatusChangeStandardTasks={(patch) => {
            const secs = note.sections || []
            const idx = secs.findIndex((s) => s.type === 'tasks')
            let updatedNote
            if (idx >= 0) {
              const updatedSecs = [...secs]; updatedSecs[idx] = { ...updatedSecs[idx], ...patch }
              updatedNote = { ...note, sections: updatedSecs, updatedAt: new Date().toISOString() }
            } else {
              updatedNote = { ...note, sections: [...secs, { id: uuid(), type: 'tasks', label: '', items: [], ...patch }], updatedAt: new Date().toISOString() }
            }
            setNote(updatedNote)
            saveMeetingNote(updatedNote)
            triggerNoteSync(updatedNote)
          }}
          onStatusChangeInternalTasks={(patch) => {
            const secs = note.internalSections || []
            const idx = secs.findIndex((s) => s.type === 'tasks')
            let updatedNote
            if (idx >= 0) {
              const updatedSecs = [...secs]; updatedSecs[idx] = { ...updatedSecs[idx], ...patch }
              updatedNote = { ...note, internalSections: updatedSecs, updatedAt: new Date().toISOString() }
            } else {
              updatedNote = { ...note, internalSections: [...secs, { id: uuid(), type: 'tasks', label: '', items: [], ...patch }], updatedAt: new Date().toISOString() }
            }
            setNote(updatedNote)
            saveMeetingNote(updatedNote)
            triggerNoteSync(updatedNote)
          }}
          onClose={() => setNotesOverlayOpen(false)}
        />
      )}

      {/* Off-screen export canvas */}
      {showCanvas && (
        <div id="offscreen-export-canvas" className="fixed -left-[9999px] top-0 pointer-events-none">
          <NoteExportCanvas
            note={{ ...finalNote(), sections: activeMode === 'internal' && internalActive ? (note.internalSections || []) : (note.sections || []) }}
            template={activeMode === 'internal' && internalActive ? resolvedInternalTemplate : resolvedTemplate}
            t={exportT}
            isInternal={activeMode === 'internal' && internalActive}
          />
        </div>
      )}
    </div>
  )
}
