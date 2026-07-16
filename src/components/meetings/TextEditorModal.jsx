import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import RichTextEditor from './sections/RichTextEditor'

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative z-10 m-4 md:m-8 flex-1 flex flex-col dropdown-panel rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/60 dark:border-white/10 glass-pill shrink-0">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {section.label || 'Text Section'}
          </h2>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary text-sm" onClick={handleSave}>Save</button>
            <button onClick={onClose} className="btn-ghost p-1.5 ml-1"><X size={16} /></button>
          </div>
        </div>

        {/* Body: full-screen rich text editor */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Start typing…"
            fillHeight
          />
        </div>
      </div>
    </div>
  )
}
