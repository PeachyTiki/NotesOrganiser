import React, { useState, useRef, useContext, useEffect } from 'react'
import { Brain, Download, ChevronDown, ChevronRight, Settings2 } from 'lucide-react'
import { SectionContext } from '../SectionList'
import { buildSectionAIPrompt, importSectionJsonResponse } from '../../../utils/aiPrompt'
import { markdownToHtml, htmlToPlainText } from '../../../utils/markdownToHtml'
import RichTextEditor from './RichTextEditor'
import { downloadBlob, formatDateForFilename } from '../../../utils/export'
import { useApp } from '../../../context/AppContext'

const DEFAULT_TONE = { formality: 'professional', conciseness: 'balanced', customInstructions: '' }

export default function NotesSection({ section, onChange, isFirstNotesSection }) {
  const { note, meetingNotes, defaultTone, contextDepth, openNotesToken } = useContext(SectionContext) || {}
  const { settings } = useApp()
  const aiPromptMode = settings?.aiPromptMode || 'download'

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
  const selfRef = useRef(null)
  const openedForTokenRef = useRef(null)

  // Respond to token from Notes button in top bar (single-mode: scroll here + open import panel)
  useEffect(() => {
    if (!openNotesToken || openNotesToken === openedForTokenRef.current || !isFirstNotesSection) return
    openedForTokenRef.current = openNotesToken
    selfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setImportOpen(true)
  }, [openNotesToken, isFirstNotesSection])

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
      const prompt = buildSectionAIPrompt(section, note || {}, meetingNotes || [], tone, contextDepth ?? 4, aiPromptMode)
      const json = JSON.stringify(prompt, null, 2)
      if (aiPromptMode === 'clipboard') {
        navigator.clipboard.writeText(json).then(() => {
          flash(setSuccess, successTimer, 'Prompt copied to clipboard — paste it in your AI assistant.')
        }).catch(() => {
          flash(setError, errorTimer, 'Failed to copy to clipboard.')
        })
      } else {
        const blob = new Blob([json], { type: 'application/json' })
        const dateStr = formatDateForFilename(note?.date)
        downloadBlob(blob, `ai_prompt_${dateStr}_${(section.label || 'notes').replace(/\s+/g, '_').slice(0, 30)}.json`)
      }
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
    let raw
    if (stripped.startsWith('{')) {
      try {
        raw = importSectionJsonResponse(stripped)
      } catch (err) {
        flash(setError, errorTimer, err.message)
        return
      }
    } else {
      raw = stripped
    }
    // Strip any HTML tags (e.g. browser-formatted copy-paste) then convert markdown → HTML
    const plain = raw.includes('<') ? htmlToPlainText(raw) : raw
    const content = markdownToHtml(plain)
    onChange({ content })
    setPasteText('')
    flash(setSuccess, successTimer, 'Notes updated.')
    setError('')
  }

  const toneLabel = {
    casual: 'Casual', professional: 'Professional', formal: 'Formal',
  }[tone.formality] || 'Professional'
  const detailLabel = {
    brief: 'Brief', balanced: 'Balanced', detailed: 'Detailed',
  }[tone.conciseness] || 'Balanced'

  return (
    <div className="space-y-2" ref={selfRef}>
      {/* Main editable area */}
      <RichTextEditor
        value={section.content || ''}
        onChange={(html) => onChange({ content: html })}
        placeholder="Write session notes here while the meeting is in progress, or paste your transcript."
        minHeight={160}
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
            {aiPromptMode === 'clipboard' && (
              <button
                onClick={() => {
                  navigator.clipboard.readText().then((text) => {
                    setPasteText(text)
                  }).catch(() => {
                    flash(setError, errorTimer, 'Could not read clipboard.')
                  })
                }}
                className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3 w-full justify-center mb-2"
              >
                <Brain size={12} /> Paste from Clipboard
              </button>
            )}
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
