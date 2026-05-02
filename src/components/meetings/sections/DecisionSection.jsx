import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'

export default function DecisionSection({ section, onChange }) {
  const items = section.items || []

  const add = () =>
    onChange({ items: [...items, { id: uuid(), decision: '', rationale: '', owner: '', date: '' }] })

  const update = (id, key, val) =>
    onChange({ items: items.map((i) => (i.id === id ? { ...i, [key]: val } : i)) })

  const remove = (id) => onChange({ items: items.filter((i) => i.id !== id) })

  return (
    <div>
      <div className="grid gap-2 mb-1.5 px-1" style={{ gridTemplateColumns: '2fr 2fr 1fr 100px 32px' }}>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Decision</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Rationale</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Owner</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Date</span>
        <span />
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 2fr 1fr 100px 32px' }}>
            <input
              className="input text-sm"
              value={item.decision}
              onChange={(e) => update(item.id, 'decision', e.target.value)}
              placeholder="Decision made…"
            />
            <input
              className="input text-sm"
              value={item.rationale}
              onChange={(e) => update(item.id, 'rationale', e.target.value)}
              placeholder="Why?"
            />
            <input
              className="input text-sm"
              value={item.owner}
              onChange={(e) => update(item.id, 'owner', e.target.value)}
              placeholder="Owner"
            />
            <input
              type="date"
              className="input text-sm"
              value={item.date}
              onChange={(e) => update(item.id, 'date', e.target.value)}
            />
            <button
              onClick={() => remove(item.id)}
              className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors p-1"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">No decisions logged yet</p>
      )}
      <button
        className="mt-3 text-sm text-accent hover:text-accent-dark flex items-center gap-1.5 font-medium"
        onClick={add}
      >
        <Plus size={14} /> Add Decision
      </button>
    </div>
  )
}
