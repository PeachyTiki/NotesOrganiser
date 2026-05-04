import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function TextEditorModal({ section, onSave, onClose }) {
  const [content, setContent] = useState(section.content || '')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => {
    onSave(content)
    onClose()
  }

  const lines = content.split('\n')
  const preview = lines.map((line, i) => {
    if (line.startsWith('## '))
      return <div key={i} style={{ fontWeight: 700, fontSize: 14, color: '#ff0000', marginTop: 10, marginBottom: 4 }}>{line.slice(3)}</div>
    if (line.startsWith('# '))
      return <div key={i} style={{ fontWeight: 700, fontSize: 17, color: '#0F172A', marginTop: 14, marginBottom: 6 }}>{line.slice(2)}</div>
    if (line.startsWith('- [ ] '))
      return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3, color: '#374151' }}><span>☐</span><span>{line.slice(6)}</span></div>
    if (/^- \[[xX]\] /.test(line))
      return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3, color: '#94A3B8', textDecoration: 'line-through' }}><span>☑</span><span>{line.slice(6)}</span></div>
    if (line.startsWith('- '))
      return <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3, color: '#374151' }}><span style={{ color: '#ff0000', fontWeight: 700 }}>•</span><span>{line.slice(2)}</span></div>
    if (line === '') return <div key={i} style={{ height: 8 }} />
    return <div key={i} style={{ color: '#374151', marginBottom: 2, fontSize: 13 }}>{line}</div>
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 m-4 md:m-8 flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {section.label || 'Text Section'}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">#</code> headings,{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">-</code> bullets,{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">- [ ]</code> action items
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary text-sm" onClick={handleSave}>Save</button>
            <button onClick={onClose} className="btn-ghost p-1.5 ml-1"><X size={16} /></button>
          </div>
        </div>

        {/* Body: editor | preview */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Editor */}
          <div className="flex-1 flex flex-col border-r border-gray-100 dark:border-gray-800 min-w-0">
            <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Edit</span>
            </div>
            <textarea
              className="flex-1 w-full p-5 resize-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm leading-relaxed focus:outline-none font-mono"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write notes here…\n\n# Heading\n## Sub-heading\n- Bullet point\n- [ ] Action item`}
              autoFocus
            />
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Preview</span>
            </div>
            <div className="flex-1 overflow-y-auto p-5 bg-white dark:bg-gray-900">
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.65 }}>
                {preview}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
