import React, { useState, useRef, useEffect, useContext } from 'react'
import { Brain, Download, Upload, ChevronDown, ChevronRight } from 'lucide-react'
import { SectionContext } from '../SectionList'
import { buildSectionAIPrompt, importSectionJsonResponse } from '../../../utils/aiPrompt'
import { downloadBlob, formatDateForFilename } from '../../../utils/export'

const DEFAULT_TONE = { formality: 'professional', conciseness: 'balanced', customInstructions: '' }

export default function NotesSection({ section, onChange }) {
  const { note, meetingNotes, defaultTone } = useContext(SectionContext) || {}

  const [aiOpen, setAiOpen] = useState(false)
  const [mode, setMode] = useState('json')
  const [toneOpen, setToneOpen] = useState(false)
  const [tone, setTone] = useState({ ...DEFAULT_TONE, ...(defaultTone || {}) })
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)
  const errorTimer = useRef(null)
  const successTimer = useRef(null)

  // Sync tone when defaultTone changes (e.g. settings saved)
  useEffect(() => {
    if (defaultTone) setTone((t) => ({ ...DEFAULT_TONE, ...defaultTone, ...t }))
  }, [defaultTone])

  const flash = (setter, timerRef, msg) => {
    setter(msg)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setter(''), 3000)
  }

  const setToneField = (key, val) => setTone((t) => ({ ...t, [key]: val }))

  const handleDownload = () => {
    try {
      const prompt = buildSectionAIPrompt(section, note || {}, meetingNotes || [], mode, tone)
      const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' })
      const dateStr = formatDateForFilename(note?.date)
      downloadBlob(blob, `ai_prompt_${dateStr}_${(section.label || 'notes').replace(/\s+/g, '_').slice(0, 30)}.json`)
    } catch (err) {
      flash(setError, errorTimer, 'Failed to build prompt: ' + err.message)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const content = importSectionJsonResponse(ev.target.result)
        onChange({ content })
        flash(setSuccess, successTimer, 'Section updated from JSON response.')
        setError('')
      } catch (err) {
        flash(setError, errorTimer, err.message)
        setSuccess('')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleApplyText = () => {
    if (!pasteText.trim()) {
      flash(setError, errorTimer, 'Please paste the LLM response before applying.')
      return
    }
    onChange({ content: pasteText.trim() })
    setPasteText('')
    flash(setSuccess, successTimer, 'Notes applied.')
    setError('')
  }

  return (
    <div className="space-y-2">
      {/* Main textarea */}
      <textarea
        className="input resize-none text-sm leading-relaxed min-h-40 w-full"
        value={section.content || ''}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder={`Write session notes here…\n\nUse ## for headings, - for bullets, - [ ] for tasks.`}
      />

      {/* AI import toggle */}
      <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setAiOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            <Brain size={13} className="text-purple-500" />
            AI Import
          </span>
          {aiOpen
            ? <ChevronDown size={12} className="text-gray-400 shrink-0" />
            : <ChevronRight size={12} className="text-gray-400 shrink-0" />
          }
        </button>

        {aiOpen && (
          <div className="p-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Download a prompt for this section, feed it to any LLM with your transcript, then import the response.
            </p>

            {/* Mode toggle */}
            <div className="flex gap-2">
              {['json', 'text'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 text-xs font-medium py-1 px-2 rounded-lg border transition-colors ${
                    mode === m
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {m === 'json' ? 'JSON (structured)' : 'Text (paste)'}
                </button>
              ))}
            </div>

            {/* Tone & Style */}
            <div>
              <button
                onClick={() => setToneOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {toneOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                Tone &amp; Style
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

            {/* Step 1 */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Step 1 — Download prompt</p>
              <button onClick={handleDownload} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-2.5">
                <Download size={12} /> Download AI Prompt
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">Upload to ChatGPT, Claude, Gemini, etc. with your transcript.</p>
            </div>

            {/* Step 2 */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Step 2 — Import response</p>
              {mode === 'json' ? (
                <>
                  <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-2.5"
                  >
                    <Upload size={12} /> Upload JSON Response
                  </button>
                  <p className="text-xs text-gray-400 dark:text-gray-500">LLM should return <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">{"{ \"content\": \"...\" }"}</code></p>
                </>
              ) : (
                <>
                  <textarea
                    className="input text-xs resize-none"
                    rows={4}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste the LLM's text response here…"
                  />
                  <button onClick={handleApplyText} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-2.5">
                    Apply to Section
                  </button>
                </>
              )}
            </div>

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
            {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
