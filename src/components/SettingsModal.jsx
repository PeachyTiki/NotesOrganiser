import React, { useState, useRef } from 'react'
import { X, User, Globe, Palette, Download, Database, Upload, Trash2, CheckCircle2, AlertTriangle, Brain, Lock, CheckSquare, Info, LayoutTemplate, Bell, Folder } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { LANGUAGES, getSystemLanguage } from '../utils/i18n'
import { arrayBufferToBase64 } from '../utils/export'
import { scheduledBackupFilename } from '../utils/backupSchedule'
import { useConfirm } from './ui/DialogProvider'
import UnsavedChangesModal from './ui/UnsavedChangesModal'
import Toggle from './Toggle'
import TemplatePickerDropdown from './templates/TemplatePickerDropdown'
import Select from './ui/Select'

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'png', label: 'Image (.png)' },
  { value: 'docx', label: 'Word (.docx)' },
]

const FORMALITY_OPTIONS = [
  { value: 'casual', label: 'Casual & friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'formal', label: 'Formal & precise' },
]

const CONCISENESS_OPTIONS = [
  { value: 'brief', label: 'Brief / Bullet points' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed / Verbose' },
]

const TASK_NOTIFICATION_FREQUENCY_OPTIONS = [
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 240, label: 'Every 4 hours' },
  { value: 480, label: 'Every 8 hours' },
  { value: 'daily', label: 'Once a day' },
  { value: 'weekly', label: 'Once a week' },
]

const BACKUP_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Once a day' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'monthly', label: 'Once a month' },
]

