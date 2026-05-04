import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Brain, BookMarked } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { buildMasterNotesContextAIPrompt } from '../utils/aiPrompt'
import { downloadBlob } from '../utils/export'
import RichTextEditor from './meetings/sections/RichTextEditor'

function slug(str) {
  return str.replace(/[^a-z0-9]+/gi, '_').slice(0, 40)
}

export default function MasterNotesModal({ customer, customerNotes, onClose }) {
  const { saveCustomer, settings, t } = useApp()
  const internalNotesEnabled = !!settings?.internalNotesEnabled

  const [activeTab, setActiveTab] = useState('standard')
  const [standard, setStandard] = useState(customer.masterNotes?.standard || '')
  const [internal, setInternal] = useState(customer.masterNotes?.internal || '')

  const latestRef = useRef({ standard, internal })
  const autoSaveTimerRef = useRef(null)
  const customerRef = useRef(customer)

  useEffect(() => { latestRef.current = { standard, internal } }, [standard, internal])
  useEffect(() => { customerRef.current = customer }, [customer])

  const doSave = useCallback(() => {
    saveCustomer({
      ...customerRef.current,
      masterNotes: { standard: latestRef.current.standard, internal: latestRef.current.internal },
    })
  }, [saveCustomer])

  const scheduleSave = useCallback(() => {
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(doSave, 800)
  }, [doSave])

  useEffect(() => {
    return () => {
      clearTimeout(autoSaveTimerRef.current)
      doSave()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportAIContext = () => {
    const updatedCustomer = { ...customer, masterNotes: { standard, internal } }
    const prompt = buildMasterNotesContextAIPrompt(updatedCustomer, customerNotes || [], settings)
    const blob = new Blob([JSON.stringify(prompt, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `master_notes_context_${slug(customer.name)}_${new Date().toISOString().slice(0, 10)}.json`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <BookMarked size={18} className="text-accent shrink-0" />
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white text-sm">{t('masterNotes')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{customer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAIContext}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
              title="Export AI context — master notes + recent meetings as background"
            >
              <Brain size={13} /> AI Context
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs (only when internal notes enabled) */}
        {internalNotesEnabled && (
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-5 shrink-0">
            {['standard', 'internal'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab === 'standard' ? 'Standard' : 'Internal'}
              </button>
            ))}
          </div>
        )}

        {/* Editor area */}
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {(!internalNotesEnabled || activeTab === 'standard') && (
            <RichTextEditor
              value={standard}
              onChange={(html) => { setStandard(html); scheduleSave() }}
              placeholder="Add persistent notes about this customer — relationship context, goals, key contacts, ongoing topics…"
              minHeight={400}
            />
          )}
          {internalNotesEnabled && activeTab === 'internal' && (
            <RichTextEditor
              value={internal}
              onChange={(html) => { setInternal(html); scheduleSave() }}
              placeholder="Internal notes (not included in standard exports)…"
              minHeight={400}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">Auto-saved as you type</p>
          <button
            onClick={onClose}
            className="btn-primary text-sm py-1.5 px-4"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
