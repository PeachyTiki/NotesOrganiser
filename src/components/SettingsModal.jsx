import React, { useState, useRef } from 'react'
import { X, User, Globe, Palette, Download, Database, Upload, Trash2, CheckCircle2, AlertTriangle, Brain, Lock, CheckSquare, Info } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { LANGUAGES, getSystemLanguage } from '../utils/i18n'
import Toggle from './Toggle'

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'png', label: 'Image (.png)' },
  { value: 'docx', label: 'Word (.docx)' },
]

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function SettingsModal({ onClose }) {
  const { settings, update, meetingNotes, recurringMeetings, templates, clearAllData, restoreFromBackup, createBackup } = useApp()
  const [form, setForm] = useState({ ...settings })
  const [restoreStatus, setRestoreStatus] = useState(null) // null | 'ok' | 'error'
  const [backupStatus, setBackupStatus] = useState(null)   // null | { ok, msg }
  const [infoOpen, setInfoOpen] = useState({})
  const toggleInfo = (key) => setInfoOpen((p) => ({ ...p, [key]: !p[key] }))
  const fileRef = useRef(null)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSave = () => {
    update({ settings: { ...form } })
    onClose()
  }

  const handleBackup = async () => {
    const backup = createBackup()
    const jsonString = JSON.stringify(backup, null, 2)

    if (window.electronAPI) {
      try {
        const { filename, folder } = await window.electronAPI.saveBackup(jsonString)
        setBackupStatus({ ok: true, msg: `Saved "${filename}" → ${folder}` })
      } catch (err) {
        setBackupStatus({ ok: false, msg: 'Failed to save backup: ' + err.message })
      }
    } else {
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = now.getFullYear()
      downloadJSON(backup, `notes_organiser_backup_${dd}.${mm}.${yyyy}.json`)
    }
  }

  const handleRestoreFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (data._app !== 'NotesOrganiser') {
          setRestoreStatus('error')
          return
        }
        const ok = restoreFromBackup(data)
        setRestoreStatus(ok ? 'ok' : 'error')
        if (ok) {
          // Sync local form with restored settings
          setForm({ ...data.settings })
        }
      } catch {
        setRestoreStatus('error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleClearData = () => {
    if (!confirm('This will permanently delete all your notes, recurring meetings, and templates. Your settings will also reset.\n\nThis cannot be undone. Continue?')) return
    clearAllData()
    onClose()
  }

  const systemLang = getSystemLanguage()
  const systemLangLabel = LANGUAGES.find((l) => l.code === systemLang)?.label || 'English'

  const noteCount = meetingNotes.length
  const meetingCount = recurringMeetings.length
  const templateCount = templates.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <h2 className="font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Identity */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Your Identity</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              You'll be pre-filled as the first participant on every new note.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Your Name</label>
                <input className="input" value={form.yourName} onChange={(e) => set('yourName', e.target.value)} placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="label">Your Firm / Company</label>
                <input className="input" value={form.yourFirm} onChange={(e) => set('yourFirm', e.target.value)} placeholder="e.g. Acme Corp" />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Also used in auto-generated note titles.</p>
              </div>
              <div>
                <label className="label">Your Role / Position</label>
                <input className="input" value={form.yourRole} onChange={(e) => set('yourRole', e.target.value)} placeholder="e.g. Sales Manager" />
              </div>
            </div>
          </div>

          {/* Language */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Language</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Default language for note labels (Topics, Status, etc.). Can be overridden per meeting.
            </p>
            <div>
              <label className="label">Default Language</label>
              <select className="input" value={form.language} onChange={(e) => set('language', e.target.value)}>
                <option value="">System default ({systemLangLabel})</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Theme colour */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Theme Colour</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Choose separate accent colours for light and dark mode.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Light Mode Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accentLight || '#ff0000'}
                    onChange={(e) => set('accentLight', e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5 shrink-0"
                  />
                  <input
                    className="input"
                    value={form.accentLight || '#ff0000'}
                    onChange={(e) => set('accentLight', e.target.value)}
                    placeholder="#ff0000"
                  />
                </div>
              </div>
              <div>
                <label className="label">Dark Mode Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accentDark || '#FF6B6B'}
                    onChange={(e) => set('accentDark', e.target.value)}
                    className="w-9 h-9 rounded cursor-pointer border border-gray-200 dark:border-gray-600 p-0.5 shrink-0"
                  />
                  <input
                    className="input"
                    value={form.accentDark || '#FF6B6B'}
                    onChange={(e) => set('accentDark', e.target.value)}
                    placeholder="#FF6B6B"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Export format */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Download size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Default Export Format</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Used when you click Export. You can still switch per note.
            </p>
            <select className="input" value={form.exportFormat || 'pdf'} onChange={(e) => set('exportFormat', e.target.value)}>
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* AI Notes defaults */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI Notes Default Tone</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Default tone used when generating notes with an LLM. Can be overridden per meeting.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Formality</label>
                <select className="input" value={form.aiTone?.formality || 'professional'} onChange={(e) => set('aiTone', { ...form.aiTone, formality: e.target.value })}>
                  <option value="casual">Casual &amp; friendly</option>
                  <option value="professional">Professional</option>
                  <option value="formal">Formal &amp; precise</option>
                </select>
              </div>
              <div>
                <label className="label">Detail Level</label>
                <select className="input" value={form.aiTone?.conciseness || 'balanced'} onChange={(e) => set('aiTone', { ...form.aiTone, conciseness: e.target.value })}>
                  <option value="brief">Brief / Bullet points</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed / Verbose</option>
                </select>
              </div>
              <div>
                <label className="label">Custom Instructions <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.aiTone?.customInstructions || ''}
                  onChange={(e) => set('aiTone', { ...form.aiTone, customInstructions: e.target.value })}
                  placeholder="e.g. Always include a decisions section. Use bullet points throughout."
                />
              </div>
              <div>
                <label className="label">Previous Meeting Context</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min={0}
                    max={16}
                    step={1}
                    value={form.notesContextDepth ?? 4}
                    onChange={(e) => set('notesContextDepth', +e.target.value)}
                    className="flex-1 accent-accent"
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-6 text-center shrink-0">
                    {form.notesContextDepth ?? 4}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {(form.notesContextDepth ?? 4) === 0
                    ? 'No previous meeting context included in AI prompts.'
                    : `Include the ${form.notesContextDepth ?? 4} most recent prior meetings from the same series as read-only context in AI prompts (0–16).`}
                </p>
              </div>
            </div>
          </div>

          {/* AI Prompt Mode */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Download size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI Prompt Mode</p>
              <button onClick={() => toggleInfo('aiMode')} className={`p-0.5 transition-colors ${infoOpen.aiMode ? 'text-accent' : 'text-gray-300 dark:text-gray-600 hover:text-accent'}`} title="What is this?">
                <Info size={12} />
              </button>
            </div>
            {infoOpen.aiMode && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Controls how AI prompts are exported and how you import AI responses. <strong>Download mode</strong> saves/loads JSON files. <strong>Clipboard mode</strong> copies/pastes directly — the AI is instructed to output only raw JSON with no extra text, making it faster to use with chat interfaces.
              </p>
            )}
            <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-lg p-1 w-fit">
              <button
                onClick={() => set('aiPromptMode', 'download')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  (form.aiPromptMode || 'download') === 'download'
                    ? 'bg-accent text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Download / Upload
              </button>
              <button
                onClick={() => set('aiPromptMode', 'clipboard')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  form.aiPromptMode === 'clipboard'
                    ? 'bg-accent text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Copy / Paste
              </button>
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Internal Notes</p>
              <button onClick={() => toggleInfo('internalNotes')} className={`p-0.5 transition-colors ${infoOpen.internalNotes ? 'text-accent' : 'text-gray-300 dark:text-gray-600 hover:text-accent'}`} title="What is this?">
                <Info size={12} />
              </button>
            </div>
            {infoOpen.internalNotes && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Adds a parallel set of sections to each meeting note — visible only to you (never exported to the standard PDF/image). Use it for internal commentary, team-only context, or sensitive notes that shouldn't appear in customer-facing outputs. Disabling hides the feature everywhere but preserves all data.
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Internal Notes</span>
              <Toggle
                checked={!!form.internalNotesEnabled}
                onChange={(val) => set('internalNotesEnabled', val)}
              />
            </div>
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tasks</p>
              <button onClick={() => toggleInfo('tasks')} className={`p-0.5 transition-colors ${infoOpen.tasks ? 'text-accent' : 'text-gray-300 dark:text-gray-600 hover:text-accent'}`} title="What is this?">
                <Info size={12} />
              </button>
            </div>
            {infoOpen.tasks && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Adds a Tasks section to every meeting note for tracking action items with assignees, due dates, and status (Planned → In Progress → Complete / Blocked). A top-level Tasks page in the nav shows all tasks across every meeting with filters. The Notes overlay gets dedicated task columns for AI-assisted extraction. Disabling hides all task UI but preserves all data.
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Tasks</span>
              <Toggle
                checked={!!form.tasksEnabled}
                onChange={(val) => set('tasksEnabled', val)}
              />
            </div>
          </div>

          {/* Data management */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} className="text-accent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Data &amp; Backup</p>
            </div>

            {/* Storage summary */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-4 py-3 mb-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Stored data</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{noteCount}</p>
                  <p className="text-xs text-gray-400">Notes</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{meetingCount}</p>
                  <p className="text-xs text-gray-400">Meetings</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{templateCount}</p>
                  <p className="text-xs text-gray-400">Templates</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                All data is stored locally in your browser (localStorage).
              </p>
            </div>

            <div className="space-y-3">
              {/* Backup */}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Backup</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Download a .json file containing all your notes, meetings, templates, and settings.
                </p>
                <button
                  onClick={handleBackup}
                  className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={14} /> Download Backup
                </button>
                {backupStatus && (
                  <div className={`mt-2 flex items-start gap-2 text-xs ${backupStatus.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {backupStatus.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                    <span className="break-all">{backupStatus.msg}</span>
                  </div>
                )}
              </div>

              {/* Restore */}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Restore</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Restore from a previously downloaded backup file. This will replace all current data.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleRestoreFile}
                />
                <button
                  onClick={() => { setRestoreStatus(null); fileRef.current?.click() }}
                  className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <Upload size={14} /> Restore from Backup
                </button>
                {restoreStatus === 'ok' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 size={13} /> Backup restored successfully.
                  </div>
                )}
                {restoreStatus === 'error' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-red-500 dark:text-red-400">
                    <AlertTriangle size={13} /> Invalid backup file. Make sure you select a Notes Organiser backup.
                  </div>
                )}
              </div>

              {/* Clear data */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Clear all data</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Permanently delete everything stored in this browser. Download a backup first if you want to keep your data.
                </p>
                <button
                  onClick={handleClearData}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium py-2 px-4 rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <Trash2 size={14} /> Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4 sticky bottom-0 bg-white dark:bg-gray-900">
          <div className="flex gap-2 justify-end mb-3">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Settings</button>
          </div>
          <p className="text-xs text-center text-gray-300 dark:text-gray-600">Created by Monteo Pietsch</p>
        </div>
      </div>
    </div>
  )
}
