import React, { useState, useRef } from 'react'
import { X, Brain, Download, Settings2, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react'
import {
  buildSectionAIPrompt,
  buildCombinedNotesAIPrompt,
  buildCombinedNotesAndTasksAIPrompt,
  importCombinedNotesJsonResponse,
  importCombinedNotesAndTasksJsonResponse,
} from '../../utils/aiPrompt'
import { markdownToHtml, htmlToPlainText } from '../../utils/markdownToHtml'
import { downloadBlob, formatDateForFilename } from '../../utils/export'
import RichTextEditor from './sections/RichTextEditor'
import { useApp } from '../../context/AppContext'
import { v4 as uuid } from 'uuid'

const DEFAULT_TONE = { formality: 'professional', conciseness: 'balanced', customInstructions: '' }

function toneLabel(tone) {
  const f = { casual: 'Casual', professional: 'Professional', formal: 'Formal' }[tone.formality] || 'Professional'
  const d = { brief: 'Brief', balanced: 'Balanced', detailed: 'Detailed' }[tone.conciseness] || 'Balanced'
  return `${f} · ${d}`
}

function TonePanel({ tone, onChange, label }) {
  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2.5">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label} AI Tone &amp; Style
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">Formality</label>
          <select className="input text-xs py-1" value={tone.formality} onChange={(e) => onChange({ ...tone, formality: e.target.value })}>
            <option value="casual">Casual</option>
            <option value="professional">Professional</option>
            <option value="formal">Formal</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Detail Level</label>
          <select className="input text-xs py-1" value={tone.conciseness} onChange={(e) => onChange({ ...tone, conciseness: e.target.value })}>
            <option value="brief">Brief / Bullet points</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label text-xs">Custom Instructions <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea
          className="input text-xs resize-none"
          rows={2}
          value={tone.customInstructions}
          onChange={(e) => onChange({ ...tone, customInstructions: e.target.value })}
          placeholder="e.g. Focus on decisions. Use bullet points."
        />
      </div>
    </div>
  )
}

