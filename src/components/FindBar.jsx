import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

export default function FindBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const stateRef = useRef({ hasActive: false })

  const stop = useCallback(() => {
    if (window.electronAPI?.stopFindInPage) {
      window.electronAPI.stopFindInPage()
    }
    stateRef.current.hasActive = false
  }, [])

  const doFind = useCallback((text, forward = true, isNew = false) => {
    if (!text) { stop(); return }
    if (window.electronAPI?.findInPage) {
      const findNext = !isNew && stateRef.current.hasActive
      window.electronAPI.findInPage(text, forward, findNext)
      stateRef.current.hasActive = true
    } else {
      // Web fallback
      window.find(text, false, !forward, true)
    }
  }, [stop])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    stop()
  }, [stop])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
      }
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  // Clean up highlighting when unmounted
  useEffect(() => () => stop(), [stop])

  const handleChange = (val) => {
    setQuery(val)
    doFind(val, true, true)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      doFind(query, !e.shiftKey, false)
    }
    if (e.key === 'Escape') close()
  }

  if (!open) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl px-3 py-2">
      <Search size={14} className="text-gray-400 shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in page…"
        className="w-52 text-sm bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
      />
      <div className="flex items-center gap-0.5 ml-1 border-l border-gray-100 dark:border-gray-700 pl-1.5">
        <button
          onClick={() => doFind(query, false, false)}
          title="Previous (Shift+Enter)"
          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => doFind(query, true, false)}
          title="Next (Enter)"
          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronDown size={14} />
        </button>
        <button
          onClick={close}
          title="Close (Esc)"
          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-0.5"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
