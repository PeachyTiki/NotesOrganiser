import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { applyAccentVars } from '../utils/colorUtils'
import { makeT, getSystemLanguage } from '../utils/i18n'
import { renderNoteToPdfBuffer, arrayBufferToBase64 } from '../utils/export'
import { isBackupDue, scheduledBackupFilename } from '../utils/backupSchedule'
import { noteMatchesSync, noteFilename, notePathParts, syncFileKey } from '../utils/syncManager'

const STORAGE_KEY = 'notes_organiser_v1'

const DEFAULT_ACCENT_LIGHT = '#ff0000'
const DEFAULT_ACCENT_DARK = '#FF6B6B'

const defaultState = {
  customers: [],
  templates: [],
  templateFolders: [],
  recurringMeetings: [],
  meetingNotes: [],
  standaloneTasks: [],
  sectionPresets: [],
  syncConfigs: [],
  syncFileMap: {},
  darkMode: false,
  activeSection: 'meetings',
  pendingOpenNoteId: null,
  settings: {
    yourName: '',
    yourFirm: '',
    yourRole: '',
    language: '',
    accentLight: DEFAULT_ACCENT_LIGHT,
    accentDark: DEFAULT_ACCENT_DARK,
    exportFormat: 'pdf',
    aiTone: { formality: 'professional', conciseness: 'balanced', customInstructions: '' },
    notesContextDepth: 4,
    internalNotesEnabled: false,
    tasksEnabled: false,
    taskNotifications: {
      enabled: false, mode: 'interval', frequencyMinutes: 60,
      dailyTime: '09:00', weeklyDay: 1, weeklyTime: '09:00',
    },
    aiPromptMode: 'clipboard',
    enableClaudeAutoOpen: false,
    defaultTemplateId: '',
    autoBackupFolder: '',
    scheduledBackup: { enabled: false, folder: '', frequency: 'weekly', lastRunAt: '' },
  },
}