function NotesColumn({ label, badgeClass, section, onChange, tone, onToneChange, onExportSingle }) {
  const [toneOpen, setToneOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  return (
    <div className="flex flex-col overflow-hidden h-full border-r border-gray-100 dark:border-gray-700 last:border-r-0">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <span className={`text-xs font-semibold uppercase tracking-wide ${badgeClass}`}>{label}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <RichTextEditor
          value={section?.content || ''}
          onChange={(html) => onChange({ content: html })}
          placeholder={`Write or paste ${label.toLowerCase()} here…`}
          minHeight={180}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onExportSingle} className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3">
            <Download size={12} /> Export JSON
          </button>
          <button
            onClick={() => { setImportOpen((v) => !v); setImportError('') }}
            className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
          >
            <Brain size={12} className="text-purple-500" />
            Import AI
          </button>
          <button
            onClick={() => setToneOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <Settings2 size={12} />
            <span className="hidden lg:inline">{toneLabel(tone)}</span>
            {toneOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        </div>
        {importOpen && (
          <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2">
            <textarea
              className="input text-xs font-mono resize-none w-full"
              rows={3}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'Paste AI response:\n{"content": "..."}'}
            />
            {importError && <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>}
            <button
              onClick={() => {
                const stripped = importText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
                try {
                  const parsed = JSON.parse(stripped)
                  const content = parsed.content ?? parsed.standard?.content ?? parsed.internal?.content
                  if (!content) { setImportError('No content found in response.'); return }
                  const plain = content.includes('<') ? htmlToPlainText(content) : content
                  onChange({ content: markdownToHtml(plain) })
                  setImportText(''); setImportOpen(false); setImportError('')
                } catch { setImportError('Invalid JSON — check the response format.') }
              }}
              className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3"
            >
              <Brain size={12} /> Apply
            </button>
          </div>
        )}
        {toneOpen && <TonePanel tone={tone} onChange={onToneChange} label={label} />}
      </div>
    </div>
  )
}

function TasksColumn({ label, badgeClass, section, onChange, onExportSingle, extractFromNotes, onExtractChange }) {
  const { settings } = useApp()
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const items = section?.items || []

  return (
    <div className="flex flex-col overflow-hidden h-full border-r border-gray-100 dark:border-gray-700 last:border-r-0">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <span className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${badgeClass}`}>
          <CheckSquare size={11} /> {label}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className={extractFromNotes ? 'opacity-40 pointer-events-none select-none' : ''}>
          <RichTextEditor
            value={section?.content || ''}
            onChange={(html) => onChange({ content: html })}
            placeholder="Write rough task notes here — e.g. 'John to send proposal by Friday, Alice to review specs'. The AI will structure these into tasks."
            minHeight={180}
          />
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={extractFromNotes}
            onChange={(e) => onExtractChange(e.target.checked)}
            className="rounded text-accent"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">Extract tasks from notes</span>
        </label>
        {extractFromNotes && (
          <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
            Tasks will be extracted from the notes above. The text box is inactive and its content will not be included in exports. It will be cleared on import.
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onExportSingle} className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3">
            <Download size={12} /> Export JSON
          </button>
          <button
            onClick={() => { setImportOpen((v) => !v); setImportError('') }}
            className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
          >
            <Brain size={12} className="text-green-500" /> Import AI
          </button>
        </div>
        {importOpen && (
          <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2">
            <textarea
              className="input text-xs font-mono resize-none w-full"
              rows={3}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'Paste AI response:\n{"tasks": [{"text":"...", "assignee":"...", "status":"planned"}]}'}
            />
            {extractFromNotes && section?.content?.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Note: your task notes will be cleared after import — tasks are being extracted from the notes section above.
              </p>
            )}
            {importError && <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>}
            <button
              onClick={() => {
                const stripped = importText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
                try {
                  const parsed = JSON.parse(stripped)
                  const taskList = parsed.tasks ?? parsed.standard_tasks ?? parsed.internal_tasks ?? (Array.isArray(parsed) ? parsed : null)
                  if (!taskList) { setImportError('No tasks found in response.'); return }
                  const newItems = taskList.map((t) => ({
                    id: uuid(),
                    text: t.text || '',
                    assignee: t.assignee || settings?.yourName || '',
                    status: t.status || 'planned',
                    startDate: t.startDate || '',
                    endDate: t.endDate || '',
                    createdAt: new Date().toISOString(),
                  }))
                  onChange({ items: [...items, ...newItems], ...(extractFromNotes ? { content: '' } : {}) })
                  setImportText(''); setImportOpen(false); setImportError('')
                } catch { setImportError('Invalid JSON — check the response format.') }
              }}
              className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3"
            >
              <Brain size={12} /> Apply
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NotesOverlay({
  standardSection,
  internalSection,
  standardTasksSection,
  internalTasksSection,
  note,
  meetingNotes,
  defaultTone,
  contextDepth = 4,
  internalEnabled,
  tasksEnabled,
  onChangeStandard,
  onChangeInternal,
  onChangeStandardTasks,
  onChangeInternalTasks,
  onClose,
}) {
  const { settings } = useApp()
  const aiPromptMode = settings?.aiPromptMode || 'download'

  const [standardTone, setStandardToneState] = useState(() => ({
    ...DEFAULT_TONE, ...(defaultTone || {}), ...(standardSection?.tone || {}),
  }))
  const [internalTone, setInternalToneState] = useState(() => ({
    ...DEFAULT_TONE, ...(defaultTone || {}), ...(internalSection?.tone || {}),
  }))
  const [importOpen, setImportOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [standardExtract, setStandardExtract] = useState(false)
  const [internalExtract, setInternalExtract] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const errorTimer = useRef(null)
  const successTimer = useRef(null)

  const flash = (setter, timerRef, msg) => {
    setter(msg)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setter(''), 3500)
  }

  const updateStandardTone = (next) => {
    setStandardToneState(next)
    onChangeStandard({ tone: next })
  }

  const updateInternalTone = (next) => {
    setInternalToneState(next)
    onChangeInternal({ tone: next })
  }

  const handleExportSingleNotes = (mode) => {
    const section = mode === 'standard' ? standardSection : internalSection
    const tone = mode === 'standard' ? standardTone : internalTone
    try {
      const effectiveSection = section || { id: 'tmp', label: 'Notes', content: '' }
      const prompt = buildSectionAIPrompt(effectiveSection, note || {}, meetingNotes || [], tone, contextDepth, aiPromptMode)
      const json = JSON.stringify(prompt, null, 2)
      if (aiPromptMode === 'clipboard') {
        navigator.clipboard.writeText(json).catch(() => {})
        flash(setSuccess, successTimer, 'Prompt copied to clipboard.')
      } else {
        const blob = new Blob([json], { type: 'application/json' })
        const tag = mode === 'internal' ? '_internal' : ''
        downloadBlob(blob, `ai_prompt_${formatDateForFilename(note?.date)}_notes${tag}.json`)
      }
    } catch (err) {
      flash(setError, errorTimer, 'Export failed: ' + err.message)
    }
  }

  const handleExportSingleTasks = (mode) => {
    const section = mode === 'standard' ? standardTasksSection : internalTasksSection
    const extractOn = mode === 'standard' ? standardExtract : internalExtract
    const tone = mode === 'standard' ? standardTone : internalTone
    try {
      const effectiveSection = section || { id: 'tmp', label: 'Tasks', content: '', items: [] }
      const prompt = buildSectionAIPrompt(
        { ...effectiveSection, type: 'notes', content: extractOn ? '' : (effectiveSection.content || '') },
        note || {},
        meetingNotes || [],
        tone,
        contextDepth,
        aiPromptMode,
      )
      // Override with tasks-specific instructions
      prompt._type = 'tasks_section_prompt'
      prompt.instructions.task = `Extract action items and tasks from the meeting transcript for the ${mode} tasks list. Return structured JSON with a "tasks" array.`
      prompt.instructions.output_format = [
        'CRITICAL: Respond with ONLY a raw JSON object. No code fences.',
        'Required format: {"tasks": [{"text": "task description", "assignee": "name or empty", "status": "planned", "startDate": "YYYY-MM-DD or empty", "endDate": "YYYY-MM-DD or empty"}]}',
        'Status values: planned, inProgress, complete, blocked.',
        ...(aiPromptMode === 'clipboard' ? ['ZERO additional text. Start with { and end with }.'] : []),
      ].join(' ')
      const json = JSON.stringify(prompt, null, 2)
      if (aiPromptMode === 'clipboard') {
        navigator.clipboard.writeText(json).catch(() => {})
        flash(setSuccess, successTimer, 'Tasks prompt copied to clipboard.')
      } else {
        const blob = new Blob([json], { type: 'application/json' })
        const tag = mode === 'internal' ? '_internal' : ''
        downloadBlob(blob, `ai_prompt_${formatDateForFilename(note?.date)}_tasks${tag}.json`)
      }
    } catch (err) {
      flash(setError, errorTimer, 'Export failed: ' + err.message)
    }
  }

  const handleExportMaster = () => {
    try {
      const prompt = buildCombinedNotesAndTasksAIPrompt(
        standardSection || { id: 'tmp-std', label: 'Notes', content: '' },
        internalEnabled && internalSection ? internalSection : null,
        tasksEnabled ? (standardTasksSection || { id: 'tmp-std-t', label: 'Tasks', items: [] }) : null,
        tasksEnabled && internalEnabled && internalTasksSection ? internalTasksSection : null,
        note || {},
        meetingNotes || [],
        standardTone,
        internalEnabled && internalSection ? internalTone : null,
        contextDepth,
        aiPromptMode,
        standardExtract,
        internalExtract,
      )
      const json = JSON.stringify(prompt, null, 2)
      if (aiPromptMode === 'clipboard') {
        navigator.clipboard.writeText(json).catch(() => {})
        flash(setSuccess, successTimer, 'Master prompt copied to clipboard.')
      } else {
        const blob = new Blob([json], { type: 'application/json' })
        downloadBlob(blob, `ai_prompt_${formatDateForFilename(note?.date)}_master.json`)
      }
    } catch (err) {
      flash(setError, errorTimer, 'Export failed: ' + err.message)
    }
  }

  const handleApplyMaster = () => {
    if (!pasteText.trim()) { flash(setError, errorTimer, 'Paste the AI response first.'); return }
    const stripped = pasteText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    try {
      const result = importCombinedNotesAndTasksJsonResponse(stripped)
      let updated = false

      if (result.standard_notes !== undefined) {
        const plain = result.standard_notes.includes('<') ? htmlToPlainText(result.standard_notes) : result.standard_notes
        onChangeStandard({ content: markdownToHtml(plain) }); updated = true
      } else if (result.standard !== undefined) {
        const plain = result.standard.includes('<') ? htmlToPlainText(result.standard) : result.standard
        onChangeStandard({ content: markdownToHtml(plain) }); updated = true
      } else if (result._raw !== undefined) {
        const plain = result._raw.includes('<') ? htmlToPlainText(result._raw) : result._raw
        onChangeStandard({ content: markdownToHtml(plain) }); updated = true
      }

      if (result.internal_notes !== undefined && internalEnabled) {
        const plain = result.internal_notes.includes('<') ? htmlToPlainText(result.internal_notes) : result.internal_notes
        onChangeInternal({ content: markdownToHtml(plain) }); updated = true
      } else if (result.internal !== undefined && internalEnabled) {
        const plain = result.internal.includes('<') ? htmlToPlainText(result.internal) : result.internal
        onChangeInternal({ content: markdownToHtml(plain) }); updated = true
      }

      if (result.standard_tasks && tasksEnabled) {
        const newItems = result.standard_tasks.map((t) => ({
          id: uuid(),
          text: t.text || '',
          assignee: t.assignee || settings?.yourName || '',
          status: t.status || 'planned',
          startDate: t.startDate || '',
          endDate: t.endDate || '',
          createdAt: new Date().toISOString(),
        }))
        const existing = standardTasksSection?.items || []
        onChangeStandardTasks({ items: [...existing, ...newItems], ...(standardExtract ? { content: '' } : {}) }); updated = true
      }

      if (result.internal_tasks && tasksEnabled && internalEnabled) {
        const newItems = result.internal_tasks.map((t) => ({
          id: uuid(),
          text: t.text || '',
          assignee: t.assignee || settings?.yourName || '',
          status: t.status || 'planned',
          startDate: t.startDate || '',
          endDate: t.endDate || '',
          createdAt: new Date().toISOString(),
        }))
        const existing = internalTasksSection?.items || []
        onChangeInternalTasks({ items: [...existing, ...newItems], ...(internalExtract ? { content: '' } : {}) }); updated = true
      }

      if (updated) {
        setPasteText('')
        flash(setSuccess, successTimer, 'Applied successfully.')
        setError('')
      }
    } catch (err) {
      flash(setError, errorTimer, err.message)
    }
  }

  // Determine grid layout
  const showInternal = internalEnabled
  const showTasks = tasksEnabled
  const cols = showInternal ? 2 : 1
  const rows = showTasks ? 2 : 1

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex items-center gap-2.5">
          <Brain size={18} className="text-purple-500 shrink-0" />
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">{showTasks ? 'Meeting Notes + Tasks' : 'Meeting Notes'}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {[note?.customer, note?.date].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body — grid of editors */}
      <div
        className="flex-1 min-h-0 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: showInternal ? '1fr 1fr' : '1fr',
          gridTemplateRows: showTasks ? '1fr 1fr' : '1fr',
        }}
      >
        {/* Row 1: Notes */}
        <NotesColumn
          label="Standard Notes"
          badgeClass="text-purple-600 dark:text-purple-400"
          section={standardSection}
          onChange={onChangeStandard}
          tone={standardTone}
          onToneChange={updateStandardTone}
          onExportSingle={() => handleExportSingleNotes('standard')}
        />
        {showInternal && (
          <NotesColumn
            label="Internal Notes"
            badgeClass="text-orange-600 dark:text-orange-400"
            section={internalSection}
            onChange={onChangeInternal}
            tone={internalTone}
            onToneChange={updateInternalTone}
            onExportSingle={() => handleExportSingleNotes('internal')}
          />
        )}

        {/* Row 2: Tasks */}
        {showTasks && (
          <>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <TasksColumn
                label="Standard Tasks"
                badgeClass="text-green-600 dark:text-green-400"
                section={standardTasksSection}
                onChange={onChangeStandardTasks}
                onExportSingle={() => handleExportSingleTasks('standard')}
                extractFromNotes={standardExtract}
                onExtractChange={setStandardExtract}
              />
            </div>
            {showInternal && (
              <div className="border-t border-gray-200 dark:border-gray-700">
                <TasksColumn
                  label="Internal Tasks"
                  badgeClass="text-teal-600 dark:text-teal-400"
                  section={internalTasksSection}
                  onChange={onChangeInternalTasks}
                  onExportSingle={() => handleExportSingleTasks('internal')}
                  extractFromNotes={internalExtract}
                  onExtractChange={setInternalExtract}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 shrink-0 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportMaster}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 border border-purple-200 dark:border-purple-800 transition-colors"
          >
            <Download size={12} /> Export Master JSON
          </button>

          <button
            onClick={() => setImportOpen((v) => !v)}
            className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
          >
            <Brain size={12} className="text-purple-500" />
            Import Master AI
          </button>

          <div className="flex-1" />
          <button onClick={onClose} className="btn-primary text-sm py-1.5 px-4">Done</button>
        </div>

        {importOpen && (
          <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2.5">
            <div>
              <label className="label text-xs">Paste AI response</label>
              {aiPromptMode === 'clipboard' && (
                <button
                  onClick={() => navigator.clipboard.readText().then((text) => setPasteText(text)).catch(() => {})}
                  className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3 w-full justify-center mb-2"
                >
                  <Brain size={12} /> Paste from Clipboard
                </button>
              )}
              <textarea
                className="input text-xs font-mono resize-none w-full"
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  showTasks
                    ? 'Paste master AI response:\n{"standard_notes": {"content": "..."}, "standard_tasks": [{"text":"...", "status":"planned"}]}'
                    : 'Paste AI response:\n{"standard": {"content": "..."}, "internal": {"content": "..."}}'
                }
              />
            </div>
            <button onClick={handleApplyMaster} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
              <Brain size={12} /> Apply to Notes &amp; Tasks
            </button>
            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
            {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
