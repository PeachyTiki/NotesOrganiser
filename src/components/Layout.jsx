import React, { useState, useRef } from 'react'
import { Moon, Sun, FileText, Users, BookOpen, Settings } from 'lucide-react'
import { useApp } from '../context/AppContext'
import SettingsModal from './SettingsModal'

const NAV = [
  { id: 'meetings', label: 'Meetings', icon: Users },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'library', label: 'Library', icon: BookOpen },
]

export default function Layout({ children }) {
  const { darkMode, activeSection, update } = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [logoError, setLogoError] = useState(false)

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
            {NAV.map(({ id, label, icon: Icon }) => (
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
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
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
      <footer className="border-t border-gray-100 dark:border-gray-800 py-3 px-4">
        <div className="max-w-7xl mx-auto flex justify-end">
          <a
            href="https://github.com/peachytiki"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          >
            github.com/peachytiki
          </a>
        </div>
      </footer>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