// Normalize data so old versions load without crashing
function migrateState(raw) {
  const migratedCustomers = (raw.customers || []).map((c) => ({
    type: 'customer',
    emoji: '',
    parentId: null,
    customerSettings: {},
    ...c,
    mailingList: {
      people: (c.mailingList?.people || []).map((p) => ({
        email: '',
        phone: '',
        managerId: '',
        position: '',
        ...p,
      })),
      groups: c.mailingList?.groups || [],
    },
  }))

  // Build a name->id map for legacy meeting migration
  const customerIdByName = {}
  migratedCustomers.forEach((c) => { customerIdByName[c.name.toLowerCase()] = c.id })

  return {
    ...raw,
    customers: migratedCustomers,
    templates: (raw.templates || []).map((tpl) => ({ folderId: null, ...tpl })),
    templateFolders: raw.templateFolders || [],
    standaloneTasks: raw.standaloneTasks || [],
    sectionPresets: raw.sectionPresets || [],
    syncConfigs: raw.syncConfigs || [],
    syncFileMap: raw.syncFileMap || {},
    recurringMeetings: (raw.recurringMeetings || []).map((m) => {
      const customerId = m.customerId == null
        ? (customerIdByName[m.customer?.toLowerCase()] ?? '')
        : m.customerId
      return {
        schedule: { type: 'none' },  // default first so stored value wins
        ...m,
        customerId,
      }
    }),
    meetingNotes: (raw.meetingNotes || []).map((n) => {
      const migrateSection = (s) =>
        s.type === 'actionItems'
          ? {
              ...s,
              type: 'tasks',
              items: (s.items || []).map((i) => ({
                id: i.id,
                text: i.task || '',
                assignee: i.assignee || '',
                status: i.status === 'done' ? 'complete' : i.status === 'inProgress' ? 'inProgress' : 'planned',
                startDate: '',
                endDate: i.dueDate || '',
                createdAt: i.createdAt || new Date().toISOString(),
              })),
            }
          : s
      return {
        ...n,
        sections: n.sections
          ? n.sections.map(migrateSection)
          : n.content
          ? [{ id: 'legacy-0', type: 'text', label: '', content: n.content }]
          : [],
        internalSections: (n.internalSections || []).map(migrateSection),
      }
    }),
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const saved = JSON.parse(raw)
    return migrateState({
      ...defaultState,
      ...saved,
      settings: { ...defaultState.settings, ...(saved.settings || {}) },
    })
  } catch {
    return defaultState
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setState] = useState(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [state.darkMode])

  useEffect(() => {
    const hex = state.darkMode
      ? (state.settings.accentDark || DEFAULT_ACCENT_DARK)
      : (state.settings.accentLight || DEFAULT_ACCENT_LIGHT)
    applyAccentVars(hex, state.darkMode)
  }, [state.darkMode, state.settings.accentLight, state.settings.accentDark])

  // Mirror the full app state out to the main process so any open floating
  // windows (task widget, note preview) can stay in sync without their own
  // localStorage copy.
  useEffect(() => {
    window.electronAPI?.broadcastWidgetState?.(state)
  }, [state])

  const update = (patch) => setState((s) => ({ ...s, ...patch }))

  // Lets a screen with unsaved edits (e.g. the note editor) intercept in-app
  // navigation and prompt to save/discard before the underlying view unmounts.
  const navGuardRef = useRef(null)
  const registerNavGuard = (fn) => { navGuardRef.current = fn }
  const guardedUpdate = (patch) => {
    if (navGuardRef.current) { navGuardRef.current(() => update(patch)); return }
    update(patch)
  }

  const saveTemplate = (tpl) => {
    setState((s) => {
      const exists = s.templates.find((t) => t.id === tpl.id)
      return {
        ...s,
        templates: exists
          ? s.templates.map((t) => (t.id === tpl.id ? tpl : t))
          : [...s.templates, tpl],
      }
    })
  }
  const deleteTemplate = (id) =>
    setState((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }))

  const saveTemplateFolder = (folder) => {
    setState((s) => {
      const folders = s.templateFolders || []
      const exists = folders.find((f) => f.id === folder.id)
      return {
        ...s,
        templateFolders: exists
          ? folders.map((f) => (f.id === folder.id ? folder : f))
          : [...folders, folder],
      }
    })
  }

  // Deleting a folder never deletes its contents — any subfolders it holds,
  // and every template filed directly in it or its subfolders, moves back to
  // unfiled (folderId/parentId: null) rather than being destroyed.
  const deleteTemplateFolder = (id) =>
    setState((s) => {
      const folders = s.templateFolders || []
      const subIds = folders.filter((f) => f.parentId === id).map((f) => f.id)
      const removedIds = new Set([id, ...subIds])
      return {
        ...s,
        templateFolders: folders.filter((f) => !removedIds.has(f.id)),
        templates: s.templates.map((t) => (removedIds.has(t.folderId) ? { ...t, folderId: null } : t)),
      }
    })

  const saveRecurringMeeting = (mtg) => {
    setState((s) => {
      const exists = s.recurringMeetings.find((m) => m.id === mtg.id)
      return {
        ...s,
        recurringMeetings: exists
          ? s.recurringMeetings.map((m) => (m.id === mtg.id ? mtg : m))
          : [...s.recurringMeetings, mtg],
      }
    })
  }
  const deleteRecurringMeeting = (id) =>
    setState((s) => ({
      ...s,
      recurringMeetings: s.recurringMeetings.filter((m) => m.id !== id),
    }))

  const saveCustomer = (cust) => {
    setState((s) => {
      const exists = s.customers.find((c) => c.id === cust.id)
      return {
        ...s,
        customers: exists
          ? s.customers.map((c) => (c.id === cust.id ? cust : c))
          : [...s.customers, cust],
      }
    })
  }
  const deleteCustomer = (id) =>
    setState((s) => ({ ...s, customers: s.customers.filter((c) => c.id !== id) }))

  const saveSectionPreset = (preset) =>
    setState((s) => {
      const exists = s.sectionPresets.find((p) => p.id === preset.id)
      return {
        ...s,
        sectionPresets: exists
          ? s.sectionPresets.map((p) => (p.id === preset.id ? preset : p))
          : [...s.sectionPresets, preset],
      }
    })
  const deleteSectionPreset = (id) =>
    setState((s) => ({ ...s, sectionPresets: s.sectionPresets.filter((p) => p.id !== id) }))

  const saveMeetingNote = (note) => {
    setState((s) => {
      const exists = s.meetingNotes.find((n) => n.id === note.id)
      return {
        ...s,
        meetingNotes: exists
          ? s.meetingNotes.map((n) => (n.id === note.id ? note : n))
          : [...s.meetingNotes, note],
      }
    })
  }
  const deleteMeetingNote = (id) =>
    setState((s) => {
      const cleanedFileMap = Object.fromEntries(
        Object.entries(s.syncFileMap || {}).filter(([key]) => !key.startsWith(`${id}|`))
      )
      return {
        ...s,
        meetingNotes: s.meetingNotes.filter((n) => n.id !== id),
        syncFileMap: cleanedFileMap,
      }
    })

  const saveSyncConfig = (cfg) =>
    setState((s) => {
      const exists = s.syncConfigs.find((c) => c.id === cfg.id)
      return {
        ...s,
        syncConfigs: exists
          ? s.syncConfigs.map((c) => (c.id === cfg.id ? cfg : c))
          : [...s.syncConfigs, cfg],
      }
    })

  const deleteSyncConfig = (id) =>
    setState((s) => ({ ...s, syncConfigs: s.syncConfigs.filter((c) => c.id !== id) }))

  const updateSyncFileMap = (updates) =>
    setState((s) => ({ ...s, syncFileMap: { ...(s.syncFileMap || {}), ...updates } }))

  const saveStandaloneTask = (task) =>
    setState((s) => {
      const exists = (s.standaloneTasks || []).find((t) => t.id === task.id)
      return {
        ...s,
        standaloneTasks: exists
          ? s.standaloneTasks.map((t) => (t.id === task.id ? task : t))
          : [...(s.standaloneTasks || []), task],
      }
    })

  const deleteStandaloneTask = (id) =>
    setState((s) => ({ ...s, standaloneTasks: (s.standaloneTasks || []).filter((t) => t.id !== id) }))

  // Shared by the Tasks page and by the floating task widget (relayed
  // through the main process, since the widget window has no state of its own).
  const setTaskStatus = (task, newStatus) => {
    if (task.isStandalone) {
      const existing = (state.standaloneTasks || []).find((t) => t.id === task.id)
      if (existing) saveStandaloneTask({ ...existing, status: newStatus, updatedAt: new Date().toISOString() })
      return
    }
    const note = state.meetingNotes.find((n) => n.id === task.noteId)
    if (!note) return
    const updateSections = (sections) =>
      (sections || []).map((sec) => {
        if (sec.id !== task.sectionId) return sec
        return { ...sec, items: (sec.items || []).map((i) => (i.id === task.id ? { ...i, status: newStatus } : i)) }
      })
    const updated = {
      ...note,
      sections: updateSections(note.sections),
      internalSections: updateSections(note.internalSections),
      updatedAt: new Date().toISOString(),
    }
    saveMeetingNote(updated)
    triggerNoteSync(updated)
  }

  // Always call the latest setTaskStatus even though this effect subscribes once.
  const setTaskStatusRef = useRef(setTaskStatus)
  setTaskStatusRef.current = setTaskStatus
  useEffect(() => {
    if (!window.electronAPI?.onWidgetTaskAction) return
    return window.electronAPI.onWidgetTaskAction((action) => {
      if (action?.type === 'setStatus' && action.task) {
        setTaskStatusRef.current(action.task, action.status)
      }
    })
  }, [])

  // Wipe everything and reset to defaults
  const clearAllData = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    setState(defaultState)
  }

  // Replace state from a backup object
  const restoreFromBackup = (data) => {
    try {
      const restored = migrateState({
        ...defaultState,
        ...data,
        settings: { ...defaultState.settings, ...(data.settings || {}) },
        // Preserve dark mode from current session unless backup has it
        darkMode: data.darkMode ?? state.darkMode,
      })
      setState(restored)
      return true
    } catch {
      return false
    }
  }

  // Produce a full backup object (caller downloads it)
  const createBackup = () => ({
    _app: 'NotesOrganiser',
    _version: '2',
    _exportedAt: new Date().toISOString(),
    customers: state.customers,
    templates: state.templates,
    templateFolders: state.templateFolders || [],
    recurringMeetings: state.recurringMeetings,
    meetingNotes: state.meetingNotes,
    standaloneTasks: state.standaloneTasks || [],
    sectionPresets: state.sectionPresets,
    settings: state.settings,
    darkMode: state.darkMode,
  })

  // Silent daily safety-net backup, written to Documents (never touched by an
  // installer/uninstaller, unlike the app's own userData folder localStorage
  // lives in). Protects against total data loss from anything outside the
  // app's control, not just user error — see the deleteAppDataOnUninstall
  // fix in package.json for the specific incident this responds to.
  const createBackupRef = useRef(createBackup)
  createBackupRef.current = createBackup
  // User-chosen destination for the (separate, opt-in) single-file daily
  // backup below — kept in a ref so changing it in Settings doesn't restart
  // this effect's timers.
  const autoBackupFolderRef = useRef(state.settings.autoBackupFolder)
  autoBackupFolderRef.current = state.settings.autoBackupFolder
  useEffect(() => {
    if (!window.electronAPI?.saveAutoBackup) return
    const run = () => {
      try {
        window.electronAPI.saveAutoBackup(JSON.stringify(createBackupRef.current())).catch(() => {})
      } catch {}
      // User-configured folder (Settings → Automatic Daily Backup): a single
      // file, overwritten every time — unlike the dated/retained safety-net
      // backup above, this is meant as a live, always-current copy at a
      // location of the user's choosing (e.g. a synced/cloud folder).
      const folder = autoBackupFolderRef.current
      if (folder && window.electronAPI?.writeFile) {
        try {
          const bytes = new TextEncoder().encode(JSON.stringify(createBackupRef.current()))
          const base64 = arrayBufferToBase64(bytes.buffer)
          window.electronAPI.writeFile([folder], 'notes_organiser_auto_backup.json', base64).catch(() => {})
        } catch {}
      }
    }
    const timeout = setTimeout(run, 10_000) // shortly after launch, not blocking startup
    const interval = setInterval(run, 24 * 60 * 60 * 1000)
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [])

  // User-configured scheduled full backup (Settings → Scheduled Full Backup).
  // Writes a complete, dated JSON snapshot of everything (notes, tasks,
  // customers, templates incl. logos, settings) to a chosen folder at 12:00
  // local time, at the chosen cadence (daily/weekly/monthly). If the app wasn't
  // running at noon it catches up the next time it's open — cadence and
  // catch-up logic live in backupSchedule.js. Kept in a ref so editing the
  // config in Settings doesn't restart the timers.
  const scheduledBackupRef = useRef(state.settings.scheduledBackup)
  scheduledBackupRef.current = state.settings.scheduledBackup
  useEffect(() => {
    if (!window.electronAPI?.writeFile) return
    let cancelled = false
    const run = async () => {
      const cfg = scheduledBackupRef.current
      if (!cfg?.enabled || !cfg.folder) return
      if (!isBackupDue(cfg.frequency, cfg.lastRunAt)) return
      try {
        const bytes = new TextEncoder().encode(JSON.stringify(createBackupRef.current()))
        const base64 = arrayBufferToBase64(bytes.buffer)
        const result = await window.electronAPI.writeFile([cfg.folder], scheduledBackupFilename(), base64)
        if (!cancelled && result?.ok) {
          setState((s) => ({
            ...s,
            settings: {
              ...s.settings,
              scheduledBackup: { ...(s.settings.scheduledBackup || {}), lastRunAt: new Date().toISOString() },
            },
          }))
        }
      } catch {
        // best-effort — will retry on the next tick
      }
    }
    const timeout = setTimeout(run, 12_000) // shortly after launch
    const interval = setInterval(run, 15 * 60 * 1000) // catch the noon crossing while the app stays open
    return () => { cancelled = true; clearTimeout(timeout); clearInterval(interval) }
  }, [])

  const triggerNoteSync = (note) => {
    if (!window.electronAPI) return
    const configs = state.syncConfigs || []
    const fileMap = state.syncFileMap || {}
    const recurringMeetings = state.recurringMeetings || []
    const templates = state.templates || []
    const settings = state.settings || {}
    const matchingConfigs = configs.filter((cfg) => noteMatchesSync(note, cfg))
    if (!matchingConfigs.length) return
    const resolvedTemplate = templates.find((tpl) => tpl.id === note.templateId) || null
    const resolvedInternalTemplate = templates.find((tpl) => tpl.id === note.internalTemplateId) || null
    const internalActive = settings.internalNotesEnabled && !!note.modes?.internal
    const exportT = makeT(note.language)
    ;(async () => {
      try {
        const fileMapUpdates = {}
        const syncNote = async (noteForSync, template, isInternal) => {
          const buf = await renderNoteToPdfBuffer(noteForSync, template, exportT)
          const base64 = arrayBufferToBase64(buf)
          const filename = noteFilename(note, isInternal)
          for (const cfg of matchingConfigs) {
            const key = syncFileKey(note.id, cfg.id, isInternal)
            const oldPath = fileMap[key]
            if (oldPath) await window.electronAPI.deleteFile(oldPath).catch(() => {})
            const pathParts = notePathParts(note, cfg, recurringMeetings)
            const result = await window.electronAPI.writeFile(pathParts, filename, base64)
            if (result?.ok && result?.filePath) fileMapUpdates[key] = result.filePath
          }
        }
        await syncNote({ ...note, sections: note.sections || [] }, resolvedTemplate, false)
        if (internalActive && (note.internalSections || []).length > 0) {
          await syncNote({ ...note, sections: note.internalSections || [] }, resolvedInternalTemplate, true)
        }
        if (Object.keys(fileMapUpdates).length > 0) updateSyncFileMap(fileMapUpdates)
      } catch (err) {
        console.error('[auto-sync] error', err)
      }
    })()
  }

  const t = makeT(state.settings.language || getSystemLanguage())

  return (
    <AppContext.Provider
      value={{
        ...state,
        update,
        guardedUpdate,
        registerNavGuard,
        saveCustomer,
        deleteCustomer,
        saveTemplate,
        deleteTemplate,
        saveTemplateFolder,
        deleteTemplateFolder,
        saveRecurringMeeting,
        deleteRecurringMeeting,
        saveMeetingNote,
        deleteMeetingNote,
        clearAllData,
        restoreFromBackup,
        createBackup,
        saveSectionPreset,
        deleteSectionPreset,
        saveStandaloneTask,
        deleteStandaloneTask,
        setTaskStatus,
        saveSyncConfig,
        deleteSyncConfig,
        updateSyncFileMap,
        triggerNoteSync,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
