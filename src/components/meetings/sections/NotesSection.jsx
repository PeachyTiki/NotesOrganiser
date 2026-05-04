import React, { useState, useRef, useEffect, useContext } from 'react'
import { Brain, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { SectionContext } from '../SectionList'
import { buildSectionAIPrompt, importSectionJsonResponse } from '../../../utils/aiPrompt'
import { downloadBlob, formatDateForFilename } from '../../../utils/export'

const DEFAULT_TONE = { formality: 'professional', conciseness: 'balanced', customInstructions: '' }

export default function NotesSection({ section, onChange }) {
  const { note, meetingNotes, defaultTone } = useContext(SectionContext) || {}

  const [importOpen, setImportOpen] = useState(false)
  const [toneOpen, setToneOpen] = useState(false)
  const [tone, setTone] = useState({ ...DEFAULT_TONE, ...(defaultTone || {}) })
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const errorTimer = useRef(null)
  const successTimer = useRef(null)

  useEffect(() => {
    if (defaultTone) setTone((t) => ({ ...DEFAULT_TONE, ...defaultTone, ...t }))
  }, [defaultTone])

  const flash = (setter, timerRef, msg) => {
    setter(msg)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setter(''), 3500)
  }

  const setToneField = (key, val) => setTone((t) => ({ ...t, [key]: val }))

  const handleExport = () => {
    try {
      const prompt = buildSectionAIPrompt(section, note || {}, meetingNotes || [], tone)
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
        content = importSectionJsonResponse(stripped)
      } catch (err) {
        flash(setError, errorTimer, err.message)
        return
      }
    } else {
      content = stripped
    }
    onChange({ content })
    setPasteText('')
    flash(setSuccess, successTimer, 'Notes updated.')
    setError('')
  }

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
        <button
          onClick={() => setImportOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Brain size={12} className="text-purple-400" />
          Import AI response
          {importOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
      </div>

      {/* Import panel */}
      {importOpen && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2.5">
          {/* Tone */}
          <div>
            <button
              onClick={() => setToneOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {toneOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Tone &amp; Style (applied to Export JSON)
            </button>
            {toneOpen && (
              <div className="mt-2 space-y-2 pl-1">
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
                <div>
                  <label className="label text-xs">Custom Instructions</label>
                  <textarea
                    className="input text-xs resize-none"
                    rows={2}
                    value={tone.customInstructions}
                    onChange={(e) => setToneField('customInstructions', e.target.value)}
                    placeholder="e.g. Focus on decisions. Use bullet points."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Paste response */}
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
