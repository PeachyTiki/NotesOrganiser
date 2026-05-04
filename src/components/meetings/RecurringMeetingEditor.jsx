import React, { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Globe } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../../context/AppContext'
import { LANGUAGES, getSystemLanguage } from '../../utils/i18n'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function scheduleLabel(schedule) {
  if (!schedule || !schedule.type || schedule.type === 'none') return null
  const day = DAY_NAMES[schedule.dayOfWeek ?? 1] || 'Monday'
  if (schedule.type === 'weekly') return `Every ${day}`
  if (schedule.type === 'biweekly') return `Every other ${day}`
  if (schedule.type === 'monthly-date') {
    const d = schedule.dateOfMonth ?? 1
    const s = d === 1 || d === 21 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th'
    return `${d}${s} of every month`
  }
  if (schedule.type === 'monthly-weekday') {
    const ord = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', last: 'Last' }[schedule.weekOfMonth] || '1st'
    return `${ord} ${day} of every month`
  }
  return null
}

function emptyMeeting(settings) {
  const self = settings?.yourName
    ? { id: 'self', name: settings.yourName, firm: settings.yourFirm || '', role: settings.yourRole || '', enabled: true, isSelf: true }
    : { id: 'self', name: '', firm: '', role: '', enabled: true, isSelf: true }
  return {
    id: uuid(),
    name: '',
    customer: '',
    eventType: '',
    team: '',
    schedule: { type: 'none' },
    participants: [self],
    templateId: '',
    language: '',
    createdAt: new Date().toISOString(),
  }
}

function emptyParticipant() {
  return { id: uuid(), name: '', firm: '', role: '', enabled: true }
}

function ordSuffix(d) {
  return d === 1 || d === 21 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th'
}

