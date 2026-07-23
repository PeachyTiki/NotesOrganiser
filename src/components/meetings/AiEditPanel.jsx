import React, { useState, useRef } from 'react'
import { Wand2, Clipboard, Download, ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useConfirm } from '../ui/DialogProvider'
import { copyPromptToClipboard } from '../../utils/aiDelivery'
import { buildNoteEditAIPrompt } from '../../utils/aiPrompt'
import { serializeSectionsForEdit, sectionsFromModuleSpecs } from '../../utils/aiModules'
import { markdownToHtml } from '../../utils/markdownToHtml'
import { downloadBlob } from '../../utils/export'

// Prompt-driven editing of a whole note: type an instruction, copy the edit
// prompt (the note serialised as sections), paste it into your AI assistant,
// then paste the edited-note JSON back to apply. Works on every section type.
// `onApply(sections)` receives the rebuilt section array (a full replacement).
export default function AiEditPanel({ sections, onApply, className = '' }) {
  const { settings } = useApp()
  const confirm = useConfirm()
  const aiPromptMode = settings?.aiPromptMode || 'clipboard'
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [msg, setMsg] = useState(null) // { ok, text }
  const timer = useRef(null)

  const flash = (ok, text) => {
    setMsg({ ok, text })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 4500)
  }

  const handleCopy = () => {
    if (!(sections || []).length) { flash(false, 'This note has no sections to edit yet.'); return }
    if (!instruction.trim()) { flash(false, 'Describe the edits you want first.'); return }
    const prompt = buildNoteEditAIPrompt(serializeSectionsForEdit(sections), instruction, aiPromptMode)
    const json = JSON.stringify(prompt, null, 2)
    if (aiPromptMode !== 'download') {
      copyPromptToClipboard(json, aiPromptMode)
        .then(() => flash(true, 'Edit prompt copied — paste it into your AI assistant, then paste its reply below.'))
        .catch(() => flash(false, 'Could not copy to clipboard.'))
    } else {
      downloadBlob(new Blob([json], { type: 'application/json' }), 'ai_edit_prompt.json')
      flash(true, 'Edit prompt downloaded.')
    }
  }

  const handleApply = async () => {
    const stripped = pasteText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    if (!stripped) { flash(false, 'Paste the AI response first.'); return }
    let parsed
    try {
      parsed = JSON.parse(stripped)
    } catch {
      flash(false, 'Invalid JSON — paste the full edited note the AI returned.')
      return
    }
    const specs = Array.isArray(parsed?.sections) ? parsed.sections : null
    if (!specs || !specs.length) { flash(false, 'Expected {"sections": [ … ]} with at least one section.'); return }
    let built = sectionsFromModuleSpecs(specs)
    if (!built.length) { flash(false, 'No usable sections were found in the response.'); return }
    // notes/text content may come back as markdown — convert if it isn't HTML
    built = built.map((s) =>
      (s.type === 'notes' || s.type === 'text') && s.content && !s.content.includes('<')
        ? { ...s, content: markdownToHtml(s.content) }
        : s
    )
    const ok = await confirm({
      title: 'Apply AI edits?',
      message: `This replaces the note's ${(sections || []).length} section(s) with the AI's edited version (${built.length} section(s)). Nothing is saved until you save the note.`,
      confirmLabel: 'Apply edits',
    })
    if (!ok) return
    onApply(built)
    setPasteText('')
    flash(true, 'Edits applied.')
  }

  return (
    <div className={className}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors"
      >
        <Wand2 size={13} className="text-purple-400" />
        AI Edit
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {open && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-2.5 mt-2">
          <div>
            <label className="label text-xs">Describe the edits</label>
            <textarea
              className="input text-xs resize-none w-full"
              rows={2}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Turn the budget figures into a pie chart, mark the vendor risk as high, and tighten the summary to 5 bullets."
            />
          </div>
          <button onClick={handleCopy} className="btn-secondary flex items-center gap-1.5 text-xs py-1 px-3">
            {aiPromptMode !== 'download'
              ? <><Clipboard size={12} /> Copy Edit Prompt</>
              : <><Download size={12} /> Export Edit JSON</>}
          </button>

          <div>
            <label className="label text-xs">Paste AI response</label>
            <textarea
              className="input text-xs font-mono resize-none w-full"
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Paste the edited-note JSON here:\n{"sections": [ … ]}'}
            />
          </div>
          <button onClick={handleApply} className="btn-primary flex items-center gap-1.5 text-xs py-1 px-3">
            <Brain size={12} /> Apply Edits
          </button>

          {msg && (
            <p className={`text-xs ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
