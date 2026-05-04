import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Minus } from 'lucide-react'

const FONTS = ['Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana']
const SIZES = [
  { label: 'Tiny',    val: '1' },
  { label: 'Small',   val: '2' },
  { label: 'Normal',  val: '3' },
  { label: 'Medium',  val: '4' },
  { label: 'Large',   val: '5' },
  { label: 'X-Large', val: '6' },
  { label: 'Huge',    val: '7' },
]
const BULLETS = [
  { label: '• Disc',   style: 'disc' },
  { label: '○ Circle', style: 'circle' },
  { label: '▪ Square', style: 'square' },
]

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 120, fillHeight = false }) {
  const editorRef = useRef(null)
  const lastEmittedRef = useRef(null)
  const savedSelRef = useRef(null)
  const [bulletOpen, setBulletOpen] = useState(false)

  // Mount: set initial content only once
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || ''
      lastEmittedRef.current = value || ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external value only when editor is not focused
  useEffect(() => {
    if (!editorRef.current) return
    if (document.activeElement === editorRef.current) return
    if (value === lastEmittedRef.current) return
    editorRef.current.innerHTML = value || ''
    lastEmittedRef.current = value || ''
  }, [value])

  const emitChange = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    if (html === lastEmittedRef.current) return
    lastEmittedRef.current = html
    onChange?.(html)
  }, [onChange])

  const exec = useCallback((cmd, val) => {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, false)
    document.execCommand(cmd, false, val ?? null)
    emitChange()
  }, [emitChange])

  const saveSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) savedSelRef.current = sel.getRangeAt(0).cloneRange()
  }, [])

  const restoreSelection = useCallback(() => {
    if (!savedSelRef.current || !editorRef.current) return
    editorRef.current.focus()
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(savedSelRef.current)
  }, [])

  const applyBullet = useCallback((listStyle) => {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, false)
    document.execCommand('insertUnorderedList', false, null)
    const sel = window.getSelection()
    if (sel?.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'UL') { node.style.listStyleType = listStyle; break }
        node = node.parentNode
      }
    }
    setBulletOpen(false)
    emitChange()
  }, [emitChange])

  const handleKeyDown = useCallback((e) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && !e.shiftKey && e.key === 'b') { e.preventDefault(); exec('bold') }
    else if (mod && !e.shiftKey && e.key === 'i') { e.preventDefault(); exec('italic') }
    else if (mod && !e.shiftKey && e.key === 'u') { e.preventDefault(); exec('underline') }
    else if (mod && e.shiftKey && e.key === '8') { e.preventDefault(); exec('insertUnorderedList') }
    else if (e.key === 'Tab') { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent') }
  }, [exec])

  useEffect(() => {
    if (!bulletOpen) return
    const close = (e) => { if (!e.target.closest('[data-bm]')) setBulletOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [bulletOpen])

  const TBtn = ({ title, onClick, children }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
    >
      {children}
    </button>
  )

  const Sep = () => <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5 self-center shrink-0" />

  return (
    <div className={`border border-gray-200 dark:border-gray-600 rounded-lg flex flex-col${fillHeight ? ' flex-1 min-h-0' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-1.5 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 rounded-t-lg shrink-0">
        <TBtn title="Bold (Ctrl+B)" onClick={() => exec('bold')}><Bold size={13} /></TBtn>
        <TBtn title="Italic (Ctrl+I)" onClick={() => exec('italic')}><Italic size={13} /></TBtn>
        <TBtn title="Underline (Ctrl+U)" onClick={() => exec('underline')}><Underline size={13} /></TBtn>
        <TBtn title="Strikethrough" onClick={() => exec('strikeThrough')}><Strikethrough size={13} /></TBtn>
        <Sep />

        {/* Bullets dropdown */}
        <div className="relative" data-bm="1">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setBulletOpen((v) => !v) }}
            title="Bullet list"
            data-bm="1"
            className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-0.5"
          >
            <List size={13} />
            <span className="text-xs leading-none">▾</span>
          </button>
          {bulletOpen && (
            <div
              data-bm="1"
              className="absolute top-full left-0 mt-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 py-1 min-w-[7rem]"
            >
              {BULLETS.map(({ label, style }) => (
                <button
                  key={style}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); applyBullet(style) }}
                  className="w-full text-left px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <TBtn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={13} /></TBtn>
        <TBtn title="Indent (Tab)" onClick={() => exec('indent')}>
          <span className="text-xs font-mono px-0.5 leading-none">→</span>
        </TBtn>
        <TBtn title="Outdent (Shift+Tab)" onClick={() => exec('outdent')}>
          <span className="text-xs font-mono px-0.5 leading-none">←</span>
        </TBtn>
        <Sep />

        {/* Font family */}
        <select
          onMouseDown={saveSelection}
          onChange={(e) => {
            restoreSelection()
            exec('fontName', e.target.value)
            e.target.value = ''
          }}
          defaultValue=""
          className="text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1 h-6 focus:outline-none cursor-pointer"
        >
          <option value="" disabled>Font…</option>
          {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Font size */}
        <select
          onMouseDown={saveSelection}
          onChange={(e) => {
            restoreSelection()
            exec('fontSize', e.target.value)
            e.target.value = ''
          }}
          defaultValue=""
          className="text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded px-1 h-6 focus:outline-none cursor-pointer"
        >
          <option value="" disabled>Size…</option>
          {SIZES.map(({ label, val }) => <option key={val} value={val}>{label}</option>)}
        </select>

        {/* Text color */}
        <label
          title="Text color"
          className="flex items-center gap-0.5 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 leading-none">A</span>
          <input
            type="color"
            defaultValue="#000000"
            onMouseDown={saveSelection}
            onChange={(e) => {
              restoreSelection()
              document.execCommand('styleWithCSS', false, false)
              document.execCommand('foreColor', false, e.target.value)
              emitChange()
            }}
            className="w-4 h-4 cursor-pointer border-0 p-0 rounded"
            style={{ WebkitAppearance: 'none', appearance: 'none' }}
          />
        </label>

        <Sep />
        <TBtn title="Remove formatting" onClick={() => exec('removeFormat')}><Minus size={13} /></TBtn>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder || 'Start typing…'}
        className={`rich-editor p-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none overflow-y-auto rounded-b-lg${fillHeight ? ' flex-1' : ''}`}
        style={fillHeight ? { lineHeight: 1.65 } : { minHeight, lineHeight: 1.65 }}
      />
    </div>
  )
}
