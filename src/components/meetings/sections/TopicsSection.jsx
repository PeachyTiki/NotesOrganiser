import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'

const STATUS_STYLES = {
  new: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  open: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  inProgress: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  complete: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300',
}

export default function TopicsSection({ section, onChange, t }) {
  const items = section.items || []

  const addItem = () =>
    onChange({ items: [...items, { id: uuid(), topic: '', description: '', status: 'new' }] })

  const updateItem = (id, key, val) =>
    onChange({ items: items.map((item) => (item.id === id ? { ...item, [key]: val } : item)) })

  const removeItem = (id) => onChange({ items: items.filter((item) => item.id !== id) })

  const statusOptions = [
    { key: 'new', label: t('new') },
    { key: 'open', label: t('open') },
    { key: 'inProgress', label: t('inProgress') },
    { key: 'complete', label: t('complete') },
  ]

  return (
    <div>
      {/* Column headers */}
      <div className="grid gap-2 mb-1.5 px-1" style={{ gridTemplateColumns: '1fr 2fr 130px 32px' }}>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('topic')}</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('description')}</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{t('status')}</span>
        <span />
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 2fr 130px 32px' }}>
            <input
              className="input text-sm"
              value={item.topic}
              onChange={(e) => updateItem(item.id, 'topic', e.target.value)}
              placeholder={t('topic')}
            />
            <input
              className="input text-sm"
              value={item.description}
              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
              placeholder={t('description')}
            />
            <select
              className={`input text-sm font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.new}`}
              value={item.status}
              onChange={(e) => updateItem(item.id, 'status', e.target.value)}
            >
              {statusOptions.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button
              onClick={() => removeItem(item.id)}
              className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">
          No {t('topics').toLowerCase()} yet
        </p>
      )}

      <button
        className="mt-3 text-sm text-accent hover:text-accent-dark flex items-center gap-1.5 font-medium"
        onClick={addItem}
      >
        <Plus size={14} /> {t('topic')}
      </button>
    </div>
  )
}
