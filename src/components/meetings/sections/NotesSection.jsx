import React, { useState, useRef, useContext } from 'react'
import { Brain, Download, ChevronDown, ChevronRight, Pencil, Settings2 } from 'lucide-react'
import { SectionContext } from '../SectionList'
import { buildSectionAIPrompt, importSectionJsonResponse } from '../../../utils/aiPrompt'
import { markdownToHtml } from '../../../utils/markdownToHtml'
import { downloadBlob, formatDateForFilename } from '../../../utils/export'

const DEFAULT_TONE = { formality: 'professional', conciseness: 'balanced', customInstructions: '' }

export default function NotesSection({ section, onChange, onOpenTextEditor }) {
  const { note, meetingNotes, defaultTone, contextDepth } = useContext(SectionContext) || {}

  // Tone is persisted in section.tone; initialise with section override → serie default → app default
  const [tone, setToneLocal] = useState(() => ({
    ...DEFAULT_TONE,
    ...(defaultTone || {}),
    ...(section.tone || {}),
  }))

  const [toneOpen, setToneOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const errorTimer = useRef(null)
  const successTimer = useRef(null)

  const flash = (setter, timerRef, msg) => {
    setter(msg)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setter(''), 3500)
  }

  const setToneField = (key, val) => {
    const next = { ...tone, [key]: val }
    setToneLocal(next)
    onChange({ tone: next })
  }

  const handleExport = () => {
    try {
      const prompt = buildSectionAIPrompt(section, note || {}, meetingNotes || [], tone, contextDepth ?? 4)
      const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' })
      const dateStr = formatDateForFilename(note?.date)
      downloadBlob(blob, `ai_prompt_${dateStr}_${(section.label || 'notes').replace(/\s+/g, '_').slice(0, 30)}.json`)
    } catch (err) {
      flash(setError, errorTimer, 'Export failed: ' + err.message)
    }
  }

  const handleApply = () => {
    if (!pasteText.trim()) {
      flash(setError, errorTimer, 'Paste the AI response first.')
      return
    }
    const stripped = pasteText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    let content
    if (stripped.startsWith('{')) {
      try {
        const raw = importSectionJsonResponse(stripped)
        content = markdownToHtml(raw)
      } catch (err) {
        flash(setError, errorTimer, err.message)
        return
      }
    } else {
      content = markdownToHtml(stripped)
    }
    onChange({ content })
    setPasteText('')
    flash(setSuccess, successTimer, 'Notes updated.')
    setError('')
  }

  const hasContent = !!(section.content?.trim())

  const toneLabel = {
    casual: 'Casual', professional: 'Professional', formal: 'Formal',
  }[tone.formality] || 'Professional'
  const detailLabel = {
    brief: 'Brief', balanced: 'Balanced', detailed: 'Detailed',
  }[tone.conciseness] || 'Balanced'

  return (
    <div className="space-y-2">
      {/* Main editable area */}
      <textarea
        className="input text-sm leading-relaxed w-full"
        style={{ minHeight: '160px', resize: 'vertical' }}
        value={section.content || ''}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder={`Write session notes here while the meeting is in progress, or paste your transcript.\n\nUse ## for headings, - for bullets, - [ ] for tasks.`}
      />

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
        >
          <Download size={12} /> Export JSON
        </button>

        {hasContent && onOpenTextEditor && (
          <button
            onClick={onOpenTextEditor}
            className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3"
          >
            <Pencil size={12} /> Edit
          </button>
        )}

        <button
          onClick={() => setToneOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="AI tone & style settings"
        >
          <Settings2 size={12} className="text-gray-400" />
          <span className="hidden sm:inline">{toneLabel} · {detailLabel}</span>
          <span className="sm:hidden">AI Settings</span>
          {toneOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>

        <button
          onClick={() => setImportOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Brain size={12} className="text-purple-400" />
          Import AI response
          {importOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
      </div>

      {/* Tone & style panel */}
      {toneOpen && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            AI Tone &amp; Style
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Formality</label>
              <select className="input text-xs py-1" value={tone.formality} onChange={(e) => setToneField('formality', e.target.value)}>
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="formal">Formal</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Detail Level</label>
              <select className="input text-xs py-1" value={tone.conciseness} onChange={(e) => setToneField('conciseness', e.target.value)}>
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
              onChange={(e) => setToneField('customInstructions', e.target.value)}
              placeholder="e.g. Focus on decisions. Use bullet points."
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Changes are saved to this meeting. Export JSON to apply them.
          </p>
        </div>
      )}

      {/* Import AI response panel */}
      {importOpen && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2.5">
          <div>
            <label className="label text-xs">Paste AI response</label>
            <textarea
              className="input text-xs font-mono resize-none w-full"
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Paste the AI response here — JSON or plain text:\n{"content": "## Summary\\n- Point one"}\nor just paste the text directly.'}
            />
          </div>
          <button onClick={handleApply} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
            <Brain size={12} /> Apply to Notes
          </button>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
        </div>
      )}

      {error && !importOpen && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  )
}
