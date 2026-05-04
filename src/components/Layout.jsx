import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Moon, Sun, FileText, Users, BookOpen, Settings, CheckSquare } from 'lucide-react'
import { useApp } from '../context/AppContext'
import SettingsModal from './SettingsModal'
import FindBar from './FindBar'
import SyncFolderCheckModal from './library/SyncFolderCheckModal'

const BASE_NAV = [
  { id: 'meetings', label: 'Meetings', icon: Users },
  { id: 'library', label: 'Library', icon: BookOpen },
]

export default function Layout({ children }) {
  const { darkMode, activeSection, update, syncConfigs, settings, meetingNotes } = useApp()
  const tasksEnabled = !!settings?.tasksEnabled
  const internalEnabled = !!settings?.internalNotesEnabled

  const overdueCount = useMemo(() => {
    if (!tasksEnabled) return 0
    const today = new Date().toISOString().slice(0, 10)
    let count = 0
    for (const note of meetingNotes || []) {
      if (note.isDraft) continue
      const check = (sections) => {
        for (const s of sections || []) {
          if (s.type !== 'tasks') continue
          for (const i of s.items || []) {
            if (i.endDate && i.endDate < today && i.status !== 'complete') count++
          }
        }
      }
      check(note.sections)
      if (internalEnabled) check(note.internalSections)
    }
    return count
  }, [meetingNotes, tasksEnabled, internalEnabled])

  const NAV = tasksEnabled
    ? [...BASE_NAV.slice(0, 1), { id: 'tasks', label: 'Tasks', icon: CheckSquare, overdue: overdueCount }, ...BASE_NAV.slice(1)]
    : BASE_NAV
  const [showSettings, setShowSettings] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [missingSyncConfigs, setMissingSyncConfigs] = useState([])

  // On launch: check that all configured sync destination folders still exist
  useEffect(() => {
    if (!window.electronAPI?.checkPathsExist) return
    const configs = syncConfigs || []
    if (!configs.length) return
    const paths = [...new Set(configs.map((c) => c.destPath).filter(Boolean))]
    window.electronAPI.checkPathsExist(paths).then((results) => {
      const missing = configs.filter((c) => c.destPath && results[c.destPath] === false)
      if (missing.length > 0) setMissingSyncConfigs(missing)
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!logoError ? (
              <img
                src={darkMode ? './logo-dark.png' : './logo-light.png'}
                alt="Logo"
                className="h-7 w-auto"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-7 h-7 bg-accent rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">N</span>
              </div>
            )}
            <span className="font-semibold text-gray-900 dark:text-white text-sm tracking-tight">
              Notes Organiser
            </span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV.map(({ id, label, icon: Icon, overdue }) => (
              <button
                key={id}
                onClick={() => update({ activeSection: id })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === id
                    ? 'bg-accent-light dark:bg-accent-light text-accent'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={15} />
                {label}
                {overdue > 0 && (
                  <span className="ml-0.5 min-w-[17px] h-[17px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                    {overdue > 99 ? '99+' : overdue}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              onClick={() => update({ activeSection: 'templates' })}
              className={`p-2 rounded-lg transition-colors ${activeSection === 'templates' ? 'bg-accent-light text-accent' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              title="Templates"
            >
              <FileText size={16} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => update({ darkMode: !darkMode })}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Toggle dark mode"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-gray-800 py-2 px-4" />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {missingSyncConfigs.length > 0 && (
        <SyncFolderCheckModal
          missingConfigs={missingSyncConfigs}
          onDone={() => setMissingSyncConfigs([])}
        />
      )}
      <FindBar />
    </div>
  )
}
