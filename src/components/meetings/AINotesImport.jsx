import React, { useState, useRef, useEffect } from 'react'
import { Brain, Download, Upload, ChevronDown, ChevronRight } from 'lucide-react'
import { buildAIPrompt, importAIJsonResponse, importAITextResponse } from '../../utils/aiPrompt'
import { downloadBlob, formatDateForFilename } from '../../utils/export'

const DEFAULT_TONE = { formality: 'professional', conciseness: 'balanced', customInstructions: '' }

export default function AINotesImport({ note, meetingNotes, onSectionsChange, defaultTone }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('json')
  const [toneOpen, setToneOpen] = useState(false)
  const [tone, setTone] = useState({ ...DEFAULT_TONE, ...(defaultTone || {}) })
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef(null)
  const errorTimerRef = useRef(null)
  const successTimerRef = useRef(null)

  // Auto-clear messages after 3 seconds
  useEffect(() => {
    if (error) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = setTimeout(() => setError(''), 3000)
    }
    return () => clearTimeout(errorTimerRef.current)
  }, [error])

  useEffect(() => {
    if (success) {
      clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => setSuccess(''), 3000)
    }
    return () => clearTimeout(successTimerRef.current)
  }, [success])

  const setToneField = (key, val) => setTone((t) => ({ ...t, [key]: val }))

  const handleDownloadPrompt = () => {
    try {
      const prompt = buildAIPrompt(note, meetingNotes, mode, tone)
      const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' })
      const dateStr = formatDateForFilename(note.date)
      downloadBlob(blob, `ai_prompt_${dateStr}.json`)
    } catch (err) {
      setError('Failed to build prompt: ' + err.message)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const result = importAIJsonResponse(ev.target.result, note.sections)
        onSectionsChange(result)
        setSuccess('Sections updated from JSON response.')
        setError('')
      } catch (err) {
        setError(err.message)
        setSuccess('')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleApplyText = () => {
    if (!pasteText.trim()) {
      setError('Please paste the LLM response before applying.')
      return
    }
    const result = importAITextResponse(pasteText, note.sections)
    onSectionsChange(result)
    setPasteText('')
    setSuccess('Text applied to first text section.')
    setError('')
  }

  return (
    <div className="card overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Brain size={14} className="text-accent" />
          AI Notes Import
        </span>
        {open
          ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
          : <ChevronRight size={14} className="text-gray-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="p-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
          {/* Instructional text */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Download a prompt file, upload it with your meeting notes/transcript to any LLM, then import the response.
          </p>

          {/* Mode selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('json')}
              className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-lg border transition-colors ${
                mode === 'json'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              JSON (structured)
            </button>
            <button
              onClick={() => setMode('text')}
              className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-lg border transition-colors ${
                mode === 'text'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Text (paste)
            </button>
          </div>

          {/* Tone & Style */}
          <div>
            <button
              onClick={() => setToneOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {toneOpen
                ? <ChevronDown size={12} />
                : <ChevronRight size={12} />
              }
              Tone &amp; Style
            </button>

            {toneOpen && (
              <div className="mt-2 space-y-2 pl-1">
                <div>
                  <label className="label text-xs">Formality</label>
                  <select
                    className="input text-xs py-1.5"
                    value={tone.formality}
                    onChange={(e) => setToneField('formality', e.target.value)}
                  >
                    <option value="casual">Casual</option>
                    <option value="professional">Professional</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Detail Level</label>
                  <select
                    className="input text-xs py-1.5"
                    value={tone.conciseness}
                    onChange={(e) => setToneField('conciseness', e.target.value)}
                  >
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
                    placeholder="e.g. Focus on decisions and action items. Use bullet points."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 1 */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Step 1 — Download prompt</p>
            <button
              onClick={handleDownloadPrompt}
              className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Download size={13} />
              Download AI Prompt JSON
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Upload this to ChatGPT, Claude, Gemini, etc. along with your meeting notes or transcript.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Step 2 — Import response</p>

            {mode === 'json' ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  <Upload size={13} />
                  Upload JSON Response
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  The LLM should return the sections array as JSON.
                </p>
              </>
            ) : (
              <>
                <textarea
                  className="input text-xs resize-none"
                  rows={5}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste the LLM's text response here…"
                />
                <button
                  onClick={handleApplyText}
                  className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  Apply to First Text Section
                </button>
              </>
            )}
          </div>

          {/* Status messages */}
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
          {success && (
            <p className="text-xs text-green-600 dark:text-green-400">{success}</p>
          )}
        </div>
      )}
    </div>
  )
}
