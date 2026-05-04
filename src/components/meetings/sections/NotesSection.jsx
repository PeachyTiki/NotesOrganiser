import React, { useState, useRef, useEffect, useContext } from 'react'
import { Brain, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { SectionContext } from '../SectionList'
import { buildSectionAIPrompt, importSectionJsonResponse } from '../../../utils/aiPrompt'
import { downloadBlob, formatDateForFilename } from '../../../utils/export'

const DEFAULT_TONE = { formality: 'professional', conciseness: 'balanced', customInstructions: '' }

export default function NotesSection({ section, onChange }) {
  const { note, meetingNotes, defaultTone } = useContext(SectionContext) || {}

  const [aiOpen, setAiOpen] = useState(false)
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

  const handleDownload = () => {
    try {
      const prompt = buildSectionAIPrompt(section, note || {}, meetingNotes || [], tone)
      const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' })
      const dateStr = formatDateForFilename(note?.date)
      downloadBlob(blob, `ai_prompt_${dateStr}_${(section.label || 'notes').replace(/\s+/g, '_').slice(0, 30)}.json`)
    } catch (err) {
      flash(setError, errorTimer, 'Failed to build prompt: ' + err.message)
    }
  }

  const handleApply = () => {
    if (!pasteText.trim()) {
      flash(setError, errorTimer, 'Paste the AI response first.')
      return
    }
    // Strip optional markdown code fences (```json ... ```)
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
      // Plain text response — use directly
      content = stripped
    }
    onChange({ content })
    setPasteText('')
    flash(setSuccess, successTimer, 'Notes updated from AI response.')
    setError('')
  }

  const hasTranscript = !!(section.content?.trim())

  return (
    <div className="space-y-2">
      {/* Live capture area */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Session Notes / Transcript
          </span>
          {hasTranscript && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
              Draft ready
            </span>
          )}
        </div>
        <textarea
          className="input resize-none text-sm leading-relaxed min-h-44 w-full"
          value={section.content || ''}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder={`Write rough notes here while the meeting is in progress, or paste your transcript once it's done.\n\nUse ## for headings, - for bullets, - [ ] for tasks.\n\nThis content will be sent to the AI for cleanup when you download the prompt below.`}
        />
      </div>

      {/* AI Cleanup panel */}
      <div className="border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setAiOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
            <Brain size={13} className="text-purple-500" />
            AI Cleanup
          </span>
          {aiOpen
            ? <ChevronDown size={12} className="text-gray-400 shrink-0" />
            : <ChevronRight size={12} className="text-gray-400 shrink-0" />
          }
        </button>

        {aiOpen && (
          <div className="p-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
            {!hasTranscript && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/50 px-3 py-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No notes yet — write your rough notes or paste your transcript above first. If you download the prompt without notes the AI will ask you for them in chat.
                </p>
              </div>
            )}

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
                <Download size={12} /> Download AI Prompt (.json)
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {hasTranscript
                  ? 'Your rough notes are included as the transcript. Upload to ChatGPT, Claude, Gemini, etc.'
                  : 'No transcript included — the AI will ask you to provide it in the chat.'}
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2.5 space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Step 2 — Paste AI response</p>
              <textarea
                className="input text-xs resize-none font-mono"
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'Paste the AI response here — accepts JSON:\n{"content": "## Summary\\n- Point one"}\nor plain text directly.'}
              />
              <button onClick={handleApply} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-2.5">
                <Brain size={12} /> Apply to Notes
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                The section above will be replaced with the cleaned-up notes.
              </p>
            </div>

            {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
            {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
