import React, { useState, useEffect } from 'react'
import { AlertTriangle, X, Folder, Trash2, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const LEVEL_META = {
  A: { badge: 'A', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  C: { badge: 'C', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  M: { badge: 'M', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
}

export default function SyncFolderCheckModal({ missingConfigs, onDone }) {
  const { saveSyncConfig, deleteSyncConfig, syncFileMap, updateSyncFileMap } = useApp()

  const [rowState, setRowState] = useState(() =>
    Object.fromEntries(missingConfigs.map((c) => [c.id, { newPath: '', moving: false, error: '' }]))
  )
  const [dismissed, setDismissed] = useState(new Set())

  const setRow = (id, patch) => setRowState((p) => ({ ...p, [id]: { ...p[id], ...patch } }))
  const dismiss = (id) => setDismissed((p) => new Set([...p, id]))

  const activeConfigs = missingConfigs.filter((c) => !dismissed.has(c.id))

  useEffect(() => {
    if (missingConfigs.length > 0 && activeConfigs.length === 0) onDone()
  }, [dismissed]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChoose = async (id) => {
    if (!window.electronAPI?.selectFolder) return
    const folder = await window.electronAPI.selectFolder()
    if (folder) setRow(id, { newPath: folder, error: '' })
  }

  const keysForConfig = (cfgId) =>
    Object.keys(syncFileMap || {}).filter((k) => k.includes(`|${cfgId}|`))

  const trackedPathsForConfig = (cfgId) =>
    keysForConfig(cfgId).map((k) => syncFileMap[k]).filter(Boolean)

  const handleUpdate = (cfg) => {
    const { newPath } = rowState[cfg.id]
    if (!newPath) { setRow(cfg.id, { error: 'Please select a folder first.' }); return }
    saveSyncConfig({ ...cfg, destPath: newPath })
    // Null out stale file map entries — old folder is gone so references are dead
    const stale = keysForConfig(cfg.id)
    if (stale.length) updateSyncFileMap(Object.fromEntries(stale.map((k) => [k, null])))
    dismiss(cfg.id)
  }

  const handleMoveAndUpdate = async (cfg) => {
    const { newPath } = rowState[cfg.id]
    if (!newPath) { setRow(cfg.id, { error: 'Please select a folder first.' }); return }
    const trackedPaths = trackedPathsForConfig(cfg.id)
    setRow(cfg.id, { moving: true, error: '' })
    try {
      if (trackedPaths.length > 0 && window.electronAPI?.moveSyncFolder) {
        const results = await window.electronAPI.moveSyncFolder(cfg.destPath, newPath, trackedPaths)
        const fileMapUpdates = {}
        for (const r of (results || [])) {
          if (r.ok && r.newPath) {
            const entry = Object.entries(syncFileMap || {}).find(([, v]) => v === r.oldPath)
            if (entry) fileMapUpdates[entry[0]] = r.newPath
          }
        }
        // Null out any entries that couldn't be moved
        for (const k of keysForConfig(cfg.id)) {
          if (!(k in fileMapUpdates)) fileMapUpdates[k] = null
        }
        updateSyncFileMap(fileMapUpdates)
      } else {
        const stale = keysForConfig(cfg.id)
        if (stale.length) updateSyncFileMap(Object.fromEntries(stale.map((k) => [k, null])))
      }
      saveSyncConfig({ ...cfg, destPath: newPath })
      dismiss(cfg.id)
    } catch {
      setRow(cfg.id, { moving: false, error: 'Move failed — folder path has been updated.' })
      saveSyncConfig({ ...cfg, destPath: newPath })
      dismiss(cfg.id)
    }
  }

  const handleRemove = (cfg) => {
    deleteSyncConfig(cfg.id)
    const stale = keysForConfig(cfg.id)
    if (stale.length) updateSyncFileMap(Object.fromEntries(stale.map((k) => [k, null])))
    dismiss(cfg.id)
  }

  if (activeConfigs.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={17} className="text-amber-500 shrink-0" />
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">Sync Folder Not Found</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activeConfigs.length === 1
                  ? '1 sync folder is missing'
                  : `${activeConfigs.length} sync folders are missing`}
              </p>
            </div>
          </div>
          <button
            onClick={onDone}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            The following sync destinations could not be found. They may have been deleted, renamed, or are on a disconnected drive. Select a new folder to continue syncing, or remove the configuration.
          </p>

          {activeConfigs.map((cfg) => {
            const meta = LEVEL_META[cfg.level] || LEVEL_META.A
            const st = rowState[cfg.id] || {}
            const tracked = trackedPathsForConfig(cfg.id)

            return (
              <div
                key={cfg.id}
                className="border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 space-y-3 bg-amber-50/40 dark:bg-amber-950/20"
              >
                {/* Config identity */}
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${meta.color}`}>
                    {meta.badge}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cfg.scopeLabel}</p>
                    <p
                      className="text-xs text-red-500 dark:text-red-400 font-mono truncate mt-0.5"
                      title={cfg.destPath}
                    >
                      {cfg.destPath}
                    </p>
                  </div>
                </div>

                {/* Folder picker */}
                <div className="flex gap-2">
                  <input
                    className="input text-xs flex-1"
                    value={st.newPath || ''}
                    readOnly
                    placeholder="Select a new destination folder…"
                  />
                  <button
                    onClick={() => handleChoose(cfg.id)}
                    disabled={st.moving}
                    className="btn-secondary text-xs flex items-center gap-1.5 px-3 whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Folder size={12} /> Choose
                  </button>
                </div>

                {st.error && (
                  <p className="text-xs text-red-500 dark:text-red-400">{st.error}</p>
                )}

                {st.newPath && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleMoveAndUpdate(cfg)}
                      disabled={st.moving}
                      className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={st.moving ? 'animate-spin' : ''} />
                      {st.moving
                        ? 'Moving…'
                        : tracked.length > 0
                          ? `Move ${tracked.length} File${tracked.length !== 1 ? 's' : ''} & Update`
                          : 'Update Folder'}
                    </button>
                    {tracked.length > 0 && (
                      <button
                        onClick={() => handleUpdate(cfg)}
                        disabled={st.moving}
                        className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
                      >
                        Just Update
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handleRemove(cfg)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                >
                  <Trash2 size={11} /> Remove this sync
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0 flex justify-end">
          <button onClick={onDone} className="btn-ghost text-sm py-1.5 px-4">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
