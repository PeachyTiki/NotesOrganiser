import React, { createContext, useContext, useEffect, useState } from 'react'
import { hexToRgb, darkenHex, lightenHex } from '../utils/colorUtils'
import { makeT, getSystemLanguage } from '../utils/i18n'

const STORAGE_KEY = 'notes_organiser_v1'

const DEFAULT_ACCENT_LIGHT = '#ff0000'
const DEFAULT_ACCENT_DARK = '#FF6B6B'

const defaultState = {
  customers: [],
  templates: [],
  recurringMeetings: [],
  meetingNotes: [],
  sectionPresets: [],
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
  },
}

// Normalize data so old versions load without crashing
function migrateState(raw) {
  return {
    ...raw,
    customers: raw.customers || [],
    sectionPresets: raw.sectionPresets || [],
    recurringMeetings: (raw.recurringMeetings || []).map((m) => ({
      schedule: { type: 'none' },  // default first so stored value wins
      ...m,
    })),
    meetingNotes: (raw.meetingNotes || []).map((n) => ({
      ...n,
      // Old notes stored content as a flat string — wrap it
      sections: n.sections || (n.content
        ? [{ id: 'legacy-0', type: 'text', label: '', content: n.content }]
        : []),
    })),
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
    _version: '1',
    _exportedAt: new Date().toISOString(),
    customers: state.customers,
    templates: state.templates,
    recurringMeetings: state.recurringMeetings,
    meetingNotes: state.meetingNotes,
    settings: state.settings,
    darkMode: state.darkMode,
  })

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
