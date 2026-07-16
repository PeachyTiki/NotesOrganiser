import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { applyAccentVars } from '../utils/colorUtils'
import { makeT, getSystemLanguage } from '../utils/i18n'
import { renderNoteToPdfBuffer, arrayBufferToBase64 } from '../utils/export'
import { noteMatchesSync, noteFilename, notePathParts, syncFileKey } from '../utils/syncManager'

const STORAGE_KEY = 'notes_organiser_v1'

const DEFAULT_ACCENT_LIGHT = '#ff0000'
const DEFAULT_ACCENT_DARK = '#FF6B6B'

const defaultState = {
  customers: [],
  templates: [],
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
    taskNotifications: { enabled: false, frequencyMinutes: 60 },
    aiPromptMode: 'download',
    defaultTemplateId: '',
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
    recurringMeetings: state.recurringMeetings,
    meetingNotes: state.meetingNotes,
    standaloneTasks: state.standaloneTasks || [],
    sectionPresets: state.sectionPresets,
    settings: state.settings,
    darkMode: state.darkMode,
  })

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