const WEEKLY_DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
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
  const confirm = useConfirm()
  const [form, setForm] = useState({ ...settings })
  const [restoreStatus, setRestoreStatus] = useState(null) // null | 'ok' | 'error'
  const [backupStatus, setBackupStatus] = useState(null)   // null | { ok, msg }
  const [autoBackupStatus, setAutoBackupStatus] = useState(null) // null | { ok, msg }
  const [scheduledStatus, setScheduledStatus] = useState(null) // null | { ok, msg }
  const [infoOpen, setInfoOpen] = useState({})
  const toggleInfo = (key) => setInfoOpen((p) => ({ ...p, [key]: !p[key] }))
  const fileRef = useRef(null)
  const [showDiscardModal, setShowDiscardModal] = useState(false)

  const dirty = JSON.stringify(form) !== JSON.stringify(settings)

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSave = () => {
    // The scheduled-backup runner writes `lastRunAt` straight to live settings
    // in the background; don't let this modal's older form copy clobber it.
    const merged = { ...form }
    if (form.scheduledBackup) {
      merged.scheduledBackup = {
        ...form.scheduledBackup,
        lastRunAt: settings.scheduledBackup?.lastRunAt ?? form.scheduledBackup.lastRunAt,
      }
    }
    update({ settings: merged })
    onClose()
  }

  // Settings stays mounted on top of the app regardless of section nav, so
  // the only ways to actually lose in-progress edits are its own close
  // affordances (X / backdrop / Cancel) — route all of them through this.
  const requestClose = () => {
    if (!dirty) { onClose(); return }
    setShowDiscardModal(true)
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

  const AUTO_BACKUP_FILENAME = 'notes_organiser_auto_backup.json'

  const handleChooseAutoBackupFolder = async () => {
    if (!window.electronAPI?.selectFolder) {
      setAutoBackupStatus({ ok: false, msg: 'Only available in the desktop app.' })
      return
    }
    const folder = await window.electronAPI.selectFolder()
    if (folder) { set('autoBackupFolder', folder); setAutoBackupStatus(null) }
  }

  const handleBackupNowToFolder = async () => {
    if (!form.autoBackupFolder || !window.electronAPI?.writeFile) return
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(createBackup()))
      const base64 = arrayBufferToBase64(bytes.buffer)
      const result = await window.electronAPI.writeFile([form.autoBackupFolder], AUTO_BACKUP_FILENAME, base64)
      if (result?.ok) setAutoBackupStatus({ ok: true, msg: `Backed up to ${result.filePath}` })
      else setAutoBackupStatus({ ok: false, msg: 'Failed to back up: ' + (result?.error || 'unknown error') })
    } catch (err) {
      setAutoBackupStatus({ ok: false, msg: 'Failed to back up: ' + err.message })
    }
  }

  // ── Scheduled full backup (configurable cadence, runs at 12:00 local) ──
  const sb = form.scheduledBackup || { enabled: false, folder: '', frequency: 'weekly', lastRunAt: '' }
  const setSB = (patch) => set('scheduledBackup', { ...sb, ...patch })

  const handleChooseScheduledFolder = async () => {
    if (!window.electronAPI?.selectFolder) {
      setScheduledStatus({ ok: false, msg: 'Only available in the desktop app.' })
      return
    }
    const folder = await window.electronAPI.selectFolder()
    if (folder) { setSB({ folder, enabled: true }); setScheduledStatus(null) }
  }

  const handleScheduledBackupNow = async () => {
    if (!sb.folder || !window.electronAPI?.writeFile) return
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(createBackup()))
      const base64 = arrayBufferToBase64(bytes.buffer)
      const result = await window.electronAPI.writeFile([sb.folder], scheduledBackupFilename(), base64)
      if (result?.ok) setScheduledStatus({ ok: true, msg: `Backed up to ${result.filePath}` })
      else setScheduledStatus({ ok: false, msg: 'Failed to back up: ' + (result?.error || 'unknown error') })
    } catch (err) {
      setScheduledStatus({ ok: false, msg: 'Failed to back up: ' + err.message })
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

  const handleClearData = async () => {
    const ok = await confirm({
      title: 'Clear all data',
      message: 'This will permanently delete all your notes, recurring meetings, and templates. Your settings will also reset.\n\nThis cannot be undone. Continue?',
      confirmLabel: 'Clear Everything',
      danger: true,
    })
    if (!ok) return
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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={requestClose} />

      <div className="relative dropdown-panel rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/60 dark:border-white/10 sticky top-0 glass-pill z-10">
          <h2 className="font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={requestClose} className="btn-ghost p-1.5"><X size={16} /></button>
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
              <Select
                value={form.language}
                onChange={(v) => set('language', v)}
                options={[
                  { value: '', label: `System default (${systemLangLabel})` },
                  ...LANGUAGES.map((l) => ({ value: l.code, label: l.label })),
                ]}
              />
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
            <Select
              value={form.exportFormat || 'pdf'}
              onChange={(v) => set('exportFormat', v)}
              options={EXPORT_FORMATS}
            />
          </div>

          {/* Default template */}
          {templates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LayoutTemplate size={14} className="text-accent" />
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Default Template</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Applied to new notes when no template is set at meeting or customer level.
              </p>
              <TemplatePickerDropdown
                value={form.defaultTemplateId || ''}
                onChange={(v) => set('defaultTemplateId', v)}
                placeholder="None (plain style)"
              />
            </div>
          )}

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
                <Select
                  value={form.aiTone?.formality || 'professional'}
                  onChange={(v) => set('aiTone', { ...form.aiTone, formality: v })}
                  options={FORMALITY_OPTIONS}
                />
              </div>
              <div>
                <label className="label">Detail Level</label>
                <Select
                  value={form.aiTone?.conciseness || 'balanced'}
                  onChange={(v) => set('aiTone', { ...form.aiTone, conciseness: v })}
                  options={CONCISENESS_OPTIONS}
                />
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
                    ? 'bg-accent text-[color:var(--accent-contrast)]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Download / Upload
              </button>
              <button
                onClick={() => set('aiPromptMode', 'clipboard')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  form.aiPromptMode === 'clipboard'
                    ? 'bg-accent text-[color:var(--accent-contrast)]'
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

          {/* Task Notifications */}
          {form.tasksEnabled && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={14} className="text-accent" />
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Task Notifications</p>
                <button onClick={() => toggleInfo('taskNotifications')} className={`p-0.5 transition-colors ${infoOpen.taskNotifications ? 'text-accent' : 'text-gray-300 dark:text-gray-600 hover:text-accent'}`} title="What is this?">
                  <Info size={12} />
                </button>
              </div>
              {infoOpen.taskNotifications && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Shows a desktop notification on a schedule, summarising how many tasks are open, overdue, and due today. Only fires while the app is running — closed or quit doesn't queue anything up.
                </p>
              )}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Task Notifications</span>
                <Toggle
                  checked={!!form.taskNotifications?.enabled}
                  onChange={(val) => set('taskNotifications', { ...form.taskNotifications, enabled: val })}
                />
              </div>
              {form.taskNotifications?.enabled && (
                <div>
                  <label className="label">Frequency</label>
                  <Select
                    value={
                      form.taskNotifications?.mode === 'weekly' ? 'weekly'
                        : form.taskNotifications?.mode === 'daily' ? 'daily'
                        : (form.taskNotifications?.frequencyMinutes ?? 60)
                    }
                    onChange={(v) => {
                      if (v === 'daily') {
                        set('taskNotifications', { ...form.taskNotifications, mode: 'daily', dailyTime: form.taskNotifications?.dailyTime || '09:00' })
                      } else if (v === 'weekly') {
                        set('taskNotifications', {
                          ...form.taskNotifications, mode: 'weekly',
                          weeklyDay: form.taskNotifications?.weeklyDay ?? 1,
                          weeklyTime: form.taskNotifications?.weeklyTime || '09:00',
                        })
                      } else {
                        set('taskNotifications', { ...form.taskNotifications, mode: 'interval', frequencyMinutes: v })
                      }
                    }}
                    options={TASK_NOTIFICATION_FREQUENCY_OPTIONS}
                  />

                  {form.taskNotifications?.mode === 'daily' && (
                    <div className="mt-2">
                      <label className="label text-xs">Time</label>
                      <input
                        type="time"
                        className="input"
                        value={form.taskNotifications?.dailyTime || '09:00'}
                        onChange={(e) => set('taskNotifications', { ...form.taskNotifications, dailyTime: e.target.value })}
                      />
                    </div>
                  )}

                  {form.taskNotifications?.mode === 'weekly' && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="label text-xs">Day</label>
                        <Select
                          value={form.taskNotifications?.weeklyDay ?? 1}
                          onChange={(v) => set('taskNotifications', { ...form.taskNotifications, weeklyDay: v })}
                          options={WEEKLY_DAY_OPTIONS}
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Time</label>
                        <input
                          type="time"
                          className="input"
                          value={form.taskNotifications?.weeklyTime || '09:00'}
                          onChange={(e) => set('taskNotifications', { ...form.taskNotifications, weeklyTime: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

              {/* Automatic daily backup */}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Automatic Daily Backup</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Pick a folder and Notes Organiser will silently save a full backup there once a day, overwriting the previous one each time.
                </p>
                {form.autoBackupFolder && (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-3 py-2 mb-2">
                    <p className="text-xs text-gray-600 dark:text-gray-300 break-all">{form.autoBackupFolder}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleChooseAutoBackupFolder}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                  >
                    <Folder size={14} /> {form.autoBackupFolder ? 'Change Folder' : 'Choose Folder'}
                  </button>
                  {form.autoBackupFolder && (
                    <button
                      onClick={() => set('autoBackupFolder', '')}
                      className="btn-ghost text-sm text-red-500 hover:text-red-600"
                    >
                      Disable
                    </button>
                  )}
                </div>
                {form.autoBackupFolder && (
                  <button
                    onClick={handleBackupNowToFolder}
                    className="w-full btn-secondary flex items-center justify-center gap-2 text-sm mt-2"
                  >
                    <Download size={14} /> Back Up Now
                  </button>
                )}
                {autoBackupStatus && (
                  <div className={`mt-2 flex items-start gap-2 text-xs ${autoBackupStatus.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {autoBackupStatus.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                    <span className="break-all">{autoBackupStatus.msg}</span>
                  </div>
                )}
              </div>

              {/* Scheduled full backup */}
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Scheduled Full Backup</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Save a complete, dated backup of everything — notes, tasks, customers, templates (including logos), and all settings — to a folder you choose, automatically at 12:00 midday. If your computer is off at that time, it runs the next time you open the app.
                </p>
                {sb.folder && (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 px-3 py-2 mb-2">
                    <p className="text-xs text-gray-600 dark:text-gray-300 break-all">{sb.folder}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleChooseScheduledFolder}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                  >
                    <Folder size={14} /> {sb.folder ? 'Change Folder' : 'Choose Folder'}
                  </button>
                  {sb.folder && (
                    <button
                      onClick={() => setSB({ enabled: false, folder: '' })}
                      className="btn-ghost text-sm text-red-500 hover:text-red-600"
                    >
                      Disable
                    </button>
                  )}
                </div>
                {sb.folder && (
                  <>
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Frequency</label>
                      <Select
                        value={sb.frequency || 'weekly'}
                        onChange={(v) => setSB({ frequency: v })}
                        options={BACKUP_FREQUENCY_OPTIONS}
                      />
                    </div>
                    <button
                      onClick={handleScheduledBackupNow}
                      className="w-full btn-secondary flex items-center justify-center gap-2 text-sm mt-2"
                    >
                      <Download size={14} /> Back Up Now
                    </button>
                    {sb.lastRunAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Last automatic backup: {new Date(sb.lastRunAt).toLocaleString()}
                      </p>
                    )}
                  </>
                )}
                {scheduledStatus && (
                  <div className={`mt-2 flex items-start gap-2 text-xs ${scheduledStatus.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {scheduledStatus.ok ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5" />}
                    <span className="break-all">{scheduledStatus.msg}</span>
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
            <button className="btn-secondary" onClick={requestClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Settings</button>
          </div>
          <p className="text-xs text-center text-gray-300 dark:text-gray-600">Created by Monteo Pietsch</p>
        </div>
      </div>

      {showDiscardModal && (
        <UnsavedChangesModal
          onCancel={() => setShowDiscardModal(false)}
          onDiscard={() => { setShowDiscardModal(false); onClose() }}
          onSave={() => { setShowDiscardModal(false); handleSave() }}
        />
      )}
    </div>
  )
}