export default function RecurringMeetingEditor({ meeting, prefilledCustomer, onClose }) {
  const { saveRecurringMeeting, deleteRecurringMeeting, templates, settings, customers } = useApp()
  const [form, setForm] = useState(
    meeting
      ? { ...meeting, schedule: meeting.schedule || { type: 'none' }, participants: meeting.participants?.map((p) => ({ ...p })) || [] }
      : { ...emptyMeeting(settings), customer: prefilledCustomer || '' }
  )

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const setSchedule = (key, val) => setForm((f) => ({ ...f, schedule: { ...(f.schedule || {}), [key]: val } }))

  const scheduleType = form.schedule?.type || 'none'

  const addParticipant = () => set('participants', [...form.participants, emptyParticipant()])
  const updateParticipant = (id, key, value) =>
    set('participants', form.participants.map((p) => (p.id === id ? { ...p, [key]: value } : p)))
  const removeParticipant = (id) =>
    set('participants', form.participants.filter((p) => p.id !== id))

  const handleSave = () => {
    if (!form.name.trim()) { alert('Please enter a meeting name.'); return }
    if (!form.customer.trim()) { alert('Please enter a customer name.'); return }
    saveRecurringMeeting({ ...form, updatedAt: new Date().toISOString() })
    onClose()
  }

  const label = scheduleLabel(form.schedule)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="btn-ghost flex items-center gap-1.5 text-sm">
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {meeting ? 'Edit Recurring Meeting' : 'New Recurring Meeting'}
        </h1>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Identity */}
        <div className="card p-4 space-y-4">
          <h2 className="section-title text-base">Meeting Identity</h2>
          <div>
            <label className="label">Meeting Name *</label>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Weekly Jour Fixe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Customer *</label>
              <input
                className="input"
                value={form.customer}
                onChange={(e) => set('customer', e.target.value)}
                placeholder="e.g. Acme Corp"
                list="customer-names-list"
              />
              <datalist id="customer-names-list">
                {(customers || []).map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Event Type</label>
              <input className="input" value={form.eventType} onChange={(e) => set('eventType', e.target.value)} placeholder="e.g. Jour Fixe" />
            </div>
          </div>
          <div>
            <label className="label">Team / Recipient Group</label>
            <input className="input" value={form.team} onChange={(e) => set('team', e.target.value)} placeholder="e.g. Marketing Team" />
          </div>
        </div>

        {/* Schedule */}
        <div className="card p-4 space-y-4">
          <h2 className="section-title text-base">Schedule</h2>
          <div>
            <label className="label">Recurrence</label>
            <select className="input" value={scheduleType} onChange={(e) => setSchedule('type', e.target.value)}>
              <option value="none">Not specified</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every two weeks (bi-weekly)</option>
              <option value="monthly-date">Monthly — on a specific date</option>
              <option value="monthly-weekday">Monthly — on a specific weekday</option>
            </select>
          </div>

          {(scheduleType === 'weekly' || scheduleType === 'biweekly') && (
            <div>
              <label className="label">Day of week</label>
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSchedule('dayOfWeek', i)}
                    className={`py-2 text-xs rounded-lg font-semibold transition-colors ${
                      (form.schedule?.dayOfWeek ?? 1) === i
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scheduleType === 'monthly-date' && (
            <div>
              <label className="label">Date of month</label>
              <div className="flex items-center gap-3">
                <select
                  className="input w-36"
                  value={form.schedule?.dateOfMonth ?? 1}
                  onChange={(e) => setSchedule('dateOfMonth', +e.target.value)}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}{ordSuffix(d)}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-500 dark:text-gray-400">of every month</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                Max 28th to work every month. For end-of-month use monthly weekday instead.
              </p>
            </div>
          )}

          {scheduleType === 'monthly-weekday' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Which occurrence</label>
                  <select
                    className="input"
                    value={form.schedule?.weekOfMonth ?? 1}
                    onChange={(e) => setSchedule('weekOfMonth', e.target.value === 'last' ? 'last' : +e.target.value)}
                  >
                    <option value={1}>1st</option>
                    <option value={2}>2nd</option>
                    <option value={3}>3rd</option>
                    <option value={4}>4th</option>
                    <option value="last">Last</option>
                  </select>
                </div>
                <div>
                  <label className="label">Day of week</label>
                  <select
                    className="input"
                    value={form.schedule?.dayOfWeek ?? 1}
                    onChange={(e) => setSchedule('dayOfWeek', +e.target.value)}
                  >
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {label && (
            <div className="flex items-center gap-2 rounded-lg bg-accent-light/40 dark:bg-accent-light border border-accent/20 px-3 py-2">
              <span className="text-xs font-semibold text-accent">Recurs:</span>
              <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
            </div>
          )}
        </div>

        {/* Notes AI Defaults */}
        <div className="card p-4 space-y-3">
          <div>
            <h2 className="section-title text-base">Notes AI Defaults</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Default tone used when exporting an AI prompt for notes in this series. Each meeting can override these.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-sm">Formality</label>
              <select
                className="input"
                value={form.defaultNotesTone?.formality || 'professional'}
                onChange={(e) => set('defaultNotesTone', { ...(form.defaultNotesTone || {}), formality: e.target.value })}
              >
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="formal">Formal</option>
              </select>
            </div>
            <div>
              <label className="label text-sm">Detail Level</label>
              <select
                className="input"
                value={form.defaultNotesTone?.conciseness || 'balanced'}
                onChange={(e) => set('defaultNotesTone', { ...(form.defaultNotesTone || {}), conciseness: e.target.value })}
              >
                <option value="brief">Brief / Bullet points</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label text-sm">Custom Instructions <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
            <textarea
              className="input text-sm resize-none"
              rows={2}
              value={form.defaultNotesTone?.customInstructions || ''}
              onChange={(e) => set('defaultNotesTone', { ...(form.defaultNotesTone || {}), customInstructions: e.target.value })}
              placeholder="e.g. Focus on decisions and action items. Use concise bullet points."
            />
          </div>
        </div>

        {/* Default template + language */}
        <div className="card p-4 space-y-3">
          <div>
            <label className="label">Default Template</label>
            <select className="input" value={form.templateId} onChange={(e) => set('templateId', e.target.value)}>
              <option value="">None (use app default)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Globe size={13} className="text-gray-400" /> Meeting Language
            </label>
            <select className="input" value={form.language} onChange={(e) => set('language', e.target.value)}>
              <option value="">System / app default</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Applied to all notes written for this recurring meeting.
            </p>
          </div>
        </div>

        {/* Participants */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title text-base">Participants</h2>
            <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={addParticipant}>
              <Plus size={14} /> Add Person
            </button>
          </div>

          {form.participants.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              No participants yet — add people to reuse their info in notes
            </p>
          )}

          <div className="space-y-3">
            {form.participants.map((p) => (
              <div
                key={p.id}
                className={`border rounded-lg p-3 ${
                  p.isSelf
                    ? 'border-accent/40 dark:border-accent/30 bg-accent-light dark:bg-accent/10'
                    : p.enabled !== false
                    ? 'border-gray-100 dark:border-gray-700'
                    : 'border-gray-100 dark:border-gray-800 opacity-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={p.enabled !== false}
                    onChange={(e) => updateParticipant(p.id, 'enabled', e.target.checked)}
                    className="rounded"
                    title="Include in notes"
                  />
                  <span className="text-xs flex-1 font-medium text-gray-500 dark:text-gray-400">
                    {p.isSelf ? 'You' : 'Participant'}
                  </span>
                  <button onClick={() => removeParticipant(p.id)} className="text-gray-400 hover:text-red-500 p-0.5">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    className={`input text-xs ${p.isSelf ? 'bg-white dark:bg-gray-800' : ''}`}
                    value={p.name}
                    onChange={(e) => updateParticipant(p.id, 'name', e.target.value)}
                    placeholder={p.isSelf ? 'John / Jane Doe' : 'Name'}
                  />
                  <input
                    className="input text-xs"
                    value={p.firm}
                    onChange={(e) => updateParticipant(p.id, 'firm', e.target.value)}
                    placeholder="Firm / Company"
                  />
                  <input
                    className="input text-xs"
                    value={p.role}
                    onChange={(e) => updateParticipant(p.id, 'role', e.target.value)}
                    placeholder="Role"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="btn-primary flex-1" onClick={handleSave}>Save Meeting</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          {meeting && (
            <button
              className="btn-ghost text-red-500 hover:text-red-600"
              onClick={() => {
                if (confirm('Delete this recurring meeting?')) {
                  deleteRecurringMeeting(meeting.id)
                  onClose()
                }
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
