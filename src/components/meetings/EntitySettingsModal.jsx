import React, { useState } from 'react'
import { X, Settings, LayoutTemplate, Globe, Download, Tag, Pencil } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { LANGUAGES } from '../../utils/i18n'

const EXPORT_FORMATS = [
  { value: '', label: 'Inherit from system' },
  { value: 'pdf', label: 'PDF (.pdf)' },
  { value: 'png', label: 'Image (.png)' },
  { value: 'docx', label: 'Word (.docx)' },
]

export default function EntitySettingsModal({ entity, onClose }) {
  const { templates, saveCustomer } = useApp()
  const cs = entity.customerSettings || {}

  const [name, setName] = useState(entity.name || '')
  const [form, setForm] = useState({
    defaultTemplateId: cs.defaultTemplateId || '',
    defaultLanguage: cs.defaultLanguage || '',
    defaultExportFormat: cs.defaultExportFormat || '',
    defaultEventType: cs.defaultEventType || '',
    defaultAiFormality: cs.defaultAiFormality || '',
    defaultAiConciseness: cs.defaultAiConciseness || '',
    defaultAiInstructions: cs.defaultAiInstructions || '',
  })

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSave = () => {
    saveCustomer({
      ...entity,
      name: name.trim() || entity.name,
      customerSettings: {
        defaultTemplateId: form.defaultTemplateId,
        defaultLanguage: form.defaultLanguage,
        defaultExportFormat: form.defaultExportFormat,
        defaultEventType: form.defaultEventType,
        defaultAiFormality: form.defaultAiFormality,
        defaultAiConciseness: form.defaultAiConciseness,
        defaultAiInstructions: form.defaultAiInstructions,
      },
    })
    onClose()
  }

  const entityLabel = entity.type === 'project'
    ? (entity.parentId ? 'Sub-Project' : 'Project')
    : (entity.parentId ? 'Sub-Customer' : 'Customer')

  const hasAny = form.defaultTemplateId || form.defaultLanguage || form.defaultExportFormat
    || form.defaultEventType || form.defaultAiFormality || form.defaultAiConciseness || form.defaultAiInstructions

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Settings size={15} className="text-accent shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white truncate">{entity.name}</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">{entityLabel} defaults</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 shrink-0"><X size={16} /></button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Name */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pencil size={13} className="text-accent shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</p>
            </div>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={entity.name}
            />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Defaults below apply to all new recurring meetings and notes under <strong>{entity.name}</strong>.
            Settings on individual recurring meetings override these; global settings fill in anything left blank.
          </p>

          {/* Template */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <LayoutTemplate size={13} className="text-accent shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Default Template</p>
            </div>
            <select
              className="input"
              value={form.defaultTemplateId}
              onChange={(e) => set('defaultTemplateId', e.target.value)}
            >
              <option value="">None (inherit from system)</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Applies when creating a new note or recurring meeting under this {entityLabel.toLowerCase()}, unless overridden per-meeting.
            </p>
          </div>

          {/* Language */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe size={13} className="text-accent shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Default Language</p>
            </div>
            <select
              className="input"
              value={form.defaultLanguage}
              onChange={(e) => set('defaultLanguage', e.target.value)}
            >
              <option value="">None (inherit from system)</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Export format */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Download size={13} className="text-accent shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Default Export Format</p>
            </div>
            <select
              className="input"
              value={form.defaultExportFormat}
              onChange={(e) => set('defaultExportFormat', e.target.value)}
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Event type */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag size={13} className="text-accent shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Default Meeting Type</p>
            </div>
            <input
              className="input"
              value={form.defaultEventType}
              onChange={(e) => set('defaultEventType', e.target.value)}
              placeholder="e.g. Review, Check-in, Workshop"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Pre-fills the event type for new recurring meetings under this {entityLabel.toLowerCase()}.
            </p>
          </div>

          {/* AI tone */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Settings size={13} className="text-accent shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI Tone Defaults</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Formality</label>
                <select
                  className="input"
                  value={form.defaultAiFormality}
                  onChange={(e) => set('defaultAiFormality', e.target.value)}
                >
                  <option value="">None (inherit from system)</option>
                  <option value="casual">Casual &amp; friendly</option>
                  <option value="professional">Professional</option>
                  <option value="formal">Formal &amp; precise</option>
                </select>
              </div>
              <div>
                <label className="label">Detail Level</label>
                <select
                  className="input"
                  value={form.defaultAiConciseness}
                  onChange={(e) => set('defaultAiConciseness', e.target.value)}
                >
                  <option value="">None (inherit from system)</option>
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
                  value={form.defaultAiInstructions}
                  onChange={(e) => set('defaultAiInstructions', e.target.value)}
                  placeholder={`e.g. Always mention ${entity.name}'s project status at the top.`}
                />
              </div>
            </div>
          </div>

          {hasAny && (
            <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
              These defaults are applied in order: <strong>Individual meeting</strong> → <strong>this {entityLabel.toLowerCase()}</strong>{entity.parentId ? ' → Parent' : ''} → <strong>System settings</strong>.
            </div>
          )}
        </div>

        <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4 sticky bottom-0 bg-white dark:bg-gray-900">
          <div className="flex gap-2 justify-end">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave}>Save Defaults</button>
          </div>
        </div>
      </div>
    </div>
  )
}
