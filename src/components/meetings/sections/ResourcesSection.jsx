import React from 'react'
import { v4 as uuid } from 'uuid'
import { Plus, Trash2, ExternalLink, Copy } from 'lucide-react'

function emptyResource() {
  return { id: uuid(), label: '', url: '', note: '' }
}

export default function ResourcesSection({ section, onChange }) {
  const items = section.items || []

  const update = (id, key, val) =>
    onChange({ items: items.map((i) => (i.id === id ? { ...i, [key]: val } : i)) })

  const add = () => onChange({ items: [...items, emptyResource()] })

  const remove = (id) => onChange({ items: items.filter((i) => i.id !== id) })

  const openUrl = (url) => {
    if (!url) return
    const href = url.startsWith('http') ? url : `https://${url}`
    window.open(href, '_blank')
  }

  const copyUrl = (url) => {
    if (url) navigator.clipboard?.writeText(url)
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">No resources added yet</p>
      )}

      {items.map((item) => (
        <div key={item.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              className="input text-xs flex-1"
              value={item.label}
              onChange={(e) => update(item.id, 'label', e.target.value)}
              placeholder="Label / Title"
            />
            <button onClick={() => remove(item.id)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 p-0.5 shrink-0">
              <Trash2 size={12} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <input
              className="input text-xs flex-1"
              value={item.url}
              onChange={(e) => update(item.id, 'url', e.target.value)}
              placeholder="https://…"
            />
            {item.url && (
              <>
                <button
                  onClick={() => openUrl(item.url)}
                  className="p-1.5 rounded text-gray-400 hover:text-accent hover:bg-accent-light dark:hover:bg-accent-light transition-colors shrink-0"
                  title="Open link"
                >
                  <ExternalLink size={12} />
                </button>
                <button
                  onClick={() => copyUrl(item.url)}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                  title="Copy URL"
                >
                  <Copy size={12} />
                </button>
              </>
            )}
          </div>

          <input
            className="input text-xs"
            value={item.note}
            onChange={(e) => update(item.id, 'note', e.target.value)}
            placeholder="Note (optional)"
          />
        </div>
      ))}

      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-400 dark:text-gray-500 hover:border-cyan-400 hover:text-cyan-500 transition-colors"
      >
        <Plus size={12} /> Add Resource
      </button>
    </div>
  )
}
