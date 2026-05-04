import React, { useState, useRef } from 'react'
import { X, Plus, Trash2, RefreshCw, Folder, Check, AlertTriangle } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../../context/AppContext'
import {
  noteFilename, notePathParts, noteMatchesSync, syncFileKey, sortSyncConfigs,
} from '../../utils/syncManager'
import { renderNoteToPdfBuffer, arrayBufferToBase64 } from '../../utils/export'
import { makeT } from '../../utils/i18n'

const LEVEL_META = {
  A: { badge: 'A', desc: 'All Notes',   color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  C: { badge: 'C', desc: 'Customer',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  M: { badge: 'M', desc: 'Meeting',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
}

export default function SyncPanel({ onClose }) {
  const {
    syncConfigs, syncFileMap, meetingNotes, recurringMeetings, templates,
    customers, settings, saveSyncConfig, deleteSyncConfig, updateSyncFileMap,
  } = useApp()

  const sorted = sortSyncConfigs(syncConfigs)
  const internalNotesEnabled = !!settings?.internalNotesEnabled

  // ── Add form ────────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false)
  const [addLevel, setAddLevel] = useState('A')
  const [addScopeId, setAddScopeId] = useState('')
  const [addScopeCustomer, setAddScopeCustomer] = useState('')
  const [addDestPath, setAddDestPath] = useState('')
  const [addError, setAddError] = useState('')
  const [addSyncExisting, setAddSyncExisting] = useState(false)

  const handleSelectFolder = async () => {
    if (!window.electronAPI?.selectFolder) {
      alert('Folder selection is only available in the desktop app.')
      return
    }
    const folder = await window.electronAPI.selectFolder()
    if (folder) setAddDestPath(folder)
  }

  const handleAddSync = () => {
    setAddError('')
    if (!addDestPath) { setAddError('Please select a destination folder.'); return }
    if ((addLevel === 'C' || addLevel === 'M') && !addScopeId) {
      setAddError(`Please select a ${addLevel === 'C' ? 'customer' : 'meeting series'}.`)
      return
    }
    const scopeId = addLevel === 'A' ? null : addScopeId
    const dupe = sorted.find(
      (c) => c.level === addLevel && c.scopeId === scopeId && c.destPath === addDestPath,
    )
    if (dupe) { setAddError('This sync already exists.'); return }

    let scopeLabel = 'All Notes'
    if (addLevel === 'C') scopeLabel = addScopeId
    if (addLevel === 'M') {
      const rm = recurringMeetings.find((m) => m.id === addScopeId)
      scopeLabel = rm?.name || addScopeId
    }

    const newCfg = { id: uuid(), level: addLevel, scopeId, scopeLabel, destPath: addDestPath }
    saveSyncConfig(newCfg)
    setShowAdd(false)
    setAddLevel('A'); setAddScopeId(''); setAddScopeCustomer(''); setAddDestPath(''); setAddSyncExisting(false)

    if (addSyncExisting && window.electronAPI) {
      const notes = (meetingNotes || []).filter((n) => !n.isDraft && noteMatchesSync(n, newCfg))
      if (notes.length > 0) {
        setSyncing(true)
        setProgress({ current: 0, total: notes.length, errors: 0, done: false })
        cancelRef.current = false
        ;(async () => {
          let errors = 0
          for (let i = 0; i < notes.length; i++) {
            if (cancelRef.current) break
            setProgress((p) => ({ ...p, current: i + 1 }))
            try {
              await runSyncJob({ note: notes[i], configs: [newCfg], isInternal: false })
              const internalActive = !!settings?.internalNotesEnabled && !!notes[i].modes?.internal
              if (internalActive && (notes[i].internalSections || []).length > 0) {
                await runSyncJob({ note: notes[i], configs: [newCfg], isInternal: true })
              }
            } catch { errors++ }
          }
          setSyncing(false)
          setProgress((p) => ({ ...p, errors, done: true }))
        })()
      }
    }
  }

  // ── Execute All Syncs ────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: 0, done: false })
  const cancelRef = useRef(false)

  const handleExecuteAll = async () => {
    if (!window.electronAPI) {
      alert('Sync is only available in the desktop app.')
      return
    }
    cancelRef.current = false

    const notes = (meetingNotes || []).filter((n) => !n.isDraft)
    const jobs = []
    for (const note of notes) {
      const matching = sorted.filter((cfg) => noteMatchesSync(note, cfg))
      if (!matching.length) continue
      jobs.push({ note, configs: matching, isInternal: false })
      const internalActive = internalNotesEnabled && !!note.modes?.internal
      if (internalActive && (note.internalSections || []).length > 0) {
        jobs.push({ note, configs: matching, isInternal: true })
      }
    }

    setSyncing(true)
    setProgress({ current: 0, total: jobs.length, errors: 0, done: false })
    let errors = 0

    for (let i = 0; i < jobs.length; i++) {
      if (cancelRef.current) break
      setProgress((p) => ({ ...p, current: i + 1 }))
      try {
        await runSyncJob(jobs[i])
      } catch (err) {
        console.error('[sync] bulk job error', err)
        errors++
      }
    }

    setSyncing(false)
    setProgress((p) => ({ ...p, errors, done: true }))
  }

  const runSyncJob = async ({ note, configs, isInternal }) => {
    const sections = isInternal ? (note.internalSections || []) : (note.sections || [])
    const templateId = isInternal ? note.internalTemplateId : note.templateId
    const template = templates.find((t) => t.id === templateId) || null
    const exportT = makeT(note.language)
    const noteForExport = { ...note, sections }

    const buffer = await renderNoteToPdfBuffer(noteForExport, template, exportT)
    const base64 = arrayBufferToBase64(buffer)
    const filename = noteFilename(note, isInternal)
    const fileMapUpdates = {}

    for (const cfg of configs) {
      const key = syncFileKey(note.id, cfg.id, isInternal)
      const oldPath = (syncFileMap || {})[key]
      if (oldPath) await window.electronAPI.deleteFile(oldPath).catch(() => {})
      const pathParts = notePathParts(note, cfg, recurringMeetings)
      const result = await window.electronAPI.writeFile(pathParts, filename, base64)
      if (result?.ok && result?.filePath) fileMapUpdates[key] = result.filePath
    }

    if (Object.keys(fileMapUpdates).length > 0) updateSyncFileMap(fileMapUpdates)
  }

  const customerOptions = (customers || []).map((c) => ({ id: c.name, label: c.name }))
  const meetingOptions = (recurringMeetings || []).map((m) => ({ id: m.id, label: m.name, customer: m.customer || '' }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <RefreshCw size={17} className="text-accent shrink-0" />
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">Folder Sync</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Export notes as PDFs to local or cloud-synced folders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Notes are automatically synced as PDFs after each save. Works with any local folder including SharePoint, OneDrive, Dropbox, and other cloud-synced folders — even offline.
          </p>

          {/* Level legend */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {Object.entries(LEVEL_META).map(([level, meta]) => (
              <span key={level} className="flex items-center gap-1.5">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.badge}</span>
                {meta.desc}
              </span>
            ))}
          </div>

          {/* Sync list */}
          {sorted.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
              No syncs configured yet.
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((cfg) => {
                const meta = LEVEL_META[cfg.level] || LEVEL_META.A
                return (
                  <div
                    key={cfg.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${meta.color}`}>
                      {meta.badge}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {cfg.scopeLabel}
                      </p>
                      <p
                        className="text-xs text-gray-400 dark:text-gray-500 truncate"
                        title={cfg.destPath}
                      >
                        {cfg.destPath}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Remove sync for "${cfg.scopeLabel}"?\n\nAlready-synced files will not be deleted.`))
                          deleteSyncConfig(cfg.id)
                      }}
                      className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add sync form */}
          {showAdd ? (
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                New Sync
              </p>

              {/* Level selector */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { level: 'A', label: 'A — All Notes', sub: 'Syncs everything' },
                  { level: 'C', label: 'C — Customer',  sub: 'One customer' },
                  { level: 'M', label: 'M — Meeting',   sub: 'One series' },
                ].map((opt) => (
                  <button
                    key={opt.level}
                    onClick={() => { setAddLevel(opt.level); setAddScopeId(''); setAddScopeCustomer('') }}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      addLevel === opt.level
                        ? 'border-accent bg-accent-light dark:bg-accent-light'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{opt.sub}</p>
                  </button>
                ))}
              </div>

              {addLevel === 'C' && (
                <div>
                  <label className="label text-xs">Customer</label>
                  <select
                    className="input text-xs"
                    value={addScopeId}
                    onChange={(e) => setAddScopeId(e.target.value)}
                  >
                    <option value="">Select customer…</option>
                    {customerOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {addLevel === 'M' && (
                <>
                  <div>
                    <label className="label text-xs">Customer</label>
                    <select
                      className="input text-xs"
                      value={addScopeCustomer}
                      onChange={(e) => { setAddScopeCustomer(e.target.value); setAddScopeId('') }}
                    >
                      <option value="">All customers…</option>
                      {customerOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Meeting Series</label>
                    <select
                      className="input text-xs"
                      value={addScopeId}
                      onChange={(e) => setAddScopeId(e.target.value)}
                    >
                      <option value="">Select meeting series…</option>
                      {meetingOptions
                        .filter((o) => !addScopeCustomer || o.customer === addScopeCustomer)
                        .map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))
                      }
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="label text-xs">Destination Folder</label>
                <div className="flex gap-2">
                  <input
                    className="input text-xs flex-1"
                    value={addDestPath}
                    readOnly
                    placeholder="Click 'Choose Folder' to select…"
                  />
                  <button
                    onClick={handleSelectFolder}
                    className="btn-secondary text-xs flex items-center gap-1.5 px-3 whitespace-nowrap shrink-0"
                  >
                    <Folder size={12} /> Choose Folder
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={addSyncExisting}
                  onChange={(e) => setAddSyncExisting(e.target.checked)}
                  className="rounded accent-accent"
                />
                Sync all existing matching notes now
              </label>

              {addError && (
                <p className="text-xs text-red-500 dark:text-red-400">{addError}</p>
              )}

              <div className="flex gap-2">
                <button onClick={handleAddSync} className="btn-primary text-xs py-1.5 px-4">
                  Add Sync
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddLevel('A'); setAddScopeId(''); setAddScopeCustomer(''); setAddDestPath(''); setAddError(''); setAddSyncExisting(false) }}
                  className="btn-ghost text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowAdd(true); setAddLevel('A'); setAddScopeId(''); setAddScopeCustomer(''); setAddDestPath(''); setAddError(''); setAddSyncExisting(false) }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 dark:text-gray-500 hover:border-accent hover:text-accent transition-colors"
            >
              <Plus size={14} /> Add Sync
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-3">
          {syncing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>Syncing {progress.current} of {progress.total}…</span>
                <button
                  onClick={() => { cancelRef.current = true }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-accent h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {sorted.length > 0 && (
                <button
                  onClick={handleExecuteAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent-light dark:hover:bg-accent-light border border-accent/30 transition-colors"
                >
                  <RefreshCw size={12} /> Execute All Syncs
                </button>
              )}
              {progress.done && (
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  {progress.errors > 0 ? (
                    <><AlertTriangle size={11} className="text-amber-500" /> {progress.errors} error{progress.errors !== 1 ? 's' : ''}</>
                  ) : progress.total === 0 ? (
                    <><Check size={11} className="text-gray-400" /> Nothing to sync</>
                  ) : (
                    <><Check size={11} className="text-green-500" /> All synced</>
                  )}
                </span>
              )}
              <div className="flex-1" />
              <p className="text-xs text-gray-400 dark:text-gray-500">Auto-syncs after each save</p>
              <button onClick={onClose} className="btn-primary text-sm py-1.5 px-4">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
