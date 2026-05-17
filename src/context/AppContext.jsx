import React, { createContext, useContext, useEffect, useState } from 'react'
import { hexToRgb, darkenHex, lightenHex } from '../utils/colorUtils'
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
  sectionPresets: [],
  syncConfigs: [],
  syncFileMap: {},
  darkMode: false,
  activeSection: 'meetings',
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
    aiPromptMode: 'download',
  },
}

// Normalize data so old versions load without crashing
function migrateState(raw) {
  const migratedCustomers = (raw.customers || []).map((c) => ({
    type: 'customer',
    emoji: '',
    parentId: null,
    ...c,
  }))

  // Build a name->id map for legacy meeting migration
  const customerIdByName = {}
  migratedCustomers.forEach((c) => { customerIdByName[c.name.toLowerCase()] = c.id })

  return {
    ...raw,
    customers: migratedCustomers,
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

function applyAccentVars(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return
  const [r, g, b] = rgb
  const dark = hexToRgb(darkenHex(hex, 0.2))
  const light = hexToRgb(lightenHex(hex, 0.88))
  const muted = hexToRgb(lightenHex(hex, 0.35))
  const el = document.documentElement
  el.style.setProperty('--accent', hex)
  el.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
  if (dark) {
    el.style.setProperty('--accent-dark', darkenHex(hex, 0.2))
    el.style.setProperty('--accent-dark-rgb', `${dark[0]}, ${dark[1]}, ${dark[2]}`)
  }
  if (light) {
    el.style.setProperty('--accent-light', lightenHex(hex, 0.88))
    el.style.setProperty('--accent-light-rgb', `${light[0]}, ${light[1]}, ${light[2]}`)
  }
  if (muted) {
    el.style.setProperty('--accent-muted', lightenHex(hex, 0.35))
    el.style.setProperty('--accent-muted-rgb', `${muted[0]}, ${muted[1]}, ${muted[2]}`)
  }
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
    applyAccentVars(hex)
  }, [state.darkMode, state.settings.accentLight, state.settings.accentDark])

  const update = (patch) => setState((s) => ({ ...s, ...patch }))

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
    setState((s) => ({ ...s, meetingNotes: s.meetingNotes.filter((n) => n.id !== id) }))

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
