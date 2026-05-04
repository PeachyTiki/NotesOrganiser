import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { v4 as uuid } from 'uuid'
import { useApp } from '../../../context/AppContext'

const STATUS_STYLES = {
  planned:    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  inProgress: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  complete:   'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300',
  blocked:    'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300',
}

export const TASK_STATUS_COLORS = {
  planned:    { bg: '#F1F5F9', text: '#64748B' },
  inProgress: { bg: '#FFFBEB', text: '#D97706' },
  complete:   { bg: '#F0FDF4', text: '#16A34A' },
  blocked:    { bg: '#FEF2F2', text: '#DC2626' },
}

export default function TasksSection({ section, onChange }) {
  const { settings } = useApp()
  const items = section.items || []

  const add = () =>
    onChange({
      items: [...items, {
        id: uuid(),
        text: '',
        assignee: settings?.yourName || '',
        status: 'planned',
        startDate: '',
        endDate: '',
        createdAt: new Date().toISOString(),
      }],
    })

  const update = (id, key, val) =>
    onChange({ items: items.map((i) => (i.id === id ? { ...i, [key]: val } : i)) })

  const remove = (id) => onChange({ items: items.filter((i) => i.id !== id) })

  return (
    <div>
      <div className="grid gap-2 mb-1.5 px-1" style={{ gridTemplateColumns: '2fr 1fr 100px 100px 120px 32px' }}>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Task</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Assignee</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Start</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">End</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Status</span>
        <span />
      </div>

      <div className="space-y-1.5">
        {items.map((item) => {
          const isComplete = item.status === 'complete'
          return (
            <div
              key={item.id}
              className={`grid gap-2 items-center ${isComplete ? 'opacity-60' : ''}`}
              style={{ gridTemplateColumns: '2fr 1fr 100px 100px 120px 32px' }}
            >
              <input
                className={`input text-sm ${isComplete ? 'line-through text-green-600 dark:text-green-400' : ''}`}
                value={item.text}
                onChange={(e) => update(item.id, 'text', e.target.value)}
                placeholder="Task description…"
              />
              <input
                className="input text-sm"
                value={item.assignee}
                onChange={(e) => update(item.id, 'assignee', e.target.value)}
                placeholder="Assignee"
              />
              <input
                type="date"
                className="input text-sm"
                value={item.startDate || ''}
                onChange={(e) => update(item.id, 'startDate', e.target.value)}
              />
              <input
                type="date"
                className="input text-sm"
                value={item.endDate || ''}
                onChange={(e) => update(item.id, 'endDate', e.target.value)}
              />
              <select
                className={`input text-sm font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.planned}`}
                value={item.status}
                onChange={(e) => update(item.id, 'status', e.target.value)}
              >
                <option value="planned">Planned</option>
                <option value="inProgress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="blocked">Blocked</option>
              </select>
              <button
                onClick={() => remove(item.id)}
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">No tasks yet</p>
      )}

      <button
        className="mt-3 text-sm text-accent hover:text-accent-dark flex items-center gap-1.5 font-medium"
        onClick={add}
      >
        <Plus size={14} /> Add Task
      </button>
    </div>
  )
}
